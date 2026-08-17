import { randomUUID } from 'crypto';
import { createRecordStore } from '../persistence/record-store.js';

export const DECISION_STATUSES = [
  'decision_needed',
  'directive_defined',
  'impact_tracking',
  'normalized',
  'dismissed'
];

export const DECISION_PRIORITIES = ['critical', 'high', 'medium', 'low'];

const decisionStore = createRecordStore({
  storeName: 'decisions',
  localFileName: 'executive-decisions.json',
  unavailableCode: 'PERSISTENCE_NOT_CONFIGURED',
  unavailableMessage: 'O Registro de Decisões precisa de um datastore em produção.'
});

function text(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function validateDecisionPayload(payload = {}) {
  const record = {
    clientId: text(payload.clientId, 120) || null,
    title: text(payload.title, 240),
    context: text(payload.context, 2000),
    ownerRole: text(payload.ownerRole, 80),
    priority: DECISION_PRIORITIES.includes(payload.priority) ? payload.priority : 'medium',
    status: DECISION_STATUSES.includes(payload.status) ? payload.status : 'decision_needed',
    directive: text(payload.directive, 2000),
    checkpointAt: text(payload.checkpointAt, 80),
    evidence: Array.isArray(payload.evidence)
      ? payload.evidence.slice(0, 10).map(item => ({
          source: text(item?.source, 80),
          detail: text(item?.detail, 500),
          url: text(item?.url, 500) || null
        })).filter(item => item.source || item.detail || item.url)
      : []
  };

  const missing = [];
  if (!record.title) missing.push('title');
  if (!record.context) missing.push('context');
  if (!record.ownerRole) missing.push('ownerRole');
  if (missing.length > 0) {
    const error = new Error(`[INVALID_DECISION] Campos obrigatórios ausentes: ${missing.join(', ')}.`);
    error.code = 'INVALID_DECISION';
    throw error;
  }

  return record;
}

export function createDecisionRecord(payload) {
  const now = new Date().toISOString();
  const decision = validateDecisionPayload(payload);
  return {
    id: `decision-${randomUUID()}`,
    ...decision,
    createdAt: now,
    updatedAt: now,
    history: [{
      status: decision.status,
      at: now,
      note: 'Registro criado no Nexus.'
    }]
  };
}

export async function listDecisionRecords() {
  const records = await decisionStore.list();
  return records.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function saveDecisionRecord(payload) {
  const record = createDecisionRecord(payload);
  await decisionStore.set(record);
  return record;
}

export async function updateDecisionRecord(id, payload = {}) {
  const current = await decisionStore.get(id);
  if (!current) {
    const error = new Error('[DECISION_NOT_FOUND] Decisão executiva não encontrada.');
    error.code = 'DECISION_NOT_FOUND';
    throw error;
  }

  const updated = validateDecisionPayload({ ...current, ...payload });
  const now = new Date().toISOString();
  const statusChanged = updated.status !== current.status;
  const note = text(payload.note, 800);
  const history = [...(Array.isArray(current.history) ? current.history : [])];
  if (statusChanged || note) {
    history.push({
      status: updated.status,
      at: now,
      note: note || `Status alterado de ${current.status} para ${updated.status}.`
    });
  }

  const next = {
    ...current,
    ...updated,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: now,
    history
  };
  await decisionStore.set(next);
  return next;
}
