const terminalStatuses = new Set(['normalized', 'dismissed']);

export function buildDecisionMemory({ decisions = [], impacts = [], query = '' } = {}) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const impactsByDecision = new Map();
  impacts.forEach(impact => {
    const current = impactsByDecision.get(impact.decisionId);
    if (!current || new Date(impact.updatedAt || impact.createdAt || 0) > new Date(current.updatedAt || current.createdAt || 0)) impactsByDecision.set(impact.decisionId, impact);
  });
  const records = decisions.map(decision => {
    const impact = impactsByDecision.get(decision.id);
    return {
      id: decision.id,
      title: decision.title,
      context: decision.context,
      directive: decision.directive || null,
      clientId: decision.clientId || null,
      ownerRole: decision.ownerRole || 'CMO/COO',
      status: decision.status,
      priority: decision.priority,
      checkpointAt: decision.checkpointAt || null,
      impact: impact ? { result: impact.result, observedIndicator: impact.observedIndicator || null, updatedAt: impact.updatedAt || impact.createdAt || null } : null,
      historyCount: decision.history?.length || 1,
      createdAt: decision.createdAt || null
    };
  }).filter(record => !normalizedQuery || [record.title, record.context, record.directive, record.clientId, record.ownerRole].filter(Boolean).some(value => String(value).toLowerCase().includes(normalizedQuery)));
  return { records: records.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), total: records.length, query: normalizedQuery, note: 'Memória executiva do Nexus; não é lista de produção.' };
}

export function buildExecutiveScenarios({ decisions = [], impacts = [], healthSnapshots = [], risks = [] } = {}) {
  const activeDecisions = decisions.filter(decision => !terminalStatuses.has(decision.status)).length;
  const negativeImpacts = impacts.filter(impact => impact.result === 'worsened').length;
  const decliningHealth = healthSnapshots.filter(snapshot => snapshot.trend === 'declining' || snapshot.status === 'risk').length;
  const riskCount = risks.length;
  return [
    {
      id: 'recovery-priority',
      title: 'Priorizar recuperação executiva',
      audience: 'CMO/COO',
      question: 'O que merece atenção primeiro se o risco persistir por mais um ciclo?',
      signals: [`${riskCount} riscos executivos atuais`, `${decliningHealth} sinais de Health Score em queda`],
      assumptions: ['Os snapshots disponíveis representam ciclos comparáveis.', 'A liderança consegue definir um checkpoint para os casos críticos.'],
      recommendation: 'Concentrar a próxima reunião nas decisões sem checkpoint e nos clientes com queda persistente.',
      comparison: [{ label: 'Monitorar', implication: 'Manter coleta e revisar no próximo ciclo.' }, { label: 'Intervir', implication: 'Definir diretriz executiva e checkpoint imediato.' }],
      confidence: riskCount > 0 ? 'partial' : 'low'
    },
    {
      id: 'directive-review',
      title: 'Revisar diretrizes com baixo resultado',
      audience: 'CMO',
      question: 'Quais decisões precisam de reavaliação antes de uma nova diretriz?',
      signals: [`${negativeImpacts} impactos negativos registrados`, `${activeDecisions} decisões ainda ativas`],
      assumptions: ['O resultado do impacto foi registrado com evidência suficiente.', 'Decisões semelhantes podem ser comparadas sem inferir causalidade.'],
      recommendation: negativeImpacts > 0 ? 'Revisar as diretrizes com impacto negativo e registrar uma nova hipótese de ação.' : 'Aumentar a base de impactos antes de recalibrar diretrizes.',
      comparison: [{ label: 'Manter diretriz', implication: 'Acompanhar mais um ciclo sem alteração.' }, { label: 'Reavaliar', implication: 'Registrar uma nova hipótese com evidência.' }],
      confidence: negativeImpacts > 0 ? 'partial' : 'low'
    },
    {
      id: 'systemic-pattern',
      title: 'Investigar padrão sistêmico',
      audience: 'COO',
      question: 'Existe um sinal que aparece em vários clientes e pode indicar problema de processo?',
      signals: [`${healthSnapshots.length} snapshots de Health Score disponíveis`, `${activeDecisions} decisões ativas`],
      assumptions: ['As fontes operacionais estão atualizadas.', 'Recorrência de um sinal é hipótese de investigação, não prova de causa.'],
      recommendation: 'Agrupar evidências por causa e cliente antes de decidir uma intervenção de processo.',
      comparison: [{ label: 'Tratar casos isolados', implication: 'Acompanhar clientes individualmente.' }, { label: 'Investigar sistema', implication: 'Buscar causa comum antes de aumentar esforço.' }],
      confidence: healthSnapshots.length >= 3 ? 'partial' : 'low'
    }
  ];
}
