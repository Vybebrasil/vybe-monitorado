const ALERT_LABELS = {
  decision_checkpoint: 'Checkpoint de decisão',
  negative_impact: 'Impacto negativo',
  persistent_health: 'Health Score persistente',
  stale_source: 'Fonte desatualizada'
};

export function buildExecutiveAlerts({ risks = [], effectiveness = {}, freshness = 'live' } = {}) {
  const alerts = risks.map(risk => ({
    id: `alert-${risk.id}`,
    type: risk.type,
    label: ALERT_LABELS[risk.type] || 'Alerta executivo',
    severity: risk.severity || 'medium',
    title: risk.title,
    reason: risk.reason,
    recommendedAction: risk.recommendedAction,
    clientId: risk.clientId || null
  }));
  if (effectiveness.negativeCount > 0 && !alerts.some(alert => alert.type === 'negative_impact')) {
    alerts.push({ id: 'alert-negative-impact-summary', type: 'negative_impact', label: ALERT_LABELS.negative_impact, severity: 'high', title: 'Há decisões com impacto negativo', reason: `${effectiveness.negativeCount} diretriz(es) precisam de reavaliação.`, recommendedAction: 'Abrir o Registro de Impacto no Cockpit.' });
  }
  if (freshness !== 'live') alerts.push({ id: 'alert-stale-source', type: 'stale_source', label: ALERT_LABELS.stale_source, severity: 'medium', title: 'A leitura executiva está parcial', reason: `Freshness informado: ${freshness}.`, recommendedAction: 'Verificar as integrações antes de concluir a reunião.' });
  return alerts.filter((alert, index, list) => list.findIndex(item => item.id === alert.id) === index).slice(0, 20);
}
