import { createHash, randomUUID } from 'node:crypto';
import { createRecordStore } from '../persistence/record-store.js';

const eventStore = createRecordStore({
  storeName: 'events',
  localFileName: 'executive-events.json',
  unavailableCode: 'EVENT_PERSISTENCE_NOT_CONFIGURED',
  unavailableMessage: 'A timeline executiva precisa de um datastore em produção.'
});

export const EXECUTIVE_EVENT_TYPES = Object.freeze([
  'item_entered_scope',
  'item_left_scope',
  'status_changed',
  'deadline_changed',
  'delay_started',
  'delay_resolved',
  'responsible_changed',
  'stage_changed',
  'operational_update',
  'snapshot_captured'
]);

const text = (value, maxLength = 600) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
const eventDate = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : new Date().toISOString();

function sourceLabel(value) {
  if (value === 'Solicitações de Demandas') return value;
  if (value === 'Vybe Painel · espelho operacional') return value;
  return 'Produção de Conteúdo';
}

function eventId({ type, source, itemId, capturedAt, previousValue = '', currentValue = '' }) {
  const signature = [type, source, itemId, capturedAt.slice(0, 16), previousValue, currentValue].join('|');
  return `event-${createHash('sha1').update(signature).digest('hex').slice(0, 24)}`;
}

export function compactSnapshotItem(row = {}, source = 'Produção de Conteúdo') {
  const itemId = row.id ?? row.itemId;
  if (!itemId) return null;
  return {
    id: String(itemId),
    name: text(row.name || row.itemName || row.postName, 240) || `Item ${itemId}`,
    source: sourceLabel(row.source || source),
    client: text(row.client || row.cliente || row.clientName, 180) || 'Sem Cliente',
    responsible: text(row.responsible || row.responsavel, 240) || 'Sem responsável',
    stage: text(row.stage || row.etapa || row.quadro, 120) || 'Sem etapa',
    status: text(row.status, 120) || 'Sem status',
    dueDate: text(row.dueDate || row.prazo, 40),
    publicationDate: text(row.veiculacao, 40),
    isCompleted: Boolean(row.isCompleted),
    isReady: Boolean(row.isReady),
    isDelayed: Boolean(row.isDelayed || row.isDelayedPrazo || row.isDelayedVeiculacao)
  };
}

export function compactSnapshotItems(snapshot = {}) {
  const production = Array.isArray(snapshot.itemRows)
    ? snapshot.itemRows.map(row => compactSnapshotItem(row, 'Produção de Conteúdo')).filter(Boolean)
    : [];
  const demands = Array.isArray(snapshot.demandItemRows)
    ? snapshot.demandItemRows.map(row => compactSnapshotItem(row, 'Solicitações de Demandas')).filter(Boolean)
    : [];
  return [...production, ...demands];
}

export function createExecutiveEvent(payload = {}) {
  const type = EXECUTIVE_EVENT_TYPES.includes(payload.type) ? payload.type : 'snapshot_captured';
  const capturedAt = eventDate(payload.capturedAt || payload.at);
  const source = sourceLabel(payload.source);
  const itemId = payload.itemId ? String(payload.itemId) : null;
  const previousValue = text(payload.previousValue, 240);
  const currentValue = text(payload.currentValue, 240);
  const event = {
    id: payload.id || eventId({ type, source, itemId: itemId || 'portfolio', capturedAt, previousValue, currentValue }) || `event-${randomUUID()}`,
    type,
    capturedAt,
    source,
    itemId,
    itemName: text(payload.itemName, 240) || null,
    client: text(payload.client, 180) || null,
    responsible: text(payload.responsible, 240) || null,
    stage: text(payload.stage, 120) || null,
    severity: ['critical', 'high', 'medium', 'low'].includes(payload.severity) ? payload.severity : 'medium',
    title: text(payload.title, 240) || 'Evento executivo observado',
    detail: text(payload.detail, 800),
    previousValue: previousValue || null,
    currentValue: currentValue || null,
    evidenceUrl: text(payload.evidenceUrl, 600) || null,
    decisionId: text(payload.decisionId, 160) || null,
    lifecycle: ['detected', 'reviewed', 'action_defined', 'monitoring', 'normalized', 'dismissed'].includes(payload.lifecycle) ? payload.lifecycle : 'detected',
    createdAt: eventDate(payload.createdAt || capturedAt)
  };
  return event;
}

function eventFor({ type, current, previous, capturedAt, title, detail, previousValue, currentValue, severity = 'medium' }) {
  const source = current?.source || previous?.source || 'Produção de Conteúdo';
  const itemId = current?.id || previous?.id;
  return createExecutiveEvent({
    id: eventId({ type, source, itemId, capturedAt, previousValue, currentValue }),
    type,
    capturedAt,
    source,
    itemId,
    itemName: current?.name || previous?.name,
    client: current?.client || previous?.client,
    responsible: current?.responsible || previous?.responsible,
    stage: current?.stage || previous?.stage,
    title,
    detail,
    previousValue,
    currentValue,
    severity,
    evidenceUrl: itemId ? `https://gestaovybes-team.monday.com/boards/${source === 'Solicitações de Demandas' ? '8385559107' : '7829537690'}/pulses/${itemId}` : null
  });
}

function rawColumn(raw, id) {
  return Array.isArray(raw?.column_values) ? raw.column_values.find(column => column?.id === id) || null : null;
}

function rawColumnChangedAt(column) {
  if (!column?.value) return null;
  try {
    const parsed = JSON.parse(column.value);
    return parsed?.changed_at || null;
  } catch {
    return null;
  }
}

export function deriveOperationalMirrorEvents(changes = []) {
  return changes.slice(0, 300).map(change => {
    const raw = change?.raw || {};
    const itemId = change?.item_id || raw.id;
    const statusColumn = rawColumn(raw, 'status');
    const dueColumn = rawColumn(raw, 'data');
    const publicationColumn = rawColumn(raw, 'data__1');
    const status = text(statusColumn?.text, 120) || 'Sem status';
    const changedAt = eventDate(change?.source_updated_at || raw.updated_at || rawColumnChangedAt(statusColumn) || change?.created_at);
    const operation = change?.operation === 'delete' || change?.deleted === true ? 'delete' : 'upsert';
    const name = text(raw.name, 240) || `Item ${itemId}`;
    const fields = [
      statusColumn ? `status atual: ${status}` : null,
      dueColumn?.text ? `prazo: ${dueColumn.text}` : null,
      publicationColumn?.text ? `veiculação: ${publicationColumn.text}` : null
    ].filter(Boolean);
    return createExecutiveEvent({
      id: change?.change_id ? `mirror-event-${change.change_id}` : eventId({ type: 'operational_update', source: 'Vybe Painel · espelho operacional', itemId, capturedAt: changedAt }),
      type: 'operational_update',
      capturedAt: changedAt,
      createdAt: change?.created_at || changedAt,
      source: 'Vybe Painel · espelho operacional',
      itemId,
      itemName: name,
      client: rawColumn(raw, 'lista_suspensa_mkmqnjbv')?.text || null,
      responsible: rawColumn(raw, 'person')?.text || null,
      stage: raw?.group?.title || null,
      severity: status.toLowerCase().includes('finalizado') || status.toLowerCase().includes('publicado') ? 'low' : 'medium',
      title: operation === 'delete' ? 'Item removido do espelho operacional' : 'Atualização recebida do Vybe Painel',
      detail: operation === 'delete' ? `${name} foi removido do espelho do Vybe Painel.` : `${name} foi atualizado no Vybe Painel${fields.length ? ` (${fields.join(' · ')}).` : '.'}`,
      currentValue: operation === 'delete' ? 'fora do espelho' : status,
      evidenceUrl: itemId ? `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${itemId}` : null
    });
  });
}

export function deriveSnapshotEvents(previousSnapshot = null, currentSnapshot = {}, capturedAt = currentSnapshot.capturedAt) {
  if (!previousSnapshot || !Array.isArray(previousSnapshot.itemStates) || !Array.isArray(currentSnapshot.itemStates)) return [];
  const previous = new Map(previousSnapshot.itemStates.map(item => [`${item.source}:${item.id}`, item]));
  const current = new Map(currentSnapshot.itemStates.map(item => [`${item.source}:${item.id}`, item]));
  const events = [];

  for (const [key, next] of current) {
    const before = previous.get(key);
    if (!before) {
      events.push(eventFor({ type: 'item_entered_scope', current: next, previous: null, capturedAt, title: 'Item entrou no recorte operacional', detail: `${next.name} passou a aparecer na leitura atual.`, currentValue: next.status }));
      continue;
    }
    if (before.status !== next.status) events.push(eventFor({ type: 'status_changed', current: next, previous: before, capturedAt, title: 'Status alterado', detail: `${next.name}: ${before.status} → ${next.status}.`, previousValue: before.status, currentValue: next.status }));
    if (before.dueDate !== next.dueDate || before.publicationDate !== next.publicationDate) {
      events.push(eventFor({ type: 'deadline_changed', current: next, previous: before, capturedAt, title: 'Prazo alterado', detail: `${next.name} teve o prazo operacional alterado.`, previousValue: before.dueDate || before.publicationDate || 'sem prazo', currentValue: next.dueDate || next.publicationDate || 'sem prazo', severity: 'high' }));
    }
    if (!before.isDelayed && next.isDelayed) events.push(eventFor({ type: 'delay_started', current: next, previous: before, capturedAt, title: 'Item entrou em atraso', detail: `${next.name} passou a apresentar prazo vencido.`, previousValue: 'dentro do prazo', currentValue: 'atrasado', severity: 'high' }));
    if (before.isDelayed && !next.isDelayed) events.push(eventFor({ type: 'delay_resolved', current: next, previous: before, capturedAt, title: 'Atraso resolvido', detail: `${next.name} deixou de apresentar atraso na leitura atual.`, previousValue: 'atrasado', currentValue: 'regularizado', severity: 'low' }));
    if (before.responsible !== next.responsible) events.push(eventFor({ type: 'responsible_changed', current: next, previous: before, capturedAt, title: 'Responsável alterado', detail: `${next.name} mudou de responsável operacional.`, previousValue: before.responsible, currentValue: next.responsible }));
    if (before.stage !== next.stage) events.push(eventFor({ type: 'stage_changed', current: next, previous: before, capturedAt, title: 'Etapa alterada', detail: `${next.name} mudou de etapa no fluxo.`, previousValue: before.stage, currentValue: next.stage }));
  }

  for (const [key, before] of previous) {
    if (!current.has(key)) events.push(eventFor({ type: 'item_left_scope', current: null, previous: before, capturedAt, title: 'Item saiu do recorte operacional', detail: `${before.name} deixou de aparecer na leitura atual.`, previousValue: before.status, currentValue: 'fora do recorte' }));
  }

  return events
    .sort((a, b) => ({ delay_started: 0, deadline_changed: 1, status_changed: 2, item_entered_scope: 3, responsible_changed: 4, stage_changed: 5, delay_resolved: 6, item_left_scope: 7 }[a.type] ?? 9) - ({ delay_started: 0, deadline_changed: 1, status_changed: 2, item_entered_scope: 3, responsible_changed: 4, stage_changed: 5, delay_resolved: 6, item_left_scope: 7 }[b.type] ?? 9))
    .slice(0, 300);
}

export async function listExecutiveEvents({ limit = 180, type = null, source = null, client = null } = {}) {
  const records = await eventStore.list();
  return records
    .filter(event => !type || event.type === type)
    .filter(event => !source || event.source === source)
    .filter(event => !client || event.client === client)
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
    .slice(0, Math.min(1000, Math.max(1, Number(limit) || 180)));
}

export async function saveExecutiveEvent(event) {
  const record = createExecutiveEvent(event);
  await eventStore.set(record);
  return record;
}

export async function saveExecutiveEvents(events = []) {
  const records = events.slice(0, 300).map(createExecutiveEvent);
  if (!records.length) return [];
  return eventStore.setMany(records);
}

export function eventStoreDescriptor() {
  return eventStore.describe();
}
