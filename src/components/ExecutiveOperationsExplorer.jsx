import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react';
import { statusColorFor } from '../data/status-colors.js';
import { formatDate, formatNumber } from './executive-helpers.js';
import { ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

const COMPLETED = ['finalizado', 'publicado', 'cancelado', 'feito', 'concluído', 'entregue'];
const delayed = item => Boolean(item?.isDelayed || item?.isDelayedPrazo || item?.isDelayedVeiculacao || item?.overdue || item?.delayType);
const completed = item => item?.isCompleted === true || COMPLETED.some(label => String(item?.status || '').toLowerCase().includes(label));
const values = value => Array.isArray(value) ? value.map(item => typeof item === 'object' ? item?.name : item).filter(Boolean) : String(value || '').split(/[,;|]/).map(value => value.trim()).filter(Boolean);
const normalize = (item, source) => ({
  ...item,
  source,
  name: item?.name || item?.itemName || 'Item sem nome',
  client: item?.client || item?.cliente || 'Sem cliente',
  stage: item?.stage || item?.etapa || item?.quadro || 'Etapa não informada',
  owner: values(item?.owner || item?.responsible || item?.responsavel).join(', ') || 'Responsável não informado',
  status: item?.status || 'Sem status',
  due: item?.prazo || item?.deadline || item?.dueDate || null,
  isDelayed: delayed(item),
  isComplete: completed(item),
  age: Number(item?.daysOverdue ?? item?.overdueDays ?? 0) || 0
});

function agingLabel(item) {
  if (!item.isDelayed) return 'No prazo';
  if (item.age >= 30) return '30+ dias';
  if (item.age >= 8) return '8–29 dias';
  if (item.age >= 3) return '3–7 dias';
  return '0–2 dias';
}

export default function ExecutiveOperationsExplorer({ snapshot, source = 'production', onOpenItem, onOpenClient, getItemUrl, compact = false }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [client, setClient] = useState('all');
  const [owner, setOwner] = useState('all');
  const [aging, setAging] = useState('all');
  const [sort, setSort] = useState('urgency');
  const detailedRows = source === 'demands'
    ? (Array.isArray(snapshot?.demandItemRows) ? snapshot.demandItemRows : Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : [])
    : (Array.isArray(snapshot?.itemRows) ? snapshot.itemRows : Array.isArray(snapshot?.activeItems) ? snapshot.activeItems : []);
  const fallbackRows = source === 'demands' ? (Array.isArray(snapshot?.delayedDemandItems) ? snapshot.delayedDemandItems : []) : (Array.isArray(snapshot?.delayDetails) ? snapshot.delayDetails : []);
  const hasCompleteRows = source === 'demands' ? snapshot?.demandItemRowsComplete === true : snapshot?.itemRowsComplete === true;
  const rows = detailedRows.length ? detailedRows : fallbackRows;
  const isPartial = !hasCompleteRows;
  const items = useMemo(() => rows.map(item => normalize(item, source)).filter(item => !item.isComplete), [rows, source]);
  const options = useMemo(() => ({
    statuses: [...new Set(items.map(item => item.status))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    clients: [...new Set(items.map(item => item.client))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    owners: [...new Set(items.flatMap(item => values(item.owner)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }), [items]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => {
      const haystack = [item.name, item.client, item.stage, item.owner, item.status].join(' ').toLowerCase();
      const matchesAging = aging === 'all' || agingLabel(item) === aging;
      return (!term || haystack.includes(term))
        && (status === 'all' || item.status === status)
        && (client === 'all' || item.client === client)
        && (owner === 'all' || values(item.owner).includes(owner))
        && matchesAging;
    }).sort((a, b) => {
      if (sort === 'date') return new Date(a.due || '2999-12-31') - new Date(b.due || '2999-12-31');
      if (sort === 'client') return a.client.localeCompare(b.client, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR');
      return Number(b.isDelayed) - Number(a.isDelayed) || b.age - a.age || new Date(a.due || '2999-12-31') - new Date(b.due || '2999-12-31');
    });
  }, [items, query, status, client, owner, aging, sort]);
  const overdue = items.filter(item => item.isDelayed).length;
  const title = source === 'demands' ? 'Solicitações de Demandas' : 'Produção de Conteúdo';
  const sourceLabel = source === 'demands' ? 'board Solicitações de Demandas' : 'board Produção de Conteúdo';

  return <article className={`executive-operations-explorer ${compact ? 'compact' : ''}`} aria-label={`Explorador de ${title}`}>
    <ExecutiveSectionHeader icon={SlidersHorizontal} eyebrow={isPartial ? 'Sinais observáveis' : 'Acompanhamento completo'} title={title} note={`${formatNumber(items.length)} ${isPartial ? 'sinais observáveis' : 'itens abertos'}`} />
    <div className="operations-explorer-summary"><div><strong>{formatNumber(items.length)}</strong><span>{isPartial ? 'sinais observáveis' : 'abertos'}</span></div><div className={overdue ? 'critical' : 'stable'}><strong>{formatNumber(overdue)}</strong><span>vencidos ou atrasados</span></div><p>Fonte: {sourceLabel}. {isPartial ? 'Coorte detalhada indisponível; o Nexus mostra apenas os sinais entregues pela fonte.' : 'Itens finalizados ficam fora desta coorte.'}</p></div>
    <div className="operations-explorer-controls">
      <label className="operations-explorer-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Buscar item</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar item, cliente, etapa ou responsável" /></label>
      <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option>{options.statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Cliente</span><select value={client} onChange={event => setClient(event.target.value)}><option value="all">Todos</option>{options.clients.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Responsável</span><select value={owner} onChange={event => setOwner(event.target.value)}><option value="all">Todos</option>{options.owners.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Urgência</span><select value={aging} onChange={event => setAging(event.target.value)}><option value="all">Todas</option><option value="0–2 dias">0–2 dias</option><option value="3–7 dias">3–7 dias</option><option value="8–29 dias">8–29 dias</option><option value="30+ dias">30+ dias</option><option value="No prazo">No prazo</option></select></label>
      <label><span>Ordenar</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="urgency">Urgência</option><option value="date">Prazo</option><option value="client">Cliente</option></select></label>
    </div>
    <div className="operations-explorer-result-count">{formatNumber(filtered.length)} {isPartial ? 'sinais observáveis' : 'resultados'} no recorte atual</div>
    {filtered.length ? <div className="operations-explorer-list">{filtered.map(item => { const color = statusColorFor(item.status, snapshot?.quantitative?.statusColors); const url = getItemUrl?.(item); return <article className={`operations-explorer-row ${item.isDelayed ? 'is-delayed' : ''}`} key={item.id || `${item.source}-${item.name}`}>
      <button type="button" className="operations-explorer-main" onClick={() => onOpenItem?.(item)}><span className="operations-explorer-aging">{item.isDelayed ? `${item.age || 0}d · ${agingLabel(item)}` : 'No prazo'}</span><strong>{item.name}</strong><small>{item.client} · {item.stage} · {item.owner}</small></button>
      <span className="monday-status-badge" style={{ color, borderColor: color }}>{item.status}</span>
      <div className="operations-explorer-due"><b>{item.isDelayed ? 'Vencido' : 'Prazo'}</b><span>{formatDate(item.due)}</span></div>
      <div className="operations-explorer-actions">{item.client !== 'Sem cliente' ? <button type="button" className="executive-inline-link" onClick={() => onOpenClient?.(item.client)}>Abrir cliente ↗</button> : null}{url ? <a className="executive-inline-link" href={url} target="_blank" rel="noreferrer">Monday ↗</a> : null}<ArrowUpRight size={14} aria-hidden="true" /></div>
    </article>; })}</div> : <div className="executive-empty-state"><strong>Nenhum item corresponde ao recorte.</strong><span>Amplie os filtros ou atualize os dados do board.</span></div>}
  </article>;
}
