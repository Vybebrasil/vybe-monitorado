import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const isProduction = () => process.env.NODE_ENV === 'production';
const dataDirectory = () => process.env.NEXUS_LOCAL_DATA_DIR || join(process.cwd(), '.data');
const snapshotsPath = () => join(dataDirectory(), 'client-health-snapshots.json');

function unavailable() {
  const error = new Error('[HEALTH_SNAPSHOT_STORE_NOT_CONFIGURED] O histórico de Health Score precisa de um datastore em produção.');
  error.code = 'HEALTH_SNAPSHOT_STORE_NOT_CONFIGURED';
  return error;
}

const safeNumber = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null;

export function createHealthSnapshot({ clientId, clientName, healthScore, capturedAt = new Date().toISOString() }) {
  return {
    id: `health-${randomUUID()}`,
    clientId: String(clientId || '').slice(0, 160),
    clientName: String(clientName || clientId || '').slice(0, 200),
    model: healthScore?.model || 'client-health-v2',
    score: safeNumber(healthScore?.score),
    status: healthScore?.status || 'attention',
    confidence: healthScore?.confidence || 'partial',
    trend: healthScore?.trend || 'not_available',
    factors: Array.isArray(healthScore?.factors) ? healthScore.factors.slice(0, 10) : [],
    capturedAt
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
  const path = snapshotsPath();
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

export async function saveHealthSnapshot(payload) {
  const snapshot = createHealthSnapshot(payload);
  if (!snapshot.clientId || snapshot.score === null) return null;
  const records = await readLocal();
  const sameCapture = records.findIndex(item => item.clientId === snapshot.clientId && item.capturedAt.slice(0, 16) === snapshot.capturedAt.slice(0, 16));
  if (sameCapture >= 0) {
    records[sameCapture] = { ...records[sameCapture], ...snapshot, id: records[sameCapture].id };
  } else {
    records.push(snapshot);
  }
  await writeLocal(records);
  return snapshot;
}

export async function listHealthSnapshots(clientId, { limit = 90 } = {}) {
  const records = await readLocal();
  return records.filter(item => !clientId || item.clientId === clientId).sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)).slice(0, limit);
}

export function summarizeHealthTrend(records = []) {
  const sorted = [...records].sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
  const current = sorted[0]?.score ?? null;
  const previous = sorted[1]?.score ?? null;
  const delta = current !== null && previous !== null ? current - previous : null;
  return {
    current,
    previous,
    delta,
    direction: delta === null ? 'not_available' : delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable',
    snapshots: sorted.length
  };
}
