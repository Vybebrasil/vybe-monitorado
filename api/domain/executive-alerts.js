const ALERT_LIFECYCLE = ['detected', 'reviewed', 'action_defined', 'monitoring', 'normalized', 'dismissed'];
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
    clientId: risk.clientId || null,
    lifecycle: risk.lifecycle || 'detected',
    lifecycleHistory: risk.lifecycleHistory || [{ status: risk.lifecycle || 'detected', at: new Date().toISOString() }]
  }));
  if (effectiveness.negativeCount > 0 && !alerts.some(alert => alert.type === 'negative_impact')) {
    alerts.push({ id: 'alert-negative-impact-summary', type: 'negative_impact', label: ALERT_LABELS.negative_impact, severity: 'high', title: 'Há decisões com impacto negativo', reason: `${effectiveness.negativeCount} diretriz(es) precisam de reavaliação.`, recommendedAction: 'Abrir o Registro de Impacto no Cockpit.' });
  }
  if (freshness !== 'live') alerts.push({ id: 'alert-stale-source', type: 'stale_source', label: ALERT_LABELS.stale_source, severity: 'medium', title: 'A leitura executiva está parcial', reason: `Freshness informado: ${freshness}.`, recommendedAction: 'Verificar as integrações antes de concluir a reunião.' });
  return alerts.filter((alert, index, list) => list.findIndex(item => item.id === alert.id) === index).slice(0, 20);
}

export function transitionExecutiveAlert(alert, nextLifecycle, note = '') {
  if (!ALERT_LIFECYCLE.includes(nextLifecycle)) {
    const error = new Error(`Ciclo de alerta inválido: ${nextLifecycle}`);
    error.code = 'INVALID_ALERT_LIFECYCLE';
    throw error;
  }
  return { ...alert, lifecycle: nextLifecycle, lifecycleHistory: [...(alert.lifecycleHistory || []), { status: nextLifecycle, note: String(note || '').trim() || null, at: new Date().toISOString() }] };
}
