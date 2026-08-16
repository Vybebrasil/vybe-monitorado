const TERMINAL_DECISIONS = new Set(['normalized', 'dismissed']);
const RESULT_LABELS = { improved: 'Melhorou', stable: 'Estável', worsened: 'Piorou', inconclusive: 'Inconclusivo' };

const latestBy = (records, key) => {
  const map = new Map();
  for (const record of records || []) {
    const value = record?.[key];
    if (!value) continue;
    const previous = map.get(value);
    if (!previous || new Date(record.updatedAt || record.capturedAt || 0) > new Date(previous.updatedAt || previous.capturedAt || 0)) map.set(value, record);
  }
  return map;
};

export function summarizeDecisionEffectiveness(decisions = [], impacts = []) {
  const latestImpacts = latestBy(impacts, 'decisionId');
  const assessed = [...latestImpacts.values()];
  const counts = { improved: 0, stable: 0, worsened: 0, inconclusive: 0 };
  assessed.forEach(impact => { if (counts[impact.result] !== undefined) counts[impact.result] += 1; });
  const total = decisions.length;
  const evaluated = assessed.length;
  const positiveRate = evaluated ? Math.round((counts.improved / evaluated) * 100) : null;
  return {
    totalDecisions: total,
    evaluatedDecisions: evaluated,
    pendingEvaluation: Math.max(0, total - evaluated),
    counts,
    positiveRate,
    negativeCount: counts.worsened,
    label: evaluated === 0 ? 'Sem base de impacto' : positiveRate >= 60 ? 'Diretrizes com sinal positivo' : counts.worsened > 0 ? 'Revisar diretrizes com resultado negativo' : 'Acompanhamento em formação',
    latest: assessed.slice(0, 6).map(impact => ({ decisionId: impact.decisionId, result: impact.result, resultLabel: RESULT_LABELS[impact.result] || impact.result, checkpointAt: impact.checkpointAt || null, updatedAt: impact.updatedAt || impact.createdAt || null }))
  };
}

export function detectPersistentRisks({ decisions = [], impacts = [], healthSnapshots = [] } = {}) {
  const now = Date.now();
  const risks = [];
  decisions.filter(decision => !TERMINAL_DECISIONS.has(decision.status)).forEach(decision => {
    const checkpointAt = decision.checkpointAt ? new Date(decision.checkpointAt).getTime() : null;
    if (!checkpointAt || checkpointAt < now) {
      risks.push({ id: `decision-risk-${decision.id}`, type: 'decision_checkpoint', severity: decision.priority === 'critical' || decision.priority === 'high' ? 'high' : 'medium', title: `Decisão sem checkpoint efetivo: ${decision.title}`, clientId: decision.clientId || null, reason: checkpointAt ? 'O checkpoint está vencido.' : 'A decisão ainda não possui checkpoint.', recommendedAction: 'Registrar impacto ou definir a próxima diretriz.' });
    }
  });
  latestBy(impacts, 'decisionId').forEach(impact => {
    if (impact.result === 'worsened') risks.push({ id: `impact-risk-${impact.id}`, type: 'negative_impact', severity: 'high', title: 'Diretriz com impacto negativo', clientId: impact.clientId || null, reason: impact.observedIndicator || 'O resultado do checkpoint foi classificado como piora.', recommendedAction: 'Reavaliar a diretriz e registrar uma nova decisão executiva.' });
  });
  const byClient = new Map();
  for (const snapshot of healthSnapshots) {
    if (!snapshot.clientId) continue;
    const list = byClient.get(snapshot.clientId) || [];
    list.push(snapshot);
    byClient.set(snapshot.clientId, list);
  }
  byClient.forEach((snapshots, clientId) => {
    const ordered = snapshots.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
    const latest = ordered[0];
    const recent = ordered.slice(0, 3);
    const riskCycles = recent.filter(item => item.status === 'risk' || item.trend === 'declining').length;
    if (latest && riskCycles >= 2) risks.push({ id: `health-risk-${clientId}`, type: 'persistent_health', severity: 'high', title: `Health Score em risco persistente: ${latest.clientName || clientId}`, clientId, reason: `${riskCycles} dos últimos ${recent.length} snapshots indicam risco ou queda.`, recommendedAction: 'Abrir uma decisão executiva e definir checkpoint de recuperação.' });
  });
  return risks.slice(0, 20);
}

export function summarizePortfolioPatterns({ decisions = [], impacts = [], healthSnapshots = [] } = {}) {
  const riskTypes = new Map();
  decisions.forEach(decision => { if (!TERMINAL_DECISIONS.has(decision.status)) riskTypes.set('decisões ativas', (riskTypes.get('decisões ativas') || 0) + 1); });
  impacts.forEach(impact => { if (impact.result === 'worsened') riskTypes.set('impactos negativos', (riskTypes.get('impactos negativos') || 0) + 1); });
  healthSnapshots.forEach(snapshot => { if (snapshot.status === 'risk' || snapshot.trend === 'declining') riskTypes.set('Health Score em queda', (riskTypes.get('Health Score em queda') || 0) + 1); });
  const patterns = [...riskTypes.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return { totalSignals: patterns.reduce((sum, pattern) => sum + pattern.count, 0), patterns, note: patterns.length ? 'Padrões são sinais agregados para decisão executiva; não representam uma fila de produção.' : 'Ainda não há volume histórico suficiente para identificar padrões.' };
}

export function buildExecutiveBriefing({ snapshot = {}, effectiveness, risks = [], patterns } = {}) {
  const topRisk = risks[0];
  const topPattern = patterns?.patterns?.[0];
  return {
    title: 'Briefing Executivo do Nexus',
    generatedAt: new Date().toISOString(),
    opening: snapshot.portfolioStability?.score !== undefined ? `A carteira apresenta estabilidade de ${snapshot.portfolioStability.score}%, com ${snapshot.summary?.executiveRisks || 0} sinais executivos ativos.` : 'A carteira ainda aguarda dados executivos suficientes.',
    priorities: [
      topRisk ? topRisk.recommendedAction : 'Revisar decisões sem checkpoint.',
      effectiveness?.negativeCount ? `Reavaliar ${effectiveness.negativeCount} diretriz(es) com impacto negativo.` : 'Registrar impacto das decisões ainda não avaliadas.',
      topPattern ? `Investigar o padrão recorrente: ${topPattern.label}.` : 'Aumentar a base histórica antes de calibrar previsões.'
    ],
    risks: risks.slice(0, 5),
    nextCheckpoint: 'Definir no Registro de Decisões do Nexus.'
  };
}
