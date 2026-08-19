// O Nexus é um painel único de liderança: não há separação de responsabilidade
// por cargo (CMO/COO). Ver ARCHITECTURE.md, seção "Modelo de acesso".
const EXECUTIVE_OWNER_ROLE = 'Liderança executiva';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sum = (rows, field) => (rows || []).reduce((total, row) => total + (Number(row?.[field]) || 0), 0);
const percent = (value, total) => total ? Number(((value / total) * 100).toFixed(1)) : null;

const severityLabel = severity => ({
  critical: 'CRÍTICO',
  high: 'ALTO',
  medium: 'ATENÇÃO',
  low: 'OBSERVAÇÃO'
}[severity] || 'OBSERVAÇÃO');

function evidence(source, detail, url = null) {
  return { source, detail, url };
}

// Cliente recém-entrado ainda não produziu nada porque está em implantação, não
// porque parou. Sem essa janela, todo cadastro novo nasce vermelho no painel.
const ONBOARDING_DAYS = 30;

const daysSince = (isoDate, now) => {
  if (!isoDate) return null;
  const start = new Date(isoDate);
  if (Number.isNaN(start.getTime())) return null;
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
};

// Eixo de execução: o cliente está ativo na carteira mas não tem nenhum conteúdo
// em produção nem demanda aberta. Diferente da prontidão de planejamento, este
// sinal varia sozinho conforme a operação anda — é o que o torna informativo.
function buildExecutionGap({ activePortfolio, clientsWithContent, clientsWithOpenDemand, generatedAt }) {
  const now = new Date(generatedAt);
  const withContent = new Set(clientsWithContent);
  const withDemand = new Set(clientsWithOpenDemand);

  const stalled = [];
  const onboarding = [];

  activePortfolio.forEach(client => {
    if (withContent.has(client.name) || withDemand.has(client.name)) return;
    const age = daysSince(client.since, now);
    const entry = { client: client.name, daysSinceEntry: age };
    if (age !== null && age < ONBOARDING_DAYS) onboarding.push(entry);
    else stalled.push(entry);
  });

  stalled.sort((a, b) => (b.daysSinceEntry || 0) - (a.daysSinceEntry || 0));

  return {
    eligibleClients: activePortfolio.length,
    clientsInExecution: activePortfolio.length - stalled.length - onboarding.length,
    executionCoveragePct: percent(activePortfolio.length - stalled.length - onboarding.length, activePortfolio.length),
    stalled,
    onboarding,
    onboardingWindowDays: ONBOARDING_DAYS,
    definition: 'Cliente ativo sem nenhum item ativo em Produção de Conteúdo e sem demanda aberta em Solicitações de Demandas.'
  };
}

function normalizeMatchLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildCalendarSignals({ events = [], quality = null, activeClients = [], ranking = [], generatedAt = new Date().toISOString() }) {
  const capturedAt = new Date(generatedAt);
  const capturedMs = capturedAt.getTime();
  const horizonMs = capturedMs + 7 * 86400000;
  const clients = activeClients.map(client => typeof client === 'string' ? client : client?.name).filter(Boolean);
  const normalizedClients = clients.map(client => ({ name: client, normalized: normalizeMatchLabel(client) })).filter(client => client.normalized);
  const meetings = (events || []).map(event => {
    const titleNormalized = normalizeMatchLabel(event.title);
    const matched = normalizedClients.find(client => titleNormalized.includes(client.normalized) || client.normalized.includes(titleNormalized));
    return { ...event, client: matched?.name || null, matchType: matched ? 'title' : 'unmatched' };
  });
  const next7Meetings = meetings.filter(event => {
    const dateMs = new Date(event.date).getTime();
    return Number.isFinite(dateMs) && dateMs >= capturedMs && dateMs <= horizonMs;
  });
  const clientsWithMeeting = new Set(meetings.filter(event => event.client).map(event => event.client));
  const riskClientsWithoutMeeting = (ranking || [])
    .filter(row => (Number(row.delayedPrazo) || 0) + (Number(row.delayedVeiculacao) || 0) > 0)
    .map(row => row.name)
    .filter(Boolean)
    .filter(name => !clientsWithMeeting.has(name));

  return {
    quality: quality || { source: 'Google Calendar · iCal', configured: false, complete: false, status: 'not-configured', fetchedAt: null, eventCount: 0 },
    horizonDays: 7,
    next7Count: next7Meetings.length,
    next7Meetings: next7Meetings.slice(0, 20).map(event => ({ title: event.title, date: event.date, client: event.client, matchType: event.matchType })),
    matchedEvents: meetings.slice(0, 200).map(event => ({ title: event.title, date: event.date, client: event.client, matchType: event.matchType })),
    riskClientsWithoutMeeting,
    matchedClientCount: clientsWithMeeting.size,
    unmatchedNext7Count: next7Meetings.filter(event => !event.client).length,
    note: 'A correspondência entre reunião e cliente usa o nome do cliente no título; correspondências aproximadas devem ser tratadas como evidência de baixa confiança.'
  };
}

export function buildReadinessKpis({ activePortfolio = [], missingPlanning = [], executionGap = {}, meetingLogs = [], calendar3MonthCoverage = null, calendarEvents = [], calendarQuality = null, generatedAt = new Date().toISOString() }) {
  const activeNames = activePortfolio.map(client => client.name).filter(Boolean);
  const missingPlanningSet = new Set(missingPlanning);
  const clientsWithPlanning = activeNames.filter(name => !missingPlanningSet.has(name));
  const planningWithout = activeNames.filter(name => missingPlanningSet.has(name));
  const capturedAt = new Date(generatedAt);
  const monthStart = new Date(capturedAt.getFullYear(), capturedAt.getMonth(), 1);
  const nextMonthStart = new Date(capturedAt.getFullYear(), capturedAt.getMonth() + 1, 1);
  const normalize = value => normalizeMatchLabel(value);
  const findLog = clientName => meetingLogs.find(log => {
    const logName = normalize(log?.name);
    const activeName = normalize(clientName);
    return logName && activeName && (logName === activeName || logName.includes(activeName) || activeName.includes(logName));
  });
  const clientsWithMeetingCurrentMonth = activeNames.filter(clientName => {
    const log = findLog(clientName);
    return Boolean(log?.meetings?.some(meeting => {
      const date = new Date(meeting.date);
      return Number.isFinite(date.getTime()) && date >= monthStart && date < nextMonthStart;
    }));
  });
  const clientsWithoutMeetingCurrentMonth = activeNames.filter(name => !clientsWithMeetingCurrentMonth.includes(name));
  const onboardingClients = (executionGap.onboarding || []).map(client => client.client).filter(Boolean);
  const onboardingSet = new Set(onboardingClients);
  const clientsNotInOnboarding = activeNames.filter(name => !onboardingSet.has(name));
  const calendar = calendar3MonthCoverage || { mapped: false, completeClients: null, missingClients: null, completeCount: null, missingCount: null, coveragePct: null, columnIds: [], message: 'Cobertura de três meses não mapeada no Monday.' };
  const agendaMapped = Boolean(calendarQuality?.configured && calendarQuality?.status === 'ok');
  const agendaStartMs = capturedAt.getTime();
  const agendaEndMs = agendaStartMs + 30 * 86400000;
  const agendaClientsWithMeeting = agendaMapped
    ? activeNames.filter(clientName => (calendarEvents || []).some(event => event.client === clientName && Number.isFinite(new Date(event.date).getTime()) && new Date(event.date).getTime() >= agendaStartMs && new Date(event.date).getTime() < agendaEndMs))
    : null;
  const agendaClientsWithoutMeeting = agendaMapped
    ? activeNames.filter(clientName => !agendaClientsWithMeeting.includes(clientName))
    : null;

  return {
    eligibleClients: activeNames.length,
    planning: {
      withCount: clientsWithPlanning.length,
      withoutCount: planningWithout.length,
      withClients: clientsWithPlanning,
      withoutClients: planningWithout,
      coveragePct: percent(clientsWithPlanning.length, activeNames.length),
      source: 'Monday.com · Gestão de Clientes · Planejamento'
    },
    meetingsCurrentMonth: {
      month: `${capturedAt.getFullYear()}-${String(capturedAt.getMonth() + 1).padStart(2, '0')}`,
      withCount: clientsWithMeetingCurrentMonth.length,
      withoutCount: clientsWithoutMeetingCurrentMonth.length,
      withClients: clientsWithMeetingCurrentMonth,
      withoutClients: clientsWithoutMeetingCurrentMonth,
      coveragePct: percent(clientsWithMeetingCurrentMonth.length, activeNames.length),
      source: 'Monday.com · Reuniões · data'
    },
    agendaNext30Days: {
      mapped: agendaMapped,
      windowDays: 30,
      withCount: agendaClientsWithMeeting?.length ?? null,
      withoutCount: agendaClientsWithoutMeeting?.length ?? null,
      withClients: agendaClientsWithMeeting,
      withoutClients: agendaClientsWithoutMeeting,
      coveragePct: agendaClientsWithMeeting ? percent(agendaClientsWithMeeting.length, activeNames.length) : null,
      source: 'Google Calendar · iCal · próximos 30 dias',
      period: `${capturedAt.toISOString().slice(0, 10)} → ${new Date(agendaEndMs).toISOString().slice(0, 10)}`,
      message: agendaMapped ? null : `Agenda indisponível ou não configurada (${calendarQuality?.status || 'not-configured'}).`
    },
    onboarding: {
      withCount: onboardingClients.length,
      withoutCount: clientsNotInOnboarding.length,
      withClients: onboardingClients,
      withoutClients: clientsNotInOnboarding,
      windowDays: executionGap.onboardingWindowDays || ONBOARDING_DAYS,
      source: 'Monday.com · Gestão de Clientes · created_at + ausência de execução'
    },
    calendar3Months: {
      ...calendar,
      source: 'Monday.com · três colunas mensais de calendário'
    }
  };
}

function buildClientRisks(ranking) {
  return (ranking || [])
    .map(row => {
      const delayedTeam = Number(row.delayedPrazo) || 0;
      const delayedClient = Number(row.delayedVeiculacao) || 0;
      const delayedTotal = delayedTeam + delayedClient;
      if (!delayedTotal) return null;

      const severity = delayedTotal >= 10 ? 'critical' : delayedTotal >= 4 ? 'high' : 'medium';
      const delayedPosts = row.details?.filter(p => p.isDelayedPrazo || p.isDelayedVeiculacao) || [];
      const firstEvidence = delayedPosts[0];
      return {
        id: `client-risk-${String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        type: 'client_predictability_risk',
        client: row.name,
        severity,
        severityLabel: severityLabel(severity),
        title: `${row.name} concentra risco de previsibilidade`,
        whyItMatters: `${delayedTotal} sinais de atraso agregados: ${delayedTeam} internos e ${delayedClient} de veiculação.`,
        recommendedDecision: delayedTotal >= 10
          ? 'Definir intervenção executiva e plano de recuperação para este cliente.'
          : 'Acompanhar a tendência e confirmar se o gargalo é pontual ou recorrente.',
        evidence: [evidence('monday', `${row.open || 0} itens abertos; ${delayedTotal} atrasos agregados.`, firstEvidence?.id ? `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${firstEvidence.id}` : null)],
        ownerRole: EXECUTIVE_OWNER_ROLE,
        affectedItems: delayedPosts.map(p => `${p.name} (Prazo: ${p.prazo || 'N/A'}${p.responsavel ? ' | 👤 ' + p.responsavel : ''})`)
      };
    })
    .filter(Boolean)
    .sort((a, b) => ({ critical: 3, high: 2, medium: 1 }[b.severity] - ({ critical: 3, high: 2, medium: 1 }[a.severity])));
}

export function buildExecutiveSnapshot({ bottlenecks = {}, posts = {}, demands = [], calendar = null, meetingLogs = [], generatedAt = new Date().toISOString(), sourceMeta = {} }) {
  const ranking = posts.ranking || [];
  const boardPagination = {
    production: posts.pagination || null,
    clients: bottlenecks.pagination || null,
    demands: demands.pagination || null
  };
  const paginationStates = Object.values(boardPagination).filter(Boolean);
  const sourcesComplete = paginationStates.length === 3 && paginationStates.every(state => state.complete === true);
  const quantitative = posts.quantitative || {};
  const sourceBoardQuality = {
    production: {
      ...(boardPagination.production || {}),
      count: boardPagination.production?.count ?? quantitative.activeItems ?? quantitative.totalItems ?? null,
      pages: boardPagination.production?.pages ?? null,
      complete: boardPagination.production?.complete === true,
      derived: !boardPagination.production
    },
    clients: {
      ...(boardPagination.clients || {}),
      count: boardPagination.clients?.count ?? bottlenecks.quantitative?.eligibleClients ?? null,
      pages: boardPagination.clients?.pages ?? null,
      complete: boardPagination.clients?.complete === true,
      derived: !boardPagination.clients
    },
    demands: {
      ...(boardPagination.demands || {}),
      count: boardPagination.demands?.count ?? (Array.isArray(demands) ? demands.length : null),
      pages: boardPagination.demands?.pages ?? null,
      complete: boardPagination.demands?.complete === true,
      derived: !boardPagination.demands
    }
  };
  const knownRecords = Object.values(sourceBoardQuality).map(board => board.count).filter(value => Number.isFinite(Number(value)));
  const knownPages = Object.values(sourceBoardQuality).map(board => board.pages).filter(value => Number.isFinite(Number(value)));
  const sourceRecords = knownRecords.reduce((total, value) => total + Number(value), 0);
  const sourcePages = knownPages.length === 3 ? knownPages.reduce((total, value) => total + Number(value), 0) : null;
  const responsavelRanking = posts.responsavelRanking || [];
  const delayDetails = posts.delayDetails || [];
  const productivity = posts.productivity || {};
  const delayedTeam = sum(ranking, 'delayedPrazo');
  const delayedClient = sum(ranking, 'delayedVeiculacao');
  const missingPlanning = bottlenecks.missingPlanning || [];
  const missingDashboard = bottlenecks.missingDashboard || [];
  const readiness = bottlenecks.quantitative || {};
  const delayedDemands = demands.length;
  const openDemandItems = Array.isArray(demands.openDemandItems) ? demands.openDemandItems : [];
  const productionByKey = new Map(ranking.filter(row => row?.name).map(row => [normalizeMatchLabel(row.name), row]));
  const demandGroups = new Map();
  openDemandItems.filter(item => item?.cliente).forEach(item => {
    const key = normalizeMatchLabel(item.cliente);
    if (!key) return;
    if (!demandGroups.has(key)) demandGroups.set(key, { name: item.cliente, items: [] });
    demandGroups.get(key).items.push(item);
  });
  const relationKeys = new Set([...productionByKey.keys(), ...demandGroups.keys()]);
  const sourceRelationDetails = [...relationKeys].map(key => {
    const production = productionByKey.get(key);
    const demand = demandGroups.get(key);
    const productionItems = production?.details || [];
    const demandItems = demand?.items || [];
    return {
      client: production?.name || demand?.name || key,
      productionOpen: production?.open || 0,
      productionDelayed: (production?.delayedPrazo || 0) + (production?.delayedVeiculacao || 0),
      productionItemIds: productionItems.map(item => item.id).filter(Boolean),
      demandOpen: demandItems.length,
      demandDelayed: demandItems.filter(item => item.isDelayed).length,
      demandItemIds: demandItems.map(item => item.id).filter(Boolean),
      inProduction: Boolean(production),
      inDemand: Boolean(demand)
    };
  }).sort((a, b) => (b.productionDelayed + b.demandDelayed) - (a.productionDelayed + a.demandDelayed) || b.productionOpen + b.demandOpen - (a.productionOpen + a.demandOpen));
  const overlapDetails = sourceRelationDetails.filter(item => item.inProduction && item.inDemand);
  const sourceRelation = {
    productionOpenClients: sourceRelationDetails.filter(item => item.inProduction).map(item => item.client),
    demandOpenClients: sourceRelationDetails.filter(item => item.inDemand).map(item => item.client),
    overlapClients: overlapDetails.map(item => item.client),
    productionOnlyClients: sourceRelationDetails.filter(item => item.inProduction && !item.inDemand).map(item => item.client),
    demandOnlyClients: sourceRelationDetails.filter(item => item.inDemand && !item.inProduction).map(item => item.client),
    overlapDetails,
    counts: {
      productionOpenClients: sourceRelationDetails.filter(item => item.inProduction).length,
      demandOpenClients: sourceRelationDetails.filter(item => item.inDemand).length,
      overlapClients: overlapDetails.length,
      productionOnlyClients: sourceRelationDetails.filter(item => item.inProduction && !item.inDemand).length,
      demandOnlyClients: sourceRelationDetails.filter(item => item.inDemand && !item.inProduction).length
    },
    note: 'A interseção mostra clientes com itens abertos nas duas fontes. Ela não altera automaticamente o score; serve para separar sinais únicos de possível sobreposição.'
  };
  const executionGap = buildExecutionGap({
    activePortfolio: bottlenecks.activePortfolio || [],
    clientsWithContent: ranking.map(row => row.name),
    clientsWithOpenDemand: demands.clientsWithOpenDemand || [],
    generatedAt
  });
  const calendarSignals = buildCalendarSignals({
    events: calendar?.events || [],
    quality: calendar?.quality || null,
    activeClients: bottlenecks.activePortfolio || [],
    ranking,
    generatedAt
  });
  const readinessKpis = buildReadinessKpis({
    activePortfolio: bottlenecks.activePortfolio || [],
    missingPlanning,
    executionGap,
    meetingLogs,
    calendar3MonthCoverage: bottlenecks.calendar3MonthCoverage,
    calendarEvents: calendarSignals.matchedEvents || [],
    calendarQuality: calendarSignals.quality || null,
    generatedAt
  });
  const stalledClients = new Set(executionGap.stalled.map(client => client.client));
  const onboardingClients = new Set(executionGap.onboarding.map(client => client.client));
  const eligibleForReadiness = Number(readiness.eligibleClients) || executionGap.eligibleClients || 0;
  const planningCoveragePct = readiness.planningCoveragePct ?? null;
  const dashboardCoveragePct = readiness.dashboardCoveragePct ?? null;
  const planningSystemicGap = missingPlanning.length > 0 && eligibleForReadiness > 0 && (planningCoveragePct === 0 || missingPlanning.length >= eligibleForReadiness);
  const dashboardSystemicGap = missingDashboard.length > 0 && eligibleForReadiness > 0 && (dashboardCoveragePct === 0 || missingDashboard.length >= eligibleForReadiness);
  const protectedClient = client => {
    const reasons = [];
    if (stalledClients.has(client)) reasons.push('cliente sem execução');
    if (onboardingClients.has(client)) reasons.push('fase de entrada');
    return { client, reason: reasons.join(' + ') || 'regra de não duplicação' };
  };
  const planningProtectedClients = missingPlanning.filter(client => stalledClients.has(client) || onboardingClients.has(client)).map(protectedClient);
  const dashboardProtectedClients = missingDashboard.filter(client => stalledClients.has(client) || onboardingClients.has(client)).map(protectedClient);
  const planningClients = missingPlanning.filter(client => !stalledClients.has(client) && !onboardingClients.has(client));
  const dashboardClients = missingDashboard.filter(client => !stalledClients.has(client) && !onboardingClients.has(client));
  const readinessDeductions = [];
  if (planningSystemicGap) {
    readinessDeductions.push({ id: 'planning-source-gap', kind: 'planning', label: 'Planejamento da carteira sem preenchimento', count: missingPlanning.length, observedCount: missingPlanning.length, penalizedCount: 1, protectedCount: 0, protectedClients: [], pointsPerItem: 5, points: 5, mode: 'source_gap', source: 'Monday.com · Gestão de Clientes · Planejamento', affectedClients: missingPlanning, observedClients: missingPlanning, explanation: 'Uma penalização única pela lacuna sistêmica da fonte.' });
  } else if (planningClients.length > 0) {
    readinessDeductions.push({ id: 'missing-planning', kind: 'planning', label: 'Clientes sem planejamento válido', count: planningClients.length, observedCount: missingPlanning.length, penalizedCount: planningClients.length, protectedCount: planningProtectedClients.length, protectedClients: planningProtectedClients, pointsPerItem: 3, points: planningClients.length * 3, mode: 'client_gap', source: 'Monday.com · Gestão de Clientes · Planejamento', affectedClients: planningClients, observedClients: missingPlanning, explanation: 'Clientes em onboarding ou sem execução ficam protegidos para evitar dupla penalização.' });
  }
  if (dashboardSystemicGap) {
    readinessDeductions.push({ id: 'dashboard-source-gap', kind: 'dashboard', label: 'Dashboard/calendário da carteira sem preenchimento', count: missingDashboard.length, observedCount: missingDashboard.length, penalizedCount: 1, protectedCount: 0, protectedClients: [], pointsPerItem: 5, points: 5, mode: 'source_gap', source: 'Monday.com · Gestão de Clientes · Dashboard/calendário', affectedClients: missingDashboard, observedClients: missingDashboard, explanation: 'Uma penalização única pela lacuna sistêmica da fonte.' });
  } else if (dashboardClients.length > 0) {
    readinessDeductions.push({ id: 'missing-dashboard', kind: 'dashboard', label: 'Clientes sem dashboard/calendário válido', count: dashboardClients.length, observedCount: missingDashboard.length, penalizedCount: dashboardClients.length, protectedCount: dashboardProtectedClients.length, protectedClients: dashboardProtectedClients, pointsPerItem: 3, points: dashboardClients.length * 3, mode: 'client_gap', source: 'Monday.com · Gestão de Clientes · Dashboard/calendário', affectedClients: dashboardClients, observedClients: missingDashboard, explanation: 'Clientes em onboarding ou sem execução ficam protegidos para evitar dupla penalização.' });
  }
  const clientRisks = buildClientRisks(ranking);
  const totalOpen = sum(ranking, 'open');
  const clientRanking = ranking
    .map(row => {
      const delayedItems = (Number(row.delayedPrazo) || 0) + (Number(row.delayedVeiculacao) || 0);
      return {
        client: row.name,
        openItems: Number(row.open) || 0,
        delayedItems,
        riskPct: percent(delayedItems, Number(row.open) || 0),
        shareOfOpenPct: percent(Number(row.open) || 0, totalOpen),
        internalDelays: Number(row.delayedPrazo) || 0,
        publicationDelays: Number(row.delayedVeiculacao) || 0
      };
    })
    .sort((a, b) => b.delayedItems - a.delayedItems || b.openItems - a.openItems);
  // Prontidão entra no score somente como lacuna sistêmica ou lacuna parcial
  // comprovada, com precedência sobre clientes sem execução e onboarding para
  // impedir que o mesmo problema seja descontado duas vezes.
  const readinessPenalty = readinessDeductions.reduce((total, deduction) => total + deduction.points, 0);
  const stabilityScore = 100 - delayedTeam * 2 - delayedClient * 5 - executionGap.stalled.length * 5 - delayedDemands * 2 - readinessPenalty;
  const stabilityStatus = stabilityScore >= 75 ? 'stable' : stabilityScore >= 50 ? 'attention' : stabilityScore < 0 ? 'catastrophic' : 'risk';
  const scoreDeductions = [
    { id: 'internal-delays', label: 'Atrasos em Produção de Conteúdo', count: delayedTeam, pointsPerItem: 2, points: delayedTeam * 2, source: 'Monday.com · Produção de Conteúdo · prazo interno' },
    { id: 'publication-risk', label: 'Veiculações vencidas', count: delayedClient, pointsPerItem: 5, points: delayedClient * 5, source: 'Monday.com · veiculação' },
    { id: 'execution-gap', label: 'Clientes sem execução', count: executionGap.stalled.length, pointsPerItem: 5, points: executionGap.stalled.length * 5, source: 'Monday.com · carteira ativa sem conteúdo/demanda' },
    { id: 'overdue-demands', label: 'Solicitações de Demandas vencidas', count: delayedDemands, pointsPerItem: 2, points: delayedDemands * 2, source: 'Monday.com · Solicitações de Demandas · prazo da solicitação' },
    ...readinessDeductions
  ];

  const capacitySignals = [];
  if (delayedTeam > 0) {
    const topOwner = responsavelRanking[0];
    capacitySignals.push({
      id: 'capacity-team-delay',
      type: 'capacity_risk',
      severity: delayedTeam >= 10 ? 'high' : 'medium',
      severityLabel: severityLabel(delayedTeam >= 10 ? 'high' : 'medium'),
      title: 'Capacidade da Produção de Conteúdo pressionada',
      whyItMatters: `${delayedTeam} itens de Produção de Conteúdo estão com prazo interno vencido e concentrados na carteira${topOwner ? `; ${topOwner.name} aparece com ${topOwner.delayedPrazo + topOwner.delayedVeiculacao} sinais` : ''}.`,
      recommendedDecision: 'Revisar distribuição de capacidade e identificar o gargalo de processo antes de adicionar mais produção.',
      evidence: [evidence('monday', `${delayedTeam} itens de Produção de Conteúdo com prazo interno vencido.`, topOwner?.posts?.[0]?.id ? `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${topOwner.posts[0].id}` : null)],
      ownerRole: EXECUTIVE_OWNER_ROLE,
      affectedItems: responsavelRanking.filter(r => r.delayedPrazo > 0).map(r => `${r.name} (${r.delayedPrazo} atrasos)`)
    });
  }

  if (delayedClient > 0) {
    capacitySignals.push({
      id: 'client-delivery-risk',
      type: 'delivery_risk',
      severity: delayedClient >= 3 ? 'high' : 'medium',
      severityLabel: severityLabel(delayedClient >= 3 ? 'high' : 'medium'),
      title: 'Risco de entrega percebida pelo cliente',
      whyItMatters: `${delayedClient} itens ultrapassaram a data de veiculação prevista.`,
      recommendedDecision: 'Avaliar comunicação executiva com os clientes expostos e definir prioridade de recuperação.',
      evidence: [evidence('monday', `${delayedClient} atrasos de veiculação agregados.`)],
      ownerRole: EXECUTIVE_OWNER_ROLE,
      affectedItems: ranking.filter(c => c.delayedVeiculacao > 0).map(c => `${c.name} (${c.delayedVeiculacao} atrasos)`)
    });
  }

  const executiveRisks = [
    ...capacitySignals,
    ...(executionGap.stalled.length > 0 ? [{
      id: 'portfolio-execution-gap',
      type: 'client_execution_risk',
      severity: executionGap.stalled.length >= 3 ? 'critical' : 'high',
      severityLabel: severityLabel(executionGap.stalled.length >= 3 ? 'critical' : 'high'),
      title: 'Clientes ativos sem execução',
      whyItMatters: `${executionGap.stalled.length} cliente(s) da carteira ativa não têm conteúdo em produção nem demanda aberta.`,
      recommendedDecision: 'Confirmar se o contrato segue vigente e o que trava a entrada de trabalho antes que a ausência vire risco de previsibilidade.',
      evidence: [evidence('monday', executionGap.definition)],
      ownerRole: EXECUTIVE_OWNER_ROLE,
      affectedItems: executionGap.stalled.map(c => c.daysSinceEntry === null
        ? c.client
        : `${c.client} (na carteira há ${c.daysSinceEntry} dias)`)
    }] : []),
    ...clientRisks.slice(0, 8),
    ...(missingPlanning.length > 0 ? [{
      id: 'portfolio-planning-gap',
      type: 'strategic_readiness_risk',
      severity: missingPlanning.length >= 5 ? 'high' : 'medium',
      severityLabel: severityLabel(missingPlanning.length >= 5 ? 'high' : 'medium'),
      title: 'Carteira com baixa prontidão estratégica',
      whyItMatters: `${missingPlanning.length} clientes não apresentam planejamento estratégico identificado na fonte operacional.`,
      recommendedDecision: 'Definir prioridade de regularização do planejamento por impacto de carteira, sem transformar o Nexus em fila de execução.',
      evidence: [evidence('monday', `${missingPlanning.length} clientes sem planejamento identificado.`)],
      ownerRole: EXECUTIVE_OWNER_ROLE,
      affectedItems: missingPlanning
    }] : []),
    ...(missingDashboard.length > 0 ? [{
      id: 'portfolio-data-freshness-risk',
      type: 'data_freshness_risk',
      severity: missingDashboard.length >= 5 ? 'high' : 'medium',
      severityLabel: severityLabel(missingDashboard.length >= 5 ? 'high' : 'medium'),
      title: 'Cobertura de dados executivos incompleta',
      whyItMatters: `${missingDashboard.length} clientes têm dashboard pendente ou desatualizado na fonte operacional.`,
      recommendedDecision: 'Definir a ordem de atualização da base antes de tomar decisões comparativas sobre a carteira.',
      evidence: [evidence('monday', `${missingDashboard.length} clientes com dashboard pendente ou desatualizado.`)],
      ownerRole: EXECUTIVE_OWNER_ROLE,
      affectedItems: missingDashboard
    }] : [])
  ];

  const decisionsNeeded = [];
  if (clientRisks.length > 0) {
    decisionsNeeded.push({
      id: 'decision-client-intervention',
      title: 'Escolher clientes que exigem intervenção executiva',
      context: `${clientRisks.length} clientes apresentam sinais agregados de risco de previsibilidade.`,
      ownerRole: EXECUTIVE_OWNER_ROLE,
      priority: clientRisks[0].severity,
      affectedItems: clientRisks.map(r => r.client)
    });
  }
  if (missingPlanning.length > 0 || missingDashboard.length > 0) {
    decisionsNeeded.push({
      id: 'decision-portfolio-readiness',
      title: 'Definir a ordem de recuperação da prontidão da carteira',
      context: `${missingPlanning.length} clientes sem planejamento e ${missingDashboard.length} com dashboard pendente ou desatualizado.`,
      ownerRole: EXECUTIVE_OWNER_ROLE,
      priority: missingPlanning.length >= 5 ? 'high' : 'medium',
      affectedItems: [...new Set([...missingPlanning, ...missingDashboard])]
    });
  }
  if (delayedTeam > 0) {
    decisionsNeeded.push({
      id: 'decision-capacity',
      title: 'Decidir resposta para a pressão de capacidade',
      context: `${delayedTeam} atrasos internos agregados na leitura atual.`,
      ownerRole: EXECUTIVE_OWNER_ROLE,
      priority: delayedTeam >= 10 ? 'high' : 'medium',
      affectedItems: responsavelRanking.filter(r => r.delayedPrazo > 0).map(r => `${r.name} (${r.delayedPrazo} atrasos)`)
    });
  }

  return {
    generatedAt,
    sourceStatus: sourceMeta.status || 'live',
    source: sourceMeta.name || 'Monday.com',
    model: 'executive-signal-v1',
    portfolioStability: {
      score: stabilityScore,
      rawScore: stabilityScore,
      baseline: 100,
      status: stabilityStatus,
      label: stabilityStatus === 'stable' ? 'ESTÁVEL' : stabilityStatus === 'attention' ? 'SOB OBSERVAÇÃO' : stabilityStatus === 'catastrophic' ? 'ABAIXO DA LINHA DE RECUPERAÇÃO' : 'RISCO EXECUTIVO',
      explanation: 'Score bruto de pressão operacional. Pode ficar negativo. Cada fator retira pontos; as missões mostram quantos pontos podem ser recuperados.',
      scoreDeductions,
      recoveryPointsAvailable: scoreDeductions.reduce((total, deduction) => total + deduction.points, 0)
    },
    portfolioExecution: executionGap,
    activeItems: posts.activeItems || ranking.flatMap(row => (row.details || []).map(item => ({ ...item, client: row.name }))),
    sourceRelation,
    calendarSignals,
    delayDetails: delayDetails,
    productivity,
    summary: {
      openItems: totalOpen,
      delayedTeam,
      delayedClient,
      delayedDemands,
      stalledClients: executionGap.stalled.length,
      missingPlanning: missingPlanning.length,
      missingDashboard: missingDashboard.length,
      executiveRisks: executiveRisks.length,
      decisionsNeeded: decisionsNeeded.length
    },
    portfolioReadiness: {
      eligibleClients: Number(readiness.eligibleClients) || 0,
      planningCoveragePct: readiness.planningCoveragePct ?? null,
      dashboardCoveragePct: readiness.dashboardCoveragePct ?? null,
      kpis: readinessKpis,
      missingPlanning: missingPlanning.length,
      missingDashboard: missingDashboard.length,
      clientsWithoutPlanning: missingPlanning,
      clientsWithoutDashboard: missingDashboard,
      planningSystemicGap,
      dashboardSystemicGap,
      scoreDeductions: readinessDeductions,
      quality: bottlenecks.readinessQuality || null,
      note: 'Lacunas sistêmicas de cobertura geram uma missão de fonte única; lacunas parciais geram pontos por cliente. Clientes sem execução e onboarding não recebem penalização de prontidão duplicada.'
    },
    quantitative: {
      totalItems: quantitative.totalItems ?? totalOpen,
      itemsWithClient: quantitative.itemsWithClient ?? 0,
      clientCoveragePct: quantitative.clientCoveragePct ?? null,
      activeItems: quantitative.activeItems ?? totalOpen,
      completedItems: quantitative.completedItems ?? 0,
      activePct: quantitative.activePct ?? percent(totalOpen, Number(quantitative.totalItems ?? totalOpen) + Number(quantitative.completedItems ?? 0)),
      itemsWithInternalDeadline: Number(quantitative.itemsWithInternalDeadline) || 0,
      internalDeadlineCoveragePct: quantitative.internalDeadlineCoveragePct ?? null,
      itemsWithPublicationDate: Number(quantitative.itemsWithPublicationDate) || 0,
      publicationDateCoveragePct: quantitative.publicationDateCoveragePct ?? null,
      overdueInternal: quantitative.overdueInternal ?? delayedTeam,
      overdueInternalPctOfActive: quantitative.overdueInternalPctOfActive ?? percent(delayedTeam, Number(quantitative.activeItems ?? totalOpen)),
      overduePublication: quantitative.overduePublication ?? delayedClient,
      overduePublicationPctOfActive: quantitative.overduePublicationPctOfActive ?? percent(delayedClient, Number(quantitative.activeItems ?? totalOpen)),
      dueWithin7Internal: Number(quantitative.dueWithin7Internal) || 0,
      dueWithin7Publication: Number(quantitative.dueWithin7Publication) || 0,
      priorityCoveragePct: quantitative.priorityCoveragePct ?? null,
      statusCounts: quantitative.statusCounts || {},
      groupCounts: quantitative.groupCounts || {},
      priorityCounts: quantitative.priorityCounts || {},
      formatCounts: quantitative.formatCounts || {},
      statusColors: quantitative.statusColors || {},
      dataQuality: {
        itemsSampled: quantitative.totalItems ?? totalOpen,
        clientCoveragePct: quantitative.clientCoveragePct ?? null,
        internalDeadlineCoveragePct: quantitative.internalDeadlineCoveragePct ?? null,
        publicationDateCoveragePct: quantitative.publicationDateCoveragePct ?? null,
        priorityCoveragePct: quantitative.priorityCoveragePct ?? null
      }
    },
    clientRanking,
    executiveRisks,
    decisionsNeeded,
    capacitySignals,
    executiveLens: {
      title: 'PAINEL EXECUTIVO',
      question: 'Qual decisão executiva precisa ser tomada agora?',
      focus: ['Previsibilidade da carteira', 'Risco de entrega e relacionamento', 'Capacidade e prontidão estratégica']
    },
    sourceQuality: {
      capturedAt: sourceMeta.capturedAt || generatedAt,
      freshness: sourceMeta.freshness || sourceMeta.status || 'live',
      source: sourceMeta.name || 'Monday.com',
      sync: sourceMeta.sync || null,
      fieldCoverage: sourceMeta.fieldCoverage || posts?.quantitative?.fieldCoverage || null,
      complete: sourcesComplete && sourceMeta.complete !== false,
      records: sourceRecords || null,
      pages: sourcePages,
      monday: {
        complete: sourcesComplete,
        boards: sourceBoardQuality,
        note: sourcesComplete
          ? (sourceMeta.name ? `Produção de Conteúdo veio do ${sourceMeta.name}; os demais boards seguem a leitura configurada no Nexus.` : 'Todos os boards consultados foram percorridos por cursor.')
          : 'A completude da leitura ainda não foi confirmada para todos os boards.'
      },
      calendar: calendarSignals.quality
    },
    methodology: {
      source: 'Monday.com · Produção de Conteúdo',
      note: 'Percentuais de atraso usam itens ativos com prazo vencido. Cobertura mede preenchimento do campo no recorte lido; não equivale a desempenho financeiro ou satisfação do cliente.',
      asOf: generatedAt
    }
  };
}
