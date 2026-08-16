import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const isProduction = () => process.env.NODE_ENV === 'production';
const dataDirectory = () => process.env.NEXUS_LOCAL_DATA_DIR || join(process.cwd(), '.data');
const snapshotsPath = () => join(dataDirectory(), 'executive-snapshots.json');

function unavailable() {
  const error = new Error('[SNAPSHOT_STORE_NOT_CONFIGURED] O histórico executivo precisa de um datastore em produção.');
  error.code = 'SNAPSHOT_STORE_NOT_CONFIGURED';
  return error;
}

function cleanSnapshot(snapshot = {}) {
  return {
    source: typeof snapshot.source === 'string' ? snapshot.source.slice(0, 120) : 'Nexus',
    capturedAt: snapshot.capturedAt || new Date().toISOString(),
    model: typeof snapshot.model === 'string' ? snapshot.model.slice(0, 80) : 'executive-signal-v1',
    portfolioStability: snapshot.portfolioStability || null,
    summary: snapshot.summary || {},
    executiveRisks: Array.isArray(snapshot.executiveRisks) ? snapshot.executiveRisks.slice(0, 30) : [],
    decisionsNeeded: Array.isArray(snapshot.decisionsNeeded) ? snapshot.decisionsNeeded.slice(0, 20) : []
  };
}

async function readLocal() {
  if (isProduction()) throw unavailable();
  try {
    const content = await readFile(snapshotsPath(), 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocal(records) {
  if (isProduction()) throw unavailable();
  await mkdir(dataDirectory(), { recursive: true });
  const temporaryPath = `${snapshotsPath()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records, null, 2), 'utf8');
  await rename(temporaryPath, snapshotsPath());
}

export async function listExecutiveSnapshots({ limit = 90 } = {}) {
  const records = await readLocal();
  return records.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)).slice(0, Math.min(180, Math.max(1, limit)));
}

export async function saveExecutiveSnapshot(snapshot) {
  const record = {
    id: `snapshot-${randomUUID()}`,
    ...cleanSnapshot(snapshot)
  };
  const records = await readLocal();
  records.push(record);
  await writeLocal(records);
  return record;
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
