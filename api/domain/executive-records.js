import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export const DECISION_STATUSES = [
  'decision_needed',
  'directive_defined',
  'impact_tracking',
  'normalized',
  'dismissed'
];

export const DECISION_PRIORITIES = ['critical', 'high', 'medium', 'low'];

const isProduction = process.env.NODE_ENV === 'production';
const dataDirectory = process.env.NEXUS_LOCAL_DATA_DIR || join(process.cwd(), '.data');
const decisionsPath = join(dataDirectory, 'executive-decisions.json');

function text(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function decisionStoreUnavailable() {
  const error = new Error('[PERSISTENCE_NOT_CONFIGURED] O Registro de Decisões está disponível apenas localmente até a conexão com um datastore versionado.');
  error.code = 'PERSISTENCE_NOT_CONFIGURED';
  return error;
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

async function readLocalRecords() {
  if (isProduction) throw decisionStoreUnavailable();
  try {
    const content = await readFile(decisionsPath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalRecords(records) {
  if (isProduction) throw decisionStoreUnavailable();
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${decisionsPath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records, null, 2), 'utf8');
  await rename(temporaryPath, decisionsPath);
}

export async function listDecisionRecords() {
  const records = await readLocalRecords();
  return records.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function saveDecisionRecord(payload) {
  const record = createDecisionRecord(payload);
  const records = await readLocalRecords();
  records.push(record);
  await writeLocalRecords(records);
  return record;
}

export async function updateDecisionRecord(id, payload = {}) {
  const records = await readLocalRecords();
  const index = records.findIndex(record => record.id === id);
  if (index === -1) {
    const error = new Error('[DECISION_NOT_FOUND] Decisão executiva não encontrada.');
    error.code = 'DECISION_NOT_FOUND';
    throw error;
  }

  const current = records[index];
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
  records[index] = next;
  await writeLocalRecords(records);
  return next;
}
