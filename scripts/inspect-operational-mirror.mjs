import { normalizeSnapshot } from '../server/integrations/operational-mirror.js';

const response = await fetch('https://vybepainel-v2.vercel.app/api/operational-mirror', { headers: { Accept: 'application/json' } });
const payload = await response.json();
const normalized = normalizeSnapshot(payload);
const items = Array.isArray(normalized.items) ? normalized.items : [];
const status = item => {
  const column = (item.column_values || []).find(value => value.id === 'status');
  return String(column?.text || '').trim();
};
const completed = value => /finalizado|publicado|cancelado|feito|concluído|entregue/i.test(value);
const statuses = items.reduce((acc, item) => { const value = status(item) || 'Sem status'; acc[value] = (acc[value] || 0) + 1; return acc; }, {});
const active = items.filter(item => status(item) && !completed(status(item)));
console.log(JSON.stringify({
  httpStatus: response.status,
  keys: Object.keys(payload),
  ready: payload.ready,
  version: payload.version,
  complete: normalized.complete,
  completeness: normalized.completeness,
  itemCountMeta: payload.item_count ?? null,
  items: items.length,
  active: active.length,
  completed: items.length - active.length,
  statuses,
  first: items.slice(0, 2).map(item => ({ id: item.id, name: item.name, status: status(item), columns: (item.column_values || []).map(value => value.id) }))
}, null, 2));
