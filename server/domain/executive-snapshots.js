import { randomUUID } from 'crypto';
import { createRecordStore } from '../persistence/record-store.js';

const snapshotStore = createRecordStore({
  storeName: 'snapshots',
  localFileName: 'executive-snapshots.json',
  unavailableCode: 'SNAPSHOT_STORE_NOT_CONFIGURED',
  unavailableMessage: 'O histórico executivo precisa de um datastore em produção.'
});

function cleanSnapshot(snapshot = {}) {
  return {
    source: typeof snapshot.source === 'string' ? snapshot.source.slice(0, 120) : 'Nexus',
    capturedAt: snapshot.capturedAt || new Date().toISOString(),
    model: typeof snapshot.model === 'string' ? snapshot.model.slice(0, 80) : 'executive-signal-v1',
    portfolioStability: snapshot.portfolioStability || null,
    summary: snapshot.summary || {},
    quantitative: snapshot.quantitative || {},
    clientRanking: Array.isArray(snapshot.clientRanking) ? snapshot.clientRanking.slice(0, 100) : [],
    portfolioReadiness: snapshot.portfolioReadiness || null,
    sourceQuality: snapshot.sourceQuality || null,
    calendarSignals: snapshot.calendarSignals || null,
    productivity: snapshot.productivity || null,
    executiveRisks: Array.isArray(snapshot.executiveRisks) ? snapshot.executiveRisks.slice(0, 30) : [],
    decisionsNeeded: Array.isArray(snapshot.decisionsNeeded) ? snapshot.decisionsNeeded.slice(0, 20) : []
  };
}

export async function listExecutiveSnapshots({ limit = 90 } = {}) {
  const records = await snapshotStore.list();
  return records.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)).slice(0, Math.min(180, Math.max(1, limit)));
}

export async function saveExecutiveSnapshot(snapshot) {
  const record = {
    id: `snapshot-${randomUUID()}`,
    ...cleanSnapshot(snapshot)
  };
  await snapshotStore.set(record);
  return record;
}

export function summarizeExecutiveDelta(currentSnapshot = null, previousSnapshot = null) {
  if (!currentSnapshot || !previousSnapshot) {
    return { status: 'no_baseline', available: false, message: 'Ainda não existe uma leitura anterior persistida para comparação.' };
  }

  const currentSummary = currentSnapshot.summary || {};
  const previousSummary = previousSnapshot.summary || {};
  const currentScore = Number(currentSnapshot.portfolioStability?.score);
  const previousScore = Number(previousSnapshot.portfolioStability?.score);
  const value = (key, source = currentSummary) => Number(source?.[key]) || 0;
  const fields = [
    ['delayedTeam', 'Atrasos em Produção de Conteúdo'],
    ['delayedClient', 'Veiculações vencidas'],
    ['delayedDemands', 'Solicitações de Demandas vencidas'],
    ['missingPlanning', 'Clientes sem planejamento'],
    ['missingDashboard', 'Clientes sem dashboard/calendário']
  ];
  const changes = fields.map(([key, label]) => ({
    key,
    label,
    current: value(key, currentSummary),
    previous: value(key, previousSummary),
    delta: value(key, currentSummary) - value(key, previousSummary),
    direction: value(key, currentSummary) - value(key, previousSummary) < 0 ? 'improving' : value(key, currentSummary) - value(key, previousSummary) > 0 ? 'worsening' : 'stable'
  }));
  const currentStalled = value('stalledClients', currentSummary);
  const previousStalled = value('stalledClients', previousSummary);
  changes.splice(2, 0, {
    key: 'stalledClients',
    label: 'Clientes sem execução',
    current: currentStalled,
    previous: previousStalled,
    delta: currentStalled - previousStalled,
    direction: currentStalled - previousStalled < 0 ? 'improving' : currentStalled - previousStalled > 0 ? 'worsening' : 'stable'
  });

  return {
    status: 'available',
    available: true,
    capturedAt: currentSnapshot.capturedAt || null,
    previousCapturedAt: previousSnapshot.capturedAt || null,
    score: {
      current: Number.isFinite(currentScore) ? currentScore : null,
      previous: Number.isFinite(previousScore) ? previousScore : null,
      delta: Number.isFinite(currentScore) && Number.isFinite(previousScore) ? currentScore - previousScore : null,
      direction: Number.isFinite(currentScore) && Number.isFinite(previousScore) ? (currentScore > previousScore ? 'improving' : currentScore < previousScore ? 'worsening' : 'stable') : 'not_available'
    },
    changes
  };
}

export function summarizeSnapshotTrend(snapshots = [], now = new Date()) {
  const current = snapshots[0]?.portfolioStability?.score ?? null;
  const previous = snapshots[1]?.portfolioStability?.score ?? null;
  const delta = current !== null && previous !== null ? current - previous : null;
  const capturedAt = snapshots[0]?.capturedAt || null;
  const ageDays = capturedAt ? Math.max(0, Math.floor((now.getTime() - new Date(capturedAt).getTime()) / 86400000)) : null;
  const countWithinDays = days => snapshots.filter(snapshot => {
    const capturedTime = new Date(snapshot.capturedAt).getTime();
    if (Number.isNaN(capturedTime)) return false;
    return Math.floor(Math.max(0, now.getTime() - capturedTime) / 86400000) <= days;
  }).length;
  return {
    current,
    previous,
    delta,
    direction: delta === null ? 'not_available' : delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable',
    ageDays,
    windows: {
      '7d': countWithinDays(7),
      '30d': countWithinDays(30),
      '90d': countWithinDays(90)
    }
  };
}
