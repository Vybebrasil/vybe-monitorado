const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)));

const scoreStatus = score => score >= 75 ? 'healthy' : score >= 50 ? 'attention' : 'risk';
const statusLabel = status => ({ healthy: 'SAUDÁVEL', attention: 'SOB OBSERVAÇÃO', risk: 'RISCO EXECUTIVO' }[status]);

export function buildClientHealthScore({
  clientName,
  daysSinceLastMeeting,
  openPosts = 0,
  delayedPosts = 0,
  delayedDemands = 0,
  missingPlanning = false,
  missingDashboard = false,
  auditStatus = 'not_integrated',
  previousScore = null,
  capturedAt = new Date().toISOString()
}) {
  const relationshipScore = daysSinceLastMeeting === null || daysSinceLastMeeting === undefined
    ? 35
    : daysSinceLastMeeting >= 90 ? 15
      : daysSinceLastMeeting >= 30 ? 35
        : daysSinceLastMeeting >= 15 ? 65
          : 100;
  const operationalScore = clamp(100 - delayedPosts * 8 - delayedDemands * 12 - Math.max(0, openPosts - 20));
  const strategyScore = missingPlanning ? 45 : 100;
  const dataScore = missingDashboard ? 50 : 100;
  const evidenceScore = auditStatus === 'validated' ? 100 : auditStatus === 'pending_validation' ? 45 : 60;
  const score = clamp(
    relationshipScore * 0.3 +
    operationalScore * 0.3 +
    strategyScore * 0.2 +
    dataScore * 0.1 +
    evidenceScore * 0.1
  );
  const status = scoreStatus(score);
  const confidence = auditStatus === 'validated' && !missingPlanning && !missingDashboard ? 'high' : auditStatus === 'not_integrated' || missingPlanning || missingDashboard ? 'partial' : 'medium';
  const delta = typeof previousScore === 'number' ? score - previousScore : null;
  const trend = delta === null ? 'not_available' : delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable';

  return {
    model: 'client-health-v2',
    score,
    status,
    label: statusLabel(status),
    confidence,
    trend,
    delta,
    period: { windowDays: 30, reference: 'current executive snapshot' },
    capturedAt,
    explanation: 'Score executivo explicável. Não representa receita, margem ou satisfação sem essas fontes integradas.',
    factors: [
      {
        key: 'relationship',
        label: 'Relacionamento',
        score: clamp(relationshipScore),
        weight: 0.3,
        reason: daysSinceLastMeeting === null || daysSinceLastMeeting === undefined
          ? 'Não há reunião anterior registrada.'
          : `${daysSinceLastMeeting} dias desde a última reunião.`,
        source: 'Monday.com + Google Calendar'
      },
      {
        key: 'operations',
        label: 'Previsibilidade operacional',
        score: clamp(operationalScore),
        weight: 0.3,
        reason: `${delayedPosts} conteúdos atrasados, ${delayedDemands} demandas vencidas e ${openPosts} conteúdos abertos.`,
        source: 'Monday.com'
      },
      {
        key: 'strategy',
        label: 'Prontidão estratégica',
        score: clamp(strategyScore),
        weight: 0.2,
        reason: missingPlanning ? 'Planejamento estratégico não identificado.' : 'Planejamento estratégico identificado na fonte operacional.',
        source: 'Monday.com'
      },
      {
        key: 'data',
        label: 'Cobertura de dados',
        score: clamp(dataScore),
        weight: 0.1,
        reason: missingDashboard ? 'Dashboard pendente ou desatualizado.' : 'Dashboard identificado na fonte operacional.',
        source: 'Monday.com'
      },
      {
        key: 'evidence',
        label: 'Evidência de auditoria',
        score: clamp(evidenceScore),
        weight: 0.1,
        reason: auditStatus === 'validated' ? 'Auditoria validada humanamente.' : 'Auditoria ainda não está validada no datastore executivo.',
        source: auditStatus === 'validated' ? 'Nexus Audit Registry' : 'Migração pendente',
        capturedAt
      }
    ]
  };
}
