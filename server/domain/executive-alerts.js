const ALERT_LIFECYCLE = ['detected', 'reviewed', 'action_defined', 'monitoring', 'normalized', 'dismissed'];
const ALERT_LABELS = {
  decision_checkpoint: 'Checkpoint de decisão',
  negative_impact: 'Impacto negativo',
  persistent_health: 'Health Score persistente',
  stale_source: 'Fonte desatualizada',
  operational_overdue: 'Atraso operacional',
  stage_concentration: 'Concentração por etapa',
  client_no_execution: 'Cliente sem execução',
  live_update: 'Atualização do Vybe Painel'
};

function liveAlert({ id, type, severity, title, reason, recommendedAction, clientId = null } = {}) {
  return { id, type, label: ALERT_LABELS[type] || 'Alerta operacional', severity, title, reason, recommendedAction, clientId, lifecycle: 'detected', lifecycleHistory: [{ status: 'detected', at: new Date().toISOString() }] };
}

export function buildExecutiveAlerts({ risks = [], effectiveness = {}, freshness = 'live', snapshot = {}, liveChanges = null } = {}) {
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

  const summary = snapshot?.summary || {};
  const productivity = snapshot?.productivity || {};
  const execution = snapshot?.portfolioExecution || {};
  const delayedProduction = Number(summary.delayedTeam ?? productivity.delayedItems ?? 0) || 0;
  const delayedDemands = Number(summary.delayedDemands || 0) || 0;
  const stalledClients = Array.isArray(execution.stalled) ? execution.stalled : [];
  if (delayedProduction > 0) alerts.push(liveAlert({ id: 'alert-live-production-overdue', type: 'operational_overdue', severity: delayedProduction >= 7 ? 'high' : 'medium', title: `${delayedProduction} atraso(s) de Produção de Conteúdo`, reason: 'Itens com prazo interno ou veiculação vencidos na leitura live.', recommendedAction: 'Abrir as evidências de Produção e separar atraso interno de veiculação.' }));
  if (delayedDemands > 0) alerts.push(liveAlert({ id: 'alert-live-demand-overdue', type: 'operational_overdue', severity: delayedDemands >= 7 ? 'high' : 'medium', title: `${delayedDemands} Solicitação(ões) de Demandas vencida(s)`, reason: 'Demandas abertas ultrapassaram o prazo observado na leitura atual.', recommendedAction: 'Abrir o contexto Demandas e definir responsável e próximo checkpoint.' }));
  stalledClients.slice(0, 5).forEach(client => alerts.push(liveAlert({ id: `alert-live-stalled-${String(client.client || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, type: 'client_no_execution', severity: 'medium', title: `${client.client || 'Cliente'} sem execução`, reason: 'Cliente ativo sem conteúdo em produção e sem Solicitação de Demanda aberta.', recommendedAction: 'Abrir o contexto do cliente e confirmar se está em onboarding ou aguardando decisão.', clientId: client.client || null })));
  const stages = Array.isArray(productivity.byStage) ? productivity.byStage : [];
  stages.filter(stage => Number(stage.pctOfActive) >= 40 && Number(stage.count) >= 3).slice(0, 3).forEach(stage => alerts.push(liveAlert({ id: `alert-live-stage-${String(stage.stage || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, type: 'stage_concentration', severity: 'medium', title: `${stage.stage || 'Uma etapa'} concentra ${Number(stage.pctOfActive) || 0}% do fluxo`, reason: `${Number(stage.count) || 0} itens ativos estão concentrados nesta etapa.`, recommendedAction: 'Verificar capacidade, bloqueios e distribuição antes de assumir novas entregas.' })));
  if (liveChanges?.available) alerts.push(liveAlert({ id: `alert-live-update-${liveChanges.version || 'current'}`, type: 'live_update', severity: 'low', title: `${Number(liveChanges.count) || 0} mudança(s) recebida(s) do Vybe Painel`, reason: 'O espelho operacional entregou mudanças desde a última versão observada.', recommendedAction: 'Abrir História & Logs para revisar os itens afetados.' }));
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
