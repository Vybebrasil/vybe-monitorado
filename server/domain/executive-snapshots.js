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
    demandItems: Array.isArray(snapshot.demandItems) ? snapshot.demandItems.slice(0, 200) : [],
    delayedDemandItems: Array.isArray(snapshot.delayedDemandItems) ? snapshot.delayedDemandItems.slice(0, 200) : [],
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

export function shouldPersistExecutiveSnapshot(currentSnapshot = {}, previousSnapshot = null, {
  minIntervalSeconds = Number(process.env.NEXUS_SNAPSHOT_MIN_INTERVAL_SECONDS) || 300
} = {}) {
  if (!previousSnapshot) return { save: true, reason: 'no_baseline' };
  const currentVersion = currentSnapshot?.sourceQuality?.sync?.version ?? currentSnapshot?.sourceQuality?.version ?? null;
  const previousVersion = previousSnapshot?.sourceQuality?.sync?.version ?? previousSnapshot?.sourceQuality?.version ?? null;
  const currentTime = new Date(currentSnapshot.capturedAt || 0).getTime();
  const previousTime = new Date(previousSnapshot.capturedAt || 0).getTime();
  const elapsedSeconds = Number.isFinite(currentTime) && Number.isFinite(previousTime) && currentTime >= previousTime
    ? (currentTime - previousTime) / 1000
    : null;
  if (currentVersion !== null && previousVersion !== null && String(currentVersion) === String(previousVersion)) {
    return { save: false, reason: 'same_source_version', sourceVersion: currentVersion, elapsedSeconds };
  }
  if (elapsedSeconds !== null && elapsedSeconds < Math.max(0, minIntervalSeconds)) {
    return { save: false, reason: 'minimum_interval', sourceVersion: currentVersion, elapsedSeconds, minIntervalSeconds };
  }
  return { save: true, reason: 'source_changed_or_interval_elapsed', sourceVersion: currentVersion, elapsedSeconds };
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

const numericOrNull = value => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

function snapshotSeriesPoint(snapshot = {}) {
  const summary = snapshot.summary || {};
  const quantitative = snapshot.quantitative || {};
  const productivity = snapshot.productivity || {};
  const activeItems = numericOrNull(productivity.activeItems ?? quantitative.activeItems);
  const completedItems = numericOrNull(productivity.completedItems ?? quantitative.completedItems);
  const delayedProduction = numericOrNull(summary.delayedTeam ?? quantitative.overdueInternal);
  const overdueDemands = numericOrNull(summary.delayedDemands);
  const readyItems = numericOrNull(productivity.readyToSchedule);
  const openDemands = numericOrNull(Array.isArray(snapshot.demandItems) ? snapshot.demandItems.length : null);
  const clientRanking = Array.isArray(snapshot.clientRanking) ? snapshot.clientRanking : [];
  const totalScope = activeItems !== null && completedItems !== null ? activeItems + completedItems : null;
  const ratio = (value, denominator) => value !== null && denominator > 0 ? Number(((value / denominator) * 100).toFixed(1)) : null;
  return {
    capturedAt: snapshot.capturedAt || null,
    sourceVersion: snapshot.sourceQuality?.sync?.version ?? snapshot.sourceQuality?.version ?? null,
    score: numericOrNull(snapshot.portfolioStability?.score),
    activeItems,
    completedItems,
    delayedProduction,
    overdueDemands,
    exposedClients: numericOrNull(summary.exposedClients ?? clientRanking.filter(item => Number(item.delayedItems) > 0).length),
    stalledClients: numericOrNull(summary.stalledClients ?? snapshot.portfolioExecution?.stalled?.length),
    openDemands,
    readyItems,
    completionPct: ratio(completedItems, totalScope),
    delayedProductionPct: ratio(delayedProduction, activeItems),
    readyPct: ratio(readyItems, activeItems),
    overdueDemandsPct: ratio(overdueDemands, openDemands)
  };
}

function comparePointToWindow(points, days, now) {
  const cutoff = now.getTime() - days * 86400000;
  const inWindow = points.filter(point => point.capturedAt && new Date(point.capturedAt).getTime() >= cutoff);
  if (inWindow.length < 2) return { available: false, points: inWindow.length, baseline: null, current: inWindow.at(-1) || null, message: `Histórico insuficiente para comparação de ${days} dias.` };
  const baseline = inWindow[0];
  const current = inWindow.at(-1);
  const delta = {};
  for (const key of ['score', 'activeItems', 'completedItems', 'delayedProduction', 'overdueDemands', 'openDemands', 'exposedClients', 'stalledClients', 'readyItems', 'completionPct', 'delayedProductionPct', 'readyPct', 'overdueDemandsPct']) {
    delta[key] = baseline[key] !== null && current[key] !== null ? current[key] - baseline[key] : null;
  }
  return { available: true, points: inWindow.length, baseline, current, delta, message: null };
}

export function buildExecutiveTimeSeries(snapshots = [], now = new Date()) {
  const points = snapshots
    .filter(snapshot => snapshot?.capturedAt && !Number.isNaN(new Date(snapshot.capturedAt).getTime()))
    .sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt))
    .map(snapshotSeriesPoint);
  const windows = { '7d': comparePointToWindow(points, 7, now), '30d': comparePointToWindow(points, 30, now), '90d': comparePointToWindow(points, 90, now) };
  return {
    available: points.length >= 2,
    status: points.length >= 2 ? 'available' : 'no_baseline',
    points,
    windows,
    message: points.length >= 2 ? null : 'Ainda não há pontos históricos suficientes para desenhar uma tendência confiável.'
  };
}
