import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export const IMPACT_RESULTS = ['improved', 'stable', 'worsened', 'inconclusive'];
const isProduction = () => process.env.NODE_ENV === 'production';
const dataDirectory = () => process.env.NEXUS_LOCAL_DATA_DIR || join(process.cwd(), '.data');
const impactsPath = () => join(dataDirectory(), 'executive-impacts.json');

const text = (value, maxLength = 2000) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

function persistenceUnavailable() {
  const error = new Error('[IMPACT_PERSISTENCE_NOT_CONFIGURED] O Registro de Impacto precisa de um datastore em produção.');
  error.code = 'IMPACT_PERSISTENCE_NOT_CONFIGURED';
  return error;
}

export function validateImpactPayload(payload = {}) {
  const record = {
    decisionId: text(payload.decisionId, 160),
    clientId: text(payload.clientId, 160) || null,
    baseline: text(payload.baseline, 2000),
    observedIndicator: text(payload.observedIndicator, 500),
    result: IMPACT_RESULTS.includes(payload.result) ? payload.result : 'inconclusive',
    evidence: Array.isArray(payload.evidence) ? payload.evidence.slice(0, 10).map(item => ({
      source: text(item?.source, 120),
      detail: text(item?.detail, 1000),
      url: text(item?.url, 600) || null
    })).filter(item => item.source || item.detail || item.url) : [],
    checkpointAt: text(payload.checkpointAt, 80),
    notes: text(payload.notes, 2000)
  };
  const missing = [];
  if (!record.decisionId) missing.push('decisionId');
  if (!record.observedIndicator) missing.push('observedIndicator');
  if (missing.length) {
    const error = new Error(`[INVALID_IMPACT] Campos obrigatórios ausentes: ${missing.join(', ')}.`);
    error.code = 'INVALID_IMPACT';
    throw error;
  }
  return record;
}

export function createImpactRecord(payload) {
  const now = new Date().toISOString();
  const impact = validateImpactPayload(payload);
  return {
    id: `impact-${randomUUID()}`,
    ...impact,
    createdAt: now,
    updatedAt: now,
    history: [{ result: impact.result, at: now, note: 'Registro de impacto criado no Nexus.' }]
  };
}

async function readLocal() {
  if (isProduction()) throw persistenceUnavailable();
  try {
    const content = await readFile(impactsPath(), 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocal(records) {
  if (isProduction()) throw persistenceUnavailable();
  await mkdir(dataDirectory(), { recursive: true });
  const path = impactsPath();
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

export async function listImpactRecords() {
  const records = await readLocal();
  return records.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function saveImpactRecord(payload) {
  const record = createImpactRecord(payload);
  const records = await readLocal();
  records.push(record);
  await writeLocal(records);
  return record;
}

export async function updateImpactRecord(id, payload = {}) {
  const records = await readLocal();
  const index = records.findIndex(record => record.id === id);
  if (index === -1) {
    const error = new Error('[IMPACT_NOT_FOUND] Registro de impacto não encontrado.');
    error.code = 'IMPACT_NOT_FOUND';
    throw error;
  }
  const current = records[index];
  const updated = validateImpactPayload({ ...current, ...payload });
  const now = new Date().toISOString();
  const history = [...(Array.isArray(current.history) ? current.history : [])];
  if (updated.result !== current.result || text(payload.note, 800)) {
    history.push({ result: updated.result, at: now, note: text(payload.note, 800) || `Resultado alterado de ${current.result} para ${updated.result}.` });
  }
  const next = { ...current, ...updated, id: current.id, createdAt: current.createdAt, updatedAt: now, history };
  records[index] = next;
  await writeLocal(records);
  return next;
}
