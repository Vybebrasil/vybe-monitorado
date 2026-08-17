import { randomUUID } from 'crypto';
import { createRecordStore } from '../persistence/record-store.js';

export const IMPACT_RESULTS = ['improved', 'stable', 'worsened', 'inconclusive'];
const impactStore = createRecordStore({
  storeName: 'impacts',
  localFileName: 'executive-impacts.json',
  unavailableCode: 'IMPACT_PERSISTENCE_NOT_CONFIGURED',
  unavailableMessage: 'O Registro de Impacto precisa de um datastore em produção.'
});

const text = (value, maxLength = 2000) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

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

export async function listImpactRecords() {
  const records = await impactStore.list();
  return records.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function saveImpactRecord(payload) {
  const record = createImpactRecord(payload);
  await impactStore.set(record);
  return record;
}

export async function updateImpactRecord(id, payload = {}) {
  const current = await impactStore.get(id);
  if (!current) {
    const error = new Error('[IMPACT_NOT_FOUND] Registro de impacto não encontrado.');
    error.code = 'IMPACT_NOT_FOUND';
    throw error;
  }
  const updated = validateImpactPayload({ ...current, ...payload });
  const now = new Date().toISOString();
  const history = [...(Array.isArray(current.history) ? current.history : [])];
  if (updated.result !== current.result || text(payload.note, 800)) {
    history.push({ result: updated.result, at: now, note: text(payload.note, 800) || `Resultado alterado de ${current.result} para ${updated.result}.` });
  }
  const next = { ...current, ...updated, id: current.id, createdAt: current.createdAt, updatedAt: now, history };
  await impactStore.set(next);
  return next;
}
