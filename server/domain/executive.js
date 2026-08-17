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
        ownerRole: delayedClient > delayedTeam ? 'CMO' : 'COO',
        affectedItems: delayedPosts.map(p => `${p.name} (Prazo: ${p.prazo || 'N/A'}${p.responsavel ? ' | 👤 ' + p.responsavel : ''})`)
      };
    })
    .filter(Boolean)
    .sort((a, b) => ({ critical: 3, high: 2, medium: 1 }[b.severity] - ({ critical: 3, high: 2, medium: 1 }[a.severity])));
}

export function buildExecutiveSnapshot({ bottlenecks = {}, posts = {}, demands = [], generatedAt = new Date().toISOString() }) {
  const ranking = posts.ranking || [];
  const responsavelRanking = posts.responsavelRanking || [];
  const delayDetails = posts.delayDetails || [];
  const productivity = posts.productivity || {};
  const quantitative = posts.quantitative || {};
  const delayedTeam = sum(ranking, 'delayedPrazo');
  const delayedClient = sum(ranking, 'delayedVeiculacao');
  const missingPlanning = bottlenecks.missingPlanning || [];
  const missingDashboard = bottlenecks.missingDashboard || [];
  const readiness = bottlenecks.quantitative || {};
  const delayedDemands = demands.length;
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
  const stabilityScore = clamp(100 - delayedTeam * 2 - delayedClient * 5 - missingPlanning.length - delayedDemands * 2, 0, 100);
  const stabilityStatus = stabilityScore >= 75 ? 'stable' : stabilityScore >= 50 ? 'attention' : 'risk';

  const capacitySignals = [];
  if (delayedTeam > 0) {
    const topOwner = responsavelRanking[0];
    capacitySignals.push({
      id: 'capacity-team-delay',
      type: 'capacity_risk',
      severity: delayedTeam >= 10 ? 'high' : 'medium',
      severityLabel: severityLabel(delayedTeam >= 10 ? 'high' : 'medium'),
      title: 'Capacidade interna pressionada',
      whyItMatters: `${delayedTeam} atrasos de prazo interno estão concentrados na carteira${topOwner ? `; ${topOwner.name} aparece com ${topOwner.delayedPrazo + topOwner.delayedVeiculacao} sinais` : ''}.`,
      recommendedDecision: 'Revisar distribuição de capacidade e identificar o gargalo de processo antes de adicionar mais produção.',
      evidence: [evidence('monday', `${delayedTeam} atrasos internos agregados.`, topOwner?.posts?.[0]?.id ? `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${topOwner.posts[0].id}` : null)],
      ownerRole: 'COO',
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
      ownerRole: 'CMO',
      affectedItems: ranking.filter(c => c.delayedVeiculacao > 0).map(c => `${c.name} (${c.delayedVeiculacao} atrasos)`)
    });
  }

  const executiveRisks = [
    ...capacitySignals,
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
      ownerRole: 'Liderança executiva',
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
      ownerRole: 'Liderança executiva',
      affectedItems: missingDashboard
    }] : [])
  ];

  const decisionsNeeded = [];
  if (clientRisks.length > 0) {
    decisionsNeeded.push({
      id: 'decision-client-intervention',
      title: 'Escolher clientes que exigem intervenção executiva',
      context: `${clientRisks.length} clientes apresentam sinais agregados de risco de previsibilidade.`,
      ownerRole: 'CMO/COO',
      priority: clientRisks[0].severity,
      affectedItems: clientRisks.map(r => r.client)
    });
  }
  if (missingPlanning.length > 0 || missingDashboard.length > 0) {
    decisionsNeeded.push({
      id: 'decision-portfolio-readiness',
      title: 'Definir a ordem de recuperação da prontidão da carteira',
      context: `${missingPlanning.length} clientes sem planejamento e ${missingDashboard.length} com dashboard pendente ou desatualizado.`,
      ownerRole: 'CMO/COO',
      priority: missingPlanning.length >= 5 ? 'high' : 'medium',
      affectedItems: [...new Set([...missingPlanning, ...missingDashboard])]
    });
  }
  if (delayedTeam > 0) {
    decisionsNeeded.push({
      id: 'decision-capacity',
      title: 'Decidir resposta para a pressão de capacidade',
      context: `${delayedTeam} atrasos internos agregados na leitura atual.`,
      ownerRole: 'COO',
      priority: delayedTeam >= 10 ? 'high' : 'medium',
      affectedItems: responsavelRanking.filter(r => r.delayedPrazo > 0).map(r => `${r.name} (${r.delayedPrazo} atrasos)`)
    });
  }

  return {
    generatedAt,
    sourceStatus: 'live',
    source: 'Monday.com',
    model: 'executive-signal-v1',
    portfolioStability: {
      score: stabilityScore,
      status: stabilityStatus,
      label: stabilityStatus === 'stable' ? 'ESTÁVEL' : stabilityStatus === 'attention' ? 'SOB OBSERVAÇÃO' : 'RISCO EXECUTIVO',
      explanation: 'Proxy operacional baseado em atrasos agregados, prontidão de planejamento e demandas vencidas. Não substitui indicadores financeiros ou de satisfação.'
    },
    delayDetails,
    productivity,
    summary: {
      openItems: totalOpen,
      delayedTeam,
      delayedClient,
      delayedDemands,
      missingPlanning: missingPlanning.length,
      missingDashboard: missingDashboard.length,
      executiveRisks: executiveRisks.length,
      decisionsNeeded: decisionsNeeded.length
    },
    portfolioReadiness: {
      eligibleClients: Number(readiness.eligibleClients) || 0,
      planningCoveragePct: readiness.planningCoveragePct ?? null,
      dashboardCoveragePct: readiness.dashboardCoveragePct ?? null,
      missingPlanning: missingPlanning.length,
      missingDashboard: missingDashboard.length
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
    methodology: {
      source: 'Monday.com · Produção de Conteúdo',
      note: 'Percentuais de atraso usam itens ativos com prazo vencido. Cobertura mede preenchimento do campo no recorte lido; não equivale a desempenho financeiro ou satisfação do cliente.',
      asOf: generatedAt
    }
  };
}
