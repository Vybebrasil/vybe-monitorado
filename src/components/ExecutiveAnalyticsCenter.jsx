import React from 'react';
import { Activity, ArrowUpRight, ShieldAlert, Users } from 'lucide-react';
import { formatNumber, formatPct, formatPoints } from './executive-helpers.js';
import { statusColorFor } from '../data/status-colors.js';

function pct(value, total) {
  const numeric = Number(value);
  const denominator = Number(total);
  return denominator > 0 && Number.isFinite(numeric) ? Number(((numeric / denominator) * 100).toFixed(1)) : null;
}

function Bar({ value, max, tone = 'cyan' }) {
  const width = max > 0 ? Math.min(100, Math.max(value > 0 ? 5 : 0, (value / max) * 100)) : 0;
  return <span className={`analytics-bar-track ${tone}`}><i style={{ width: `${width}%` }} /></span>;
}

function Kpi({ label, value, detail, tone = 'cyan', onClick }) {
  const content = <><span className="analytics-kpi-label">{label}</span><strong>{value}</strong><small>{detail}</small></>;
  return onClick ? <button type="button" className={`analytics-kpi ${tone}`} onClick={onClick}>{content}<ArrowUpRight size={13} /></button> : <article className={`analytics-kpi ${tone}`}>{content}</article>;
}

const trendMetrics = [
  { key: 'score', label: 'Score bruto', color: '#a78bfa', formatter: formatPoints },
  { key: 'delayedProduction', label: 'Atrasos de produção', color: '#fb426b', formatter: formatNumber },
  { key: 'overdueDemands', label: 'Demandas vencidas', color: '#ffae3d', formatter: formatNumber },
  { key: 'openDemands', label: 'Backlog de demandas', color: '#f0abfc', formatter: formatNumber },
  { key: 'activeItems', label: 'Itens ativos', color: '#5eead4', formatter: formatNumber },
  { key: 'completedItems', label: 'Concluídos', color: '#63e6be', formatter: formatNumber },
  { key: 'completionPct', label: '% concluídos', color: '#34d399', formatter: formatPct },
  { key: 'delayedProductionPct', label: '% atrasos produção', color: '#fb7185', formatter: formatPct },
  { key: 'overdueDemandsPct', label: '% demandas vencidas', color: '#fbbf24', formatter: formatPct },
  { key: 'readyPct', label: '% prontos para agendar', color: '#c084fc', formatter: formatPct },
  { key: 'exposedClients', label: 'Clientes expostos', color: '#f97316', formatter: formatNumber },
  { key: 'stalledClients', label: 'Sem execução', color: '#f43f5e', formatter: formatNumber }
];

const COMPLETED_STATUSES = ['finalizado', 'publicado', 'cancelado', 'feito', 'concluído', 'entregue'];
const READY_STATUSES = ['agendado', 'para agendar'];

function splitValues(value) {
  return String(value || '').split(/[,;|]/).map(part => part.trim()).filter(Boolean);
}

function rowValues(item, keys) {
  return keys.flatMap(key => {
    const value = item?.[key];
    if (Array.isArray(value)) return value.map(entry => typeof entry === 'object' ? entry?.name : entry).filter(Boolean);
    return splitValues(value);
  });
}

function rowOwnerValues(item) {
  return [...new Set([
    ...rowValues(item, ['owner', 'responsible', 'responsavel', 'assignee']),
    ...(Array.isArray(item?.responsavelPeople) ? item.responsavelPeople.map(person => person?.name).filter(Boolean) : [])
  ])];
}

function rowClient(item) {
  return String(item?.client || item?.cliente || 'Sem Cliente').trim() || 'Sem Cliente';
}

function rowStage(item) {
  return String(item?.stage || item?.etapa || item?.quadro || 'Etapa não informada').trim() || 'Etapa não informada';
}

function rowStatus(item) {
  return String(item?.status || 'Sem status').trim() || 'Sem status';
}

function rowIsCompleted(item) {
  if (item?.isCompleted === true) return true;
  const status = rowStatus(item).toLowerCase();
  return COMPLETED_STATUSES.some(label => status.includes(label));
}

function rowIsReady(item) {
  if (item?.isReady === true) return true;
  const status = rowStatus(item).toLowerCase();
  return READY_STATUSES.some(label => status.includes(label));
}

function rowIsDelayed(item) {
  return Boolean(item?.isDelayed || item?.isDelayedPrazo || item?.isDelayedVeiculacao || item?.overdue || item?.delayType);
}

function matchesRow(item, filters) {
  return (!filters.owner || rowOwnerValues(item).includes(filters.owner))
    && (!filters.client || rowClient(item) === filters.client)
    && (!filters.stage || rowStage(item) === filters.stage)
    && (!filters.status || rowStatus(item) === filters.status);
}

function aggregateOwners(rows) {
  const byOwner = new Map();
  rows.forEach(item => rowOwnerValues(item).forEach(name => {
    const current = byOwner.get(name) || { name, delayedTotal: 0, delayedPrazo: 0, delayedVeiculacao: 0, posts: 0, itemIds: [] };
    current.posts += 1;
    if (rowIsDelayed(item)) current.delayedTotal += 1;
    if (item?.isDelayedPrazo) current.delayedPrazo += 1;
    if (item?.isDelayedVeiculacao) current.delayedVeiculacao += 1;
    if (item?.id) current.itemIds.push(item.id);
    byOwner.set(name, current);
  }));
  return [...byOwner.values()].sort((a, b) => b.delayedTotal - a.delayedTotal || b.posts - a.posts || a.name.localeCompare(b.name));
}

function aggregateClients(rows, includeOnlyRisk = false) {
  const byClient = new Map();
  rows.forEach(item => {
    const client = rowClient(item);
    const current = byClient.get(client) || { client, openItems: 0, delayedItems: 0 };
    if (!rowIsCompleted(item)) current.openItems += 1;
    if (rowIsDelayed(item)) current.delayedItems += 1;
    byClient.set(client, current);
  });
  return [...byClient.values()]
    .filter(item => !includeOnlyRisk || item.delayedItems > 0)
    .map(item => ({ ...item, riskPct: item.openItems ? Number(((item.delayedItems / item.openItems) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.delayedItems - a.delayedItems || b.openItems - a.openItems || a.client.localeCompare(b.client));
}

function aggregateStages(rows) {
  const activeRows = rows.filter(item => !rowIsCompleted(item));
  const counts = new Map();
  activeRows.forEach(item => counts.set(rowStage(item), (counts.get(rowStage(item)) || 0) + 1));
  return [...counts.entries()]
    .map(([stage, count]) => ({ stage, count, pctOfActive: pct(count, activeRows.length) }))
    .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage));
}

function aggregateStatuses(rows) {
  const counts = new Map();
  rows.filter(item => !rowIsCompleted(item)).forEach(item => {
    const status = rowStatus(item);
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  return [...counts.entries()].sort(([, a], [, b]) => b - a);
}

function TrendPlot({ points, metric }) {
  const valid = points.filter(point => Number.isFinite(Number(point[metric.key])));
  if (valid.length < 2) return <div className="analytics-trend-empty"><Activity size={18} /><strong>LINHA TEMPORAL INDISPONÍVEL</strong><span>São necessários pelo menos dois snapshots persistidos para desenhar uma tendência real.</span></div>;
  const width = 720;
  const height = 238;
  const pad = { top: 20, right: 18, bottom: 34, left: 52 };
  const values = valid.map(point => Number(point[metric.key]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = index => pad.left + (index / Math.max(valid.length - 1, 1)) * (width - pad.left - pad.right);
  const y = value => pad.top + (1 - ((value - min) / range)) * (height - pad.top - pad.bottom);
  const polyline = valid.map((point, index) => `${x(index)},${y(Number(point[metric.key]))}`).join(' ');
  const formatDate = capturedAt => capturedAt ? new Date(capturedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'N/D';
  return <div className="analytics-trend-plot-wrap">
    <svg className="analytics-trend-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Linha temporal de ${metric.label}`}>
      {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1={pad.left} x2={width - pad.right} y1={pad.top + ratio * (height - pad.top - pad.bottom)} y2={pad.top + ratio * (height - pad.top - pad.bottom)} className="analytics-trend-gridline" /><text x={pad.left - 10} y={pad.top + ratio * (height - pad.top - pad.bottom) + 4} textAnchor="end" className="analytics-trend-axis">{metric.formatter(max - ratio * range)}</text></g>)}
      <polyline points={polyline} fill="none" stroke={metric.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="analytics-trend-line" />
      {valid.map((point, index) => <g key={`${point.capturedAt}-${index}`}><circle cx={x(index)} cy={y(Number(point[metric.key]))} r="5" fill="#0a1223" stroke={metric.color} strokeWidth="3" /><title>{`${formatDate(point.capturedAt)} · ${metric.formatter(point[metric.key])}`}</title></g>)}
      <text x={pad.left} y={height - 9} className="analytics-trend-axis">{formatDate(valid[0].capturedAt)}</text>
      <text x={width - pad.right} y={height - 9} textAnchor="end" className="analytics-trend-axis">{formatDate(valid.at(-1).capturedAt)}</text>
    </svg>
  </div>;
}

export function TrendChart({ timeSeries, hasCrossFilter = false }) {
  const [metricKey, setMetricKey] = React.useState('score');
  const [rangeDays, setRangeDays] = React.useState(30);
  const [showSetup, setShowSetup] = React.useState(false);
  const setupDialog = showSetup ? <div className="analytics-history-setup" role="dialog" aria-modal="true" aria-label="Como ativar o histórico executivo"><div><div className="analytics-history-setup-header"><strong>ATIVAR EVOLUÇÃO REAL</strong><button type="button" onClick={() => setShowSetup(false)} aria-label="Fechar instruções">×</button></div><p>O Nexus só desenha tendências depois de guardar pelo menos dois snapshots executivos reais.</p><ol><li>Na Vercel, abra <b>Settings → Environment Variables</b>.</li><li>Configure <code>NEXUS_SNAPSHOT_STORE_URL</code> e <code>NEXUS_SNAPSHOT_STORE_TOKEN</code>, ou o par compartilhado <code>UPSTASH_REDIS_REST_URL</code> e <code>UPSTASH_REDIS_REST_TOKEN</code>.</li><li>Defina <code>NEXUS_SNAPSHOT_AUTOSAVE=true</code> e faça um novo deploy.</li><li>Aguarde duas leituras do Nexus. Sem pelo menos dois snapshots persistidos, a série continua N/D.</li></ol><p className="analytics-history-setup-warning">O filtro atual não altera esta série: ela representa a agência inteira. O recorte individual só altera o snapshot atual.</p><button type="button" className="analytics-filter-clear" onClick={() => setShowSetup(false)}>FECHAR</button></div></div> : null;
  if (!timeSeries?.available) return <article className="analytics-trend-unavailable">
    <div><Activity size={16} /><span>EVOLUÇÃO DA AGÊNCIA</span><strong>Histórico ainda não ativo</strong><small>A leitura atual funciona normalmente. As comparações aparecem após dois snapshots reais.</small></div>
    <button type="button" className="analytics-history-setup-button" onClick={() => setShowSetup(true)}>ATIVAR HISTÓRICO</button>
    {setupDialog}
  </article>;
  const metric = trendMetrics.find(item => item.key === metricKey) || trendMetrics[0];
  const points = Array.isArray(timeSeries?.points) ? timeSeries.points : [];
  const cutoff = Date.now() - rangeDays * 86400000;
  const visiblePoints = points.filter(point => !point.capturedAt || new Date(point.capturedAt).getTime() >= cutoff);
  const validPoints = visiblePoints.filter(point => Number.isFinite(Number(point[metric.key])));
  const first = validPoints[0]?.[metric.key];
  const last = validPoints.at(-1)?.[metric.key];
  const delta = first !== undefined && last !== undefined ? Number(last) - Number(first) : null;
  return <article className="analytics-panel analytics-trend-panel">
    <div className="analytics-panel-heading analytics-trend-heading"><div><span><Activity size={13} /> EVOLUÇÃO DA AGÊNCIA</span><strong>{metric.label}</strong><small>{hasCrossFilter ? 'série global · filtros afetam apenas o snapshot atual' : 'série observada · snapshots persistidos'}</small></div><div className="analytics-trend-summary"><strong>{last === undefined ? 'N/D' : metric.formatter(last)}</strong><small>{delta === null ? 'sem comparação' : `${delta > 0 ? '+' : ''}${metric.formatter(delta)} no período`}</small></div></div>
    <div className="analytics-trend-controls"><div className="analytics-trend-metrics">{trendMetrics.map(item => <button type="button" key={item.key} className={metric.key === item.key ? 'active' : ''} style={{ '--trend-color': item.color }} onClick={() => setMetricKey(item.key)}>{item.label}</button>)}</div><div className="analytics-trend-ranges">{[7, 30, 90].map(days => <button type="button" key={days} className={rangeDays === days ? 'active' : ''} onClick={() => setRangeDays(days)}>{days}D</button>)}</div></div>
    <TrendPlot points={visiblePoints} metric={metric} />
  </article>;
}

export function ExecutiveAnalyticsCenter({ snapshot, history, timeSeries, onSelect, onOpenAnalyst }) {
  const quantitative = snapshot?.quantitative || {};
  const summary = snapshot?.summary || {};
  const productivity = snapshot?.productivity || {};
  const globalActive = Number(productivity.activeItems ?? quantitative.activeItems) || 0;
  const globalCompleted = Number(productivity.completedItems ?? quantitative.completedItems) || 0;
  const globalDelayed = Number(productivity.delayedItems ?? summary.delayedTeam ?? quantitative.overdueInternal) || 0;
  const globalDemandDelayed = Number(summary.delayedDemands) || 0;
  const globalReady = Number(productivity.readyToSchedule) || 0;
  const globalTotalScope = globalActive + globalCompleted;
  const fallbackOwners = Array.isArray(productivity.topResponsibles) ? productivity.topResponsibles : [];
  const fallbackStages = Array.isArray(productivity.byStage) ? productivity.byStage : [];
  const fallbackClients = (Array.isArray(snapshot?.clientRanking) ? snapshot.clientRanking : []).filter(item => Number(item.delayedItems) > 0).slice(0, 8);
  const fallbackStatuses = Object.entries(quantitative.statusCounts || {}).sort(([, a], [, b]) => Number(b) - Number(a)).slice(0, 8);
  const [crossFilters, setCrossFilters] = React.useState({ owner: '', client: '', stage: '', status: '' });
  const productionRows = Array.isArray(snapshot?.itemRows) ? snapshot.itemRows : (Array.isArray(snapshot?.activeItems) ? snapshot.activeItems : []);
  const demandRows = Array.isArray(snapshot?.demandItemRows) ? snapshot.demandItemRows : (Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : []);
  const hasCompleteProductionRows = snapshot?.itemRowsComplete === true;
  const hasCompleteDemandRows = snapshot?.demandItemRowsComplete === true;
  const hasDetailedRows = hasCompleteProductionRows || hasCompleteDemandRows;
  const hasCrossFilter = Object.values(crossFilters).some(Boolean);
  const filteredProductionRows = hasCompleteProductionRows ? productionRows.filter(item => rowStatus(item) !== 'Sem status' && matchesRow(item, crossFilters)) : [];
  const filteredDemandRows = hasCompleteDemandRows ? demandRows.filter(item => rowStatus(item) !== 'Sem status' && matchesRow(item, crossFilters)) : [];
  const scopeRows = hasCrossFilter && hasDetailedRows ? filteredProductionRows : productionRows.filter(item => rowStatus(item) !== 'Sem status');
  const scopedActiveRows = scopeRows.filter(item => !rowIsCompleted(item));
  const scopedCompletedRows = scopeRows.filter(rowIsCompleted);
  const scopedDelayedRows = scopedActiveRows.filter(rowIsDelayed);
  const scopedDemandDelayedRows = filteredDemandRows.filter(item => !rowIsCompleted(item) && rowIsDelayed(item));
  const hasUsableScope = !hasCrossFilter || hasDetailedRows;
  const active = hasCrossFilter ? (hasUsableScope ? scopedActiveRows.length : null) : globalActive;
  const completed = hasCrossFilter ? (hasUsableScope ? scopedCompletedRows.length : null) : globalCompleted;
  const delayed = hasCrossFilter ? (hasUsableScope ? scopedDelayedRows.length : null) : globalDelayed;
  const demandDelayed = hasCrossFilter ? (hasUsableScope ? scopedDemandDelayedRows.length : null) : globalDemandDelayed;
  const ready = hasCrossFilter ? (hasUsableScope ? scopedActiveRows.filter(rowIsReady).length : null) : globalReady;
  const totalScope = active === null || completed === null ? null : active + completed;
  const owners = hasCrossFilter && hasUsableScope ? aggregateOwners(filteredProductionRows) : fallbackOwners;
  const stages = hasCrossFilter && hasUsableScope ? aggregateStages(filteredProductionRows) : fallbackStages;
  const clients = hasCrossFilter && hasUsableScope ? aggregateClients(filteredProductionRows, true) : fallbackClients;
  const statuses = hasCrossFilter && hasUsableScope ? aggregateStatuses(filteredProductionRows) : fallbackStatuses;
  const filterOptionRows = [...productionRows, ...demandRows];
  const filterOptions = {
    owner: [...new Set(filterOptionRows.flatMap(rowOwnerValues).concat(fallbackOwners.map(item => item.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    client: [...new Set(filterOptionRows.map(rowClient).concat(fallbackClients.map(item => item.client)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    stage: [...new Set(productionRows.map(rowStage).concat(demandRows.map(rowStage)).concat(fallbackStages.map(item => item.stage)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    status: [...new Set(productionRows.map(rowStatus).concat(demandRows.map(rowStatus)).concat(fallbackStatuses.map(([label]) => label)).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  };
  const filteredItemCount = hasCrossFilter ? (hasUsableScope ? filteredProductionRows.length : null) : null;
  const filterLabels = { owner: 'RESPONSÁVEL', client: 'CLIENTE', stage: 'ETAPA', status: 'STATUS' };
  const updateFilter = (key, value) => setCrossFilters(current => ({ ...current, [key]: value }));
  const clearFilters = () => setCrossFilters({ owner: '', client: '', stage: '', status: '' });
  const visibleOwners = owners;
  const visibleClients = clients;
  const visibleStages = stages;
  const visibleStatuses = statuses;
  const maxOwner = Math.max(...visibleOwners.map(item => Number(item.delayedTotal) || 0), 1);
  const maxClient = Math.max(...visibleClients.map(item => Number(item.delayedItems) || 0), 1);
  const maxStage = Math.max(...visibleStages.map(item => Number(item.count) || 0), 1);
  const maxStatus = Math.max(...visibleStatuses.map(([, count]) => Number(count) || 0), 1);
  // O score não é recalculado por subconjunto: sua fórmula depende do domínio
  // completo de prontidão, execução e fontes. No recorte, ele é explicitamente N/D.
  const score = hasCrossFilter ? null : snapshot?.portfolioStability?.score;
  const historyAvailable = history?.available === true;
  const historyScore = history?.score || {};
  const historyChanges = Array.isArray(history?.changes) ? history.changes.slice(0, 4) : [];
  const displayCount = value => value === null || value === undefined ? 'N/D' : formatNumber(value);
  const displayPct = value => value === null || value === undefined ? 'N/D' : formatPct(value);
  const emitSelection = (selection, nextFilters = crossFilters) => { const scoped = Object.values(nextFilters).some(Boolean); onSelect?.({ ...selection, filters: scoped ? nextFilters : null, scoped }); };
  const activePct = totalScope ? pct(active, totalScope) : null;
  const completionPct = totalScope ? pct(completed, totalScope) : null;
  const delayedPct = active ? pct(delayed, active) : null;
  const readyPct = active ? pct(ready, active) : null;

  return (
    <section className="analytics-center" aria-label="Performance e Analytics Center">
      <header className="analytics-center-header">
        <div><span className="analytics-kicker">VYBE NEXUS · PERFORMANCE & ANALYTICS</span><h1>Como a agência está performando?</h1><p>Leitura observável de volume, fluxo, risco e concentração. Clique em qualquer linha para investigar a origem.</p></div><div className="analytics-center-meta">{hasCrossFilter ? <strong className="analytics-filter-active-badge">RECORTE ATIVO</strong> : null}</div>
        <div className="analytics-center-meta"><span><Activity size={13} /> snapshot atual</span><strong>{historyAvailable ? 'COMPARAÇÃO DISPONÍVEL' : 'COMPARAÇÃO N/D'}</strong></div>
      </header>

      <div className="analytics-filter-bar" aria-label="Filtros cruzados do Analytics Center">
        <div className="analytics-filter-title"><span>RECORTE CRUZADO</span><strong>{hasCrossFilter ? (filteredItemCount === null ? 'linhas detalhadas indisponíveis' : `${formatNumber(filteredItemCount)} itens de Produção no recorte`) : 'snapshot atual'}</strong></div>
        <div className="analytics-filter-controls">
          {Object.entries(filterOptions).map(([key, options]) => <label key={key} className="analytics-filter-control"><span>{filterLabels[key]}</span><select value={crossFilters[key]} onChange={event => updateFilter(key, event.target.value)} disabled={!options.length}><option value="">TODOS</option>{options.map(option => <option value={option} key={option}>{option}</option>)}</select></label>)}
          {hasCrossFilter ? <button type="button" className="analytics-filter-clear" onClick={clearFilters}>LIMPAR FILTROS</button> : null}
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <Kpi label="ITENS EM FLUXO" value={displayCount(active)} detail={`${displayPct(activePct)} do escopo lido`} tone="cyan" onClick={() => emitSelection({ type: 'kpi', id: 'activeItems', title: 'Itens em fluxo' })} />
        <Kpi label="CONCLUÍDOS" value={displayCount(completed)} detail={`${displayPct(completionPct)} do escopo lido`} tone="green" onClick={() => emitSelection({ type: 'kpi', id: 'completedItems', title: 'Itens concluídos' })} />
        <Kpi label="ATRASOS DE PRODUÇÃO" value={displayCount(delayed)} detail={`${displayPct(delayedPct)} dos ativos`} tone="red" onClick={() => emitSelection({ type: 'kpi', id: 'internal-delays', title: 'Atrasos em Produção de Conteúdo' })} />
        <Kpi label="DEMANDAS VENCIDAS" value={displayCount(demandDelayed)} detail="Solicitações de Demandas" tone="orange" onClick={() => emitSelection({ type: 'kpi', id: 'overdue-demands', title: 'Solicitações de Demandas vencidas' })} />
        <Kpi label="PRONTOS PARA AGENDAR" value={displayCount(ready)} detail={`${displayPct(readyPct)} dos ativos`} tone="purple" onClick={() => emitSelection({ type: 'kpi', id: 'readyItems', title: 'Itens prontos para agendar' })} />
        <Kpi label="PLACAR BRUTO" value={score === null || score === undefined ? 'N/D' : formatPoints(score)} detail={hasCrossFilter ? 'indisponível em recorte parcial' : 'pressão operacional atual'} tone={score === null ? 'purple' : Number(score) < 0 ? 'red' : 'green'} onClick={() => emitSelection({ type: 'kpi', id: 'health', title: 'Saúde Executiva' })} />
      </div>

      <TrendChart timeSeries={timeSeries} hasCrossFilter={hasCrossFilter} />

      <div className="analytics-grid analytics-grid-main">
        <article className="analytics-panel analytics-flow-panel">
          <div className="analytics-panel-heading"><div><span>FLUXO DE ENTREGA</span><strong>Volume atual por estado</strong></div><small>não é tendência histórica</small></div>
          {[['Ativos', active, 'cyan'], ['Concluídos', completed, 'green'], ['Atrasados', delayed, 'red'], ['Prontos para agendar', ready, 'purple']].map(([label, value, tone]) => <div className="analytics-flow-row" key={label}><div><span>{label}</span><strong>{displayCount(value)}</strong></div><Bar value={Number(value) || 0} max={Math.max(Number(active) || 0, Number(completed) || 0, Number(delayed) || 0, Number(ready) || 0, 1)} tone={tone} /><small>{displayPct(pct(value, totalScope || active))}</small></div>)}
          <div className="analytics-panel-note"><strong>LEITURA</strong><span>{hasCrossFilter ? (hasUsableScope ? 'O fluxo foi recalculado exclusivamente para o recorte selecionado. A série temporal abaixo continua sendo da agência inteira.' : 'O snapshot atual não entregou linhas detalhadas suficientes para recalcular este recorte; os KPIs ficam em N/D para evitar números enganosos.') : 'O fluxo mostra estoque e distribuição da carteira nesta leitura. A comparação temporal permanece N/D enquanto não houver histórico disponível.'}</span></div>
        </article>

        <article className="analytics-panel analytics-owner-panel">
          <div className="analytics-panel-heading"><div><span><Users size={13} /> CONCENTRAÇÃO POR RESPONSÁVEL</span><strong>Sinais de capacidade observável</strong></div><small>não é ranking de valor individual</small></div>
          {visibleOwners.length === 0 ? <div className="analytics-empty"><ShieldAlert size={16} /><span>Responsáveis não disponíveis neste recorte.</span></div> : visibleOwners.slice(0, 6).map(owner => { const total = Array.isArray(owner.posts) ? owner.posts.length : Number(owner.posts ?? owner.totalItems) || 0; const ownerDelayed = Number(owner.delayedTotal) || 0; return <button type="button" className="analytics-owner-row" key={owner.name} onClick={() => { updateFilter('owner', owner.name); emitSelection({ type: 'owner', id: owner.name, title: `Performance observável: ${owner.name}` }, { ...crossFilters, owner: owner.name }); }}><span className="analytics-owner-name">{owner.name}</span><Bar value={ownerDelayed} max={maxOwner} tone={ownerDelayed > 0 ? 'red' : 'green'} /><strong>{formatNumber(ownerDelayed)}</strong><small>{formatNumber(total)} itens · {formatNumber(ownerDelayed)} sinais associados</small><ArrowUpRight size={13} /></button>; })}
        </article>
      </div>

      <div className="analytics-grid analytics-grid-secondary">
        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>RISCO POR CLIENTE</span><strong>Onde a previsibilidade está exposta?</strong></div><small>atrasos / itens abertos</small></div>
          {visibleClients.length === 0 ? <div className="analytics-empty"><span>Nenhum cliente com atraso neste recorte.</span></div> : visibleClients.map(client => <button type="button" className="analytics-client-row" key={client.client} onClick={() => { updateFilter('client', client.client); emitSelection({ type: 'client', id: client.client, title: `Performance observável: ${client.client}` }, { ...crossFilters, client: client.client }); }}><span>{client.client}</span><Bar value={Number(client.delayedItems) || 0} max={maxClient} tone="orange" /><strong>{formatNumber(client.delayedItems)}</strong><small>{formatPct(client.riskPct)} exposição · {formatNumber(client.openItems ?? 0)} abertos</small><ArrowUpRight size={13} /></button>)}
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>ETAPAS DA PRODUÇÃO</span><strong>Onde o trabalho está acumulado?</strong></div><small>{formatNumber(stages.length)} etapas{hasCrossFilter ? ' no recorte' : ''}</small></div>
          {visibleStages.length === 0 ? <div className="analytics-empty"><span>Etapas não disponíveis neste recorte.</span></div> : visibleStages.slice(0, 8).map(stage => <button type="button" className="analytics-stage-row" key={stage.stage} onClick={() => { updateFilter('stage', stage.stage); emitSelection({ type: 'filter', filterKey: 'stage', id: stage.stage, title: `Etapa: ${stage.stage}` }, { ...crossFilters, stage: stage.stage }); }}><span>{stage.stage}</span><Bar value={Number(stage.count) || 0} max={maxStage} tone="cyan" /><strong>{formatNumber(stage.count)}</strong><small>{formatPct(stage.pctOfActive)}</small><ArrowUpRight size={13} /></button>)}
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>MIX DE STATUS</span><strong>Como a carteira está distribuída?</strong></div><small>{displayCount(active)} ativos{hasCrossFilter ? ' no recorte' : ''}</small></div>
          {visibleStatuses.length === 0 ? <div className="analytics-empty"><span>Status não disponíveis neste recorte.</span></div> : visibleStatuses.map(([label, count]) => { const color = quantitative.statusColors?.[label] || statusColorFor(label) || '#5eead4'; return <button type="button" className="analytics-status-row" key={label} onClick={() => { updateFilter('status', label); emitSelection({ type: 'filter', filterKey: 'status', id: label, title: `Status: ${label}` }, { ...crossFilters, status: label }); }}><span><i style={{ background: color }} />{label}</span><Bar value={Number(count) || 0} max={maxStatus} tone="status" /><strong>{formatNumber(count)}</strong><ArrowUpRight size={13} /></button>; })}
        </article>
      </div>

      <div className="analytics-comparison-card"><span className="analytics-comparison-dot" /><div><strong>{historyAvailable ? 'COMPARAÇÃO TEMPORAL PRONTA' : 'COMPARAÇÃO TEMPORAL AINDA NÃO DISPONÍVEL'}</strong><p>{historyAvailable ? `Score ${formatPoints(historyScore.current)} · variação ${formatPoints(historyScore.delta)} desde a última leitura.` : 'Configure a persistência executiva para comparar esta leitura com ontem, semana anterior ou último snapshot. O Nexus não fabrica tendências.'}</p>{historyAvailable && historyChanges.length > 0 ? <div className="analytics-history-changes">{historyChanges.map(change => <span key={change.key}><b>{change.label}</b><em>{change.previous} → {change.current}</em></span>)}</div> : null}</div><span className="analytics-comparison-badge">{historyAvailable ? 'LIVE' : 'N/D'}</span></div>
    </section>
  );
}

export default ExecutiveAnalyticsCenter;
