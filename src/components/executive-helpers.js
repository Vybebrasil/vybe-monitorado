export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

export const clickable = (onActivate, label) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onActivate,
  onKeyDown: (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  }
});

export const splitOwners = (value) => String(value || '').split(',').map(name => name.trim()).filter(Boolean);
export const mondayItemUrl = (id) => id ? `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${id}` : null;
export const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
export const formatPct = (value) => value === null || value === undefined || Number.isNaN(Number(value)) ? 'N/D' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
export const clampPct = (value) => Math.max(0, Math.min(100, Number(value) || 0));
export const formatPoints = (value) => {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${formatNumber(numeric)} pts`;
};

export const scoreComposition = (snapshot) => {
  const rawScore = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score);
  const deductions = Array.isArray(snapshot?.portfolioStability?.scoreDeductions) ? snapshot.portfolioStability.scoreDeductions : [];
  if (!Number.isFinite(rawScore)) return 'Composição do score indisponível nesta leitura.';
  const terms = deductions
    .filter(deduction => Number(deduction?.points) > 0)
    .map(deduction => {
      const observed = Number(deduction?.observedCount ?? deduction?.count ?? 0);
      const penalized = Number(deduction?.penalizedCount ?? deduction?.count ?? 0);
      const protectedCount = Number(deduction?.protectedCount ?? Math.max(0, observed - penalized));
      if (deduction?.mode === 'source_gap') return `(${formatNumber(observed)} observados · 1 penalização sistêmica · -${formatNumber(deduction.points)} pts no total)`;
      const protection = protectedCount > 0 ? ` · ${formatNumber(protectedCount)} protegidos` : '';
      return `(${formatNumber(observed)} observados · ${formatNumber(penalized)} penalizados${protection} · ${formatNumber(penalized)} × -${formatNumber(deduction.pointsPerItem)} pts = -${formatNumber(deduction.points)} pts)`;
    });
  const formula = terms.length ? `100 pts − ${terms.join(' − ')}` : '100 pts';
  return `${formula} = ${formatPoints(rawScore)}. O score é bruto, pode ficar negativo e não representa percentual financeiro ou satisfação.`;
};

export const delayUrgency = (days) => {
  const value = Number(days) || 0;
  if (value >= 15) return { tone: 'catastrophic', label: 'Crítico', description: 'Atraso crítico: exige intervenção executiva imediata.' };
  if (value >= 7) return { tone: 'critical', label: 'Severo', description: 'Atraso severo: risco elevado de quebra de previsibilidade.' };
  if (value >= 3) return { tone: 'high', label: 'Alto', description: 'Atraso alto: precisa de causa e próximo marco.' };
  return { tone: 'attention', label: 'Atenção', description: 'Atraso recente: acompanhar antes que escale.' };
};

export const buildMissions = (snapshot) => {
  const quantitative = snapshot?.quantitative || {};
  const execution = snapshot?.portfolioExecution || {};
  const delayedDemands = Number(snapshot?.summary?.delayedDemands) || 0;
  const readinessMissions = (snapshot?.portfolioReadiness?.scoreDeductions || []).map(deduction => ({
    id: deduction.id,
    kpiId: 'readiness',
    readinessId: deduction.id,
    title: deduction.kind === 'planning' ? (deduction.mode === 'source_gap' ? 'Preencher a fonte de planejamento' : 'Completar planejamentos da carteira') : (deduction.mode === 'source_gap' ? 'Preencher a fonte de calendário' : 'Completar calendários da carteira'),
    current: deduction.mode === 'source_gap' ? deduction.count : (deduction.penalizedCount ?? deduction.count),
    pointsPerItem: deduction.pointsPerItem,
    unit: deduction.mode === 'source_gap' ? 'clientes observados' : 'clientes penalizados',
    accent: deduction.kind === 'planning' ? 'attention' : 'cyan',
    description: deduction.mode === 'source_gap' ? `${deduction.count} clientes observados; a missão recupera a fonte inteira sem cobrar o mesmo cliente duas vezes.` : `${deduction.observedCount ?? deduction.count} clientes sem o campo; ${deduction.penalizedCount ?? deduction.count} entram no score${deduction.protectedCount ? ` e ${deduction.protectedCount} ficam protegidos` : ''}. Cada cliente penalizado regularizado devolve ${deduction.pointsPerItem} pontos.`,
    recoverablePoints: deduction.points
  }));
  const missions = [
    { id: 'internal-delays', kpiId: 'delays', title: 'Regularizar itens da Produção de Conteúdo', current: Number(quantitative.overdueInternal) || 0, pointsPerItem: 2, unit: 'itens de Produção', accent: 'critical', source: 'Monday.com · Produção de Conteúdo · prazo interno', description: 'Cada item com prazo interno da Produção de Conteúdo regularizado devolve 2 pontos.' },
    { id: 'publication-risk', kpiId: 'publication', title: 'Salvar veiculações em risco', current: Number(quantitative.overduePublication) || 0, pointsPerItem: 5, unit: 'veiculações', accent: 'high', description: 'Cada veiculação recuperada devolve 5 pontos.' },
    { id: 'execution-gap', kpiId: 'execution', title: 'Reativar clientes sem execução', current: Number(execution.stalled?.length) || 0, pointsPerItem: 5, unit: 'clientes', accent: 'warning', description: 'Cada cliente reativado devolve 5 pontos.' },
    { id: 'overdue-demands', kpiId: 'health', title: 'Atender Solicitações de Demandas vencidas', current: delayedDemands, pointsPerItem: 2, unit: 'solicitações', accent: 'attention', source: 'Monday.com · Solicitações de Demandas · prazo da solicitação', description: 'Cada Solicitação de Demanda vencida atendida devolve 2 pontos.' },
    ...readinessMissions
  ];
  return missions.filter(mission => mission.current > 0).map(mission => ({
    ...mission,
    recoverablePoints: mission.recoverablePoints ?? mission.current * mission.pointsPerItem,
    progressPct: 0,
    status: 'Missão aberta'
  }));
};

export const riskTone = (risk) => Number(risk) >= 40 ? 'critical' : Number(risk) >= 20 ? 'warning' : 'stable';
export const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('finalizado') || normalized.includes('publicado')) return 'complete';
  if (normalized.includes('aguardo') || normalized.includes('alteração') || normalized.includes('falta') || normalized.includes('info')) return 'waiting';
  if (normalized.includes('agendado') || normalized.includes('para agendar')) return 'scheduled';
  return 'active';
};
export const canonicalStage = (stage) => {
  const normalized = String(stage || '').toLowerCase();
  if (normalized.includes('redação')) return 'Redação';
  if (normalized.includes('produção')) return 'Produção';
  if (normalized.includes('design') || normalized.includes('edição') || normalized.includes('criação')) return 'Criação';
  if (normalized.includes('gestão') || normalized.includes('publica') || normalized.includes('saída')) return 'Saídas';
  return stage || 'Não informado';
};
