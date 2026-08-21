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
  { key: 'exposedClients', label: 'Clientes expostos', color: '#f97316', formatter: formatNumber },
  { key: 'stalledClients', label: 'Sem execução', color: '#f43f5e', formatter: formatNumber }
];

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

export function TrendChart({ timeSeries }) {
  const [metricKey, setMetricKey] = React.useState('score');
  const [rangeDays, setRangeDays] = React.useState(30);
  const metric = trendMetrics.find(item => item.key === metricKey) || trendMetrics[0];
  const points = Array.isArray(timeSeries?.points) ? timeSeries.points : [];
  const cutoff = Date.now() - rangeDays * 86400000;
  const visiblePoints = points.filter(point => !point.capturedAt || new Date(point.capturedAt).getTime() >= cutoff);
  const validPoints = visiblePoints.filter(point => Number.isFinite(Number(point[metric.key])));
  const first = validPoints[0]?.[metric.key];
  const last = validPoints.at(-1)?.[metric.key];
  const delta = first !== undefined && last !== undefined ? Number(last) - Number(first) : null;
  return <article className="analytics-panel analytics-trend-panel">
    <div className="analytics-panel-heading analytics-trend-heading"><div><span><Activity size={13} /> EVOLUÇÃO DA AGÊNCIA</span><strong>{metric.label}</strong><small>{timeSeries?.available ? 'série observada · snapshots persistidos' : 'histórico real ainda não configurado'}</small></div><div className="analytics-trend-summary"><strong>{last === undefined ? 'N/D' : metric.formatter(last)}</strong><small>{delta === null ? 'sem comparação' : `${delta > 0 ? '+' : ''}${metric.formatter(delta)} no período`}</small></div></div>
    <div className="analytics-trend-controls"><div className="analytics-trend-metrics">{trendMetrics.map(item => <button type="button" key={item.key} className={metric.key === item.key ? 'active' : ''} style={{ '--trend-color': item.color }} onClick={() => setMetricKey(item.key)}>{item.label}</button>)}</div><div className="analytics-trend-ranges">{[7, 30, 90].map(days => <button type="button" key={days} className={rangeDays === days ? 'active' : ''} onClick={() => setRangeDays(days)}>{days}D</button>)}</div></div>
    <TrendPlot points={visiblePoints} metric={metric} />
    {!timeSeries?.available ? <div className="analytics-panel-note"><strong>HISTÓRICO N/D</strong><span>{timeSeries?.message || 'Configure a persistência executiva para habilitar as linhas e comparações temporais.'}</span></div> : null}
  </article>;
}

export function ExecutiveAnalyticsCenter({ snapshot, history, timeSeries, onSelect, onOpenAnalyst }) {
  const quantitative = snapshot?.quantitative || {};
  const summary = snapshot?.summary || {};
  const productivity = snapshot?.productivity || {};
  const active = Number(productivity.activeItems ?? quantitative.activeItems) || 0;
  const completed = Number(productivity.completedItems ?? quantitative.completedItems) || 0;
  const delayed = Number(productivity.delayedItems ?? summary.delayedTeam ?? quantitative.overdueInternal) || 0;
  const demandDelayed = Number(summary.delayedDemands) || 0;
  const ready = Number(productivity.readyToSchedule) || 0;
  const totalScope = active + completed;
  const owners = Array.isArray(productivity.topResponsibles) ? productivity.topResponsibles : [];
  const stages = Array.isArray(productivity.byStage) ? productivity.byStage : [];
  const clients = (Array.isArray(snapshot?.clientRanking) ? snapshot.clientRanking : []).filter(item => Number(item.delayedItems) > 0).slice(0, 8);
  const statuses = Object.entries(quantitative.statusCounts || {}).sort(([, a], [, b]) => Number(b) - Number(a)).slice(0, 8);
  const [crossFilters, setCrossFilters] = React.useState({ owner: '', client: '', stage: '', status: '' });
  const activeItemRows = Array.isArray(snapshot?.activeItems) ? snapshot.activeItems : [];
  const getField = (item, keys) => keys.map(key => item?.[key]).find(value => value !== undefined && value !== null && value !== '') || '';
  const matchesFilters = item => {
    const owner = String(getField(item, ['owner', 'responsible', 'responsavel', 'assignee']));
    const client = String(getField(item, ['client', 'cliente']));
    const stage = String(getField(item, ['stage', 'etapa']));
    const status = String(getField(item, ['status']));
    return (!crossFilters.owner || owner === crossFilters.owner) && (!crossFilters.client || client === crossFilters.client) && (!crossFilters.stage || stage === crossFilters.stage) && (!crossFilters.status || status === crossFilters.status);
  };
  const filteredItemCount = activeItemRows.length ? activeItemRows.filter(matchesFilters).length : null;
  const filterOptions = {
    owner: owners.map(item => item.name).filter(Boolean),
    client: [...new Set((Array.isArray(snapshot?.clientRanking) ? snapshot.clientRanking : []).map(item => item.client).filter(Boolean))],
    stage: stages.map(item => item.stage).filter(Boolean),
    status: statuses.map(([label]) => label).filter(Boolean)
  };
  const filterLabels = { owner: 'RESPONSÁVEL', client: 'CLIENTE', stage: 'ETAPA', status: 'STATUS' };
  const updateFilter = (key, value) => setCrossFilters(current => ({ ...current, [key]: value }));
  const clearFilters = () => setCrossFilters({ owner: '', client: '', stage: '', status: '' });
  const hasCrossFilter = Object.values(crossFilters).some(Boolean);
  const visibleOwners = crossFilters.owner ? owners.filter(item => item.name === crossFilters.owner) : owners;
  const visibleClients = crossFilters.client ? clients.filter(item => item.client === crossFilters.client) : clients;
  const visibleStages = crossFilters.stage ? stages.filter(item => item.stage === crossFilters.stage) : stages;
  const visibleStatuses = crossFilters.status ? statuses.filter(([label]) => label === crossFilters.status) : statuses;
  const maxOwner = Math.max(...visibleOwners.map(item => Number(item.delayedTotal) || 0), 1);
  const maxClient = Math.max(...visibleClients.map(item => Number(item.delayedItems) || 0), 1);
  const maxStage = Math.max(...visibleStages.map(item => Number(item.count) || 0), 1);
  const maxStatus = Math.max(...visibleStatuses.map(([, count]) => Number(count) || 0), 1);
  const score = snapshot?.portfolioStability?.score;
  const historyAvailable = history?.available === true;
  const historyScore = history?.score || {};
  const historyChanges = Array.isArray(history?.changes) ? history.changes.slice(0, 4) : [];

  return (
    <section className="analytics-center" aria-label="Performance e Analytics Center">
      <header className="analytics-center-header">
        <div><span className="analytics-kicker">VYBE NEXUS · PERFORMANCE & ANALYTICS</span><h1>Como a agência está performando?</h1><p>Leitura observável de volume, fluxo, risco e concentração. Clique em qualquer linha para investigar a origem.</p></div>
        <div className="analytics-center-meta"><span><Activity size={13} /> snapshot atual</span><strong>{historyAvailable ? 'COMPARAÇÃO DISPONÍVEL' : 'COMPARAÇÃO N/D'}</strong></div>
      </header>

      <div className="analytics-filter-bar" aria-label="Filtros cruzados do Analytics Center">
        <div className="analytics-filter-title"><span>RECORTE CRUZADO</span><strong>{filteredItemCount === null ? 'snapshot atual' : `${formatNumber(filteredItemCount)} itens no recorte`}</strong></div>
        <div className="analytics-filter-controls">
          {Object.entries(filterOptions).map(([key, options]) => <label key={key} className="analytics-filter-control"><span>{filterLabels[key]}</span><select value={crossFilters[key]} onChange={event => updateFilter(key, event.target.value)} disabled={!options.length}><option value="">TODOS</option>{options.map(option => <option value={option} key={option}>{option}</option>)}</select></label>)}
          {hasCrossFilter ? <button type="button" className="analytics-filter-clear" onClick={clearFilters}>LIMPAR FILTROS</button> : null}
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <Kpi label="ITENS EM FLUXO" value={formatNumber(active)} detail={`${formatPct(quantitative.activePct)} do escopo lido`} tone="cyan" onClick={() => onSelect?.({ type: 'kpi', id: 'activeItems', title: 'Itens em fluxo' })} />
        <Kpi label="CONCLUÍDOS" value={formatNumber(completed)} detail={`${formatPct(productivity.completionPct)} do escopo lido`} tone="green" onClick={() => onSelect?.({ type: 'kpi', id: 'activeItems', title: 'Itens concluídos' })} />
        <Kpi label="ATRASOS DE PRODUÇÃO" value={formatNumber(delayed)} detail={`${formatPct(productivity.delayedPctOfActive)} dos ativos`} tone="red" onClick={() => onSelect?.({ type: 'kpi', id: 'internal-delays', title: 'Atrasos em Produção de Conteúdo' })} />
        <Kpi label="DEMANDAS VENCIDAS" value={formatNumber(demandDelayed)} detail="Solicitações de Demandas" tone="orange" onClick={() => onSelect?.({ type: 'kpi', id: 'overdue-demands', title: 'Solicitações de Demandas vencidas' })} />
        <Kpi label="PRONTOS PARA AGENDAR" value={formatNumber(ready)} detail={`${formatPct(pct(ready, active))} dos ativos`} tone="purple" onClick={() => onSelect?.({ type: 'kpi', id: 'activeItems', title: 'Itens prontos para agendar' })} />
        <Kpi label="PLACAR BRUTO" value={score === null || score === undefined ? 'N/D' : formatPoints(score)} detail="pressão operacional atual" tone={Number(score) < 0 ? 'red' : 'green'} onClick={() => onSelect?.({ type: 'kpi', id: 'health', title: 'Saúde Executiva' })} />
      </div>

      <TrendChart timeSeries={timeSeries} />

      <div className="analytics-grid analytics-grid-main">
        <article className="analytics-panel analytics-flow-panel">
          <div className="analytics-panel-heading"><div><span>FLUXO DE ENTREGA</span><strong>Volume atual por estado</strong></div><small>não é tendência histórica</small></div>
          {[['Ativos', active, 'cyan'], ['Concluídos', completed, 'green'], ['Atrasados', delayed, 'red'], ['Prontos para agendar', ready, 'purple']].map(([label, value, tone]) => <div className="analytics-flow-row" key={label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><Bar value={value} max={Math.max(active, completed, delayed, ready, 1)} tone={tone} /><small>{formatPct(pct(value, totalScope || active))}</small></div>)}
          <div className="analytics-panel-note"><strong>LEITURA</strong><span>O fluxo mostra estoque e distribuição da carteira nesta leitura. A comparação temporal permanece N/D enquanto não houver histórico disponível.</span></div>
        </article>

        <article className="analytics-panel analytics-owner-panel">
          <div className="analytics-panel-heading"><div><span><Users size={13} /> CONCENTRAÇÃO POR RESPONSÁVEL</span><strong>Sinais de capacidade observável</strong></div><small>não é ranking de valor individual</small></div>
          {visibleOwners.length === 0 ? <div className="analytics-empty"><ShieldAlert size={16} /><span>Responsáveis não disponíveis neste recorte.</span></div> : visibleOwners.slice(0, 6).map(owner => { const total = Array.isArray(owner.posts) ? owner.posts.length : Number(owner.posts ?? owner.totalItems) || 0; const ownerDelayed = Number(owner.delayedTotal) || 0; return <button type="button" className="analytics-owner-row" key={owner.name} onClick={() => { updateFilter('owner', owner.name); onSelect?.({ type: 'owner', id: owner.name, title: `Performance observável: ${owner.name}` }); }}><span className="analytics-owner-name">{owner.name}</span><Bar value={ownerDelayed} max={maxOwner} tone={ownerDelayed > 0 ? 'red' : 'green'} /><strong>{formatNumber(ownerDelayed)}</strong><small>{formatNumber(total)} itens · {formatNumber(ownerDelayed)} sinais associados</small><ArrowUpRight size={13} /></button>; })}
        </article>
      </div>

      <div className="analytics-grid analytics-grid-secondary">
        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>RISCO POR CLIENTE</span><strong>Onde a previsibilidade está exposta?</strong></div><small>atrasos / itens abertos</small></div>
          {visibleClients.length === 0 ? <div className="analytics-empty"><span>Nenhum cliente com atraso neste recorte.</span></div> : visibleClients.map(client => <button type="button" className="analytics-client-row" key={client.client} onClick={() => { updateFilter('client', client.client); onSelect?.({ type: 'client', id: client.client, title: `Performance observável: ${client.client}` }); }}><span>{client.client}</span><Bar value={Number(client.delayedItems) || 0} max={maxClient} tone="orange" /><strong>{formatNumber(client.delayedItems)}</strong><small>{formatPct(client.riskPct)} exposição</small><ArrowUpRight size={13} /></button>)}
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>ETAPAS DA PRODUÇÃO</span><strong>Onde o trabalho está acumulado?</strong></div><small>{formatNumber(stages.length)} etapas</small></div>
          {visibleStages.length === 0 ? <div className="analytics-empty"><span>Etapas não disponíveis neste recorte.</span></div> : visibleStages.slice(0, 8).map(stage => <button type="button" className="analytics-stage-row" key={stage.stage} onClick={() => { updateFilter('stage', stage.stage); onSelect?.({ type: 'filter', filterKey: 'stage', id: stage.stage, title: `Etapa: ${stage.stage}` }); }}><span>{stage.stage}</span><Bar value={Number(stage.count) || 0} max={maxStage} tone="cyan" /><strong>{formatNumber(stage.count)}</strong><small>{formatPct(stage.pctOfActive)}</small><ArrowUpRight size={13} /></button>)}
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>MIX DE STATUS</span><strong>Como a carteira está distribuída?</strong></div><small>{formatNumber(active)} ativos</small></div>
          {visibleStatuses.length === 0 ? <div className="analytics-empty"><span>Status não disponíveis neste recorte.</span></div> : visibleStatuses.map(([label, count]) => { const color = quantitative.statusColors?.[label] || statusColorFor(label) || '#5eead4'; return <button type="button" className="analytics-status-row" key={label} onClick={() => { updateFilter('status', label); onSelect?.({ type: 'filter', filterKey: 'status', id: label, title: `Status: ${label}` }); }}><span><i style={{ background: color }} />{label}</span><Bar value={Number(count) || 0} max={maxStatus} tone="status" /><strong>{formatNumber(count)}</strong><ArrowUpRight size={13} /></button>; })}
        </article>
      </div>

      <div className="analytics-comparison-card"><span className="analytics-comparison-dot" /><div><strong>{historyAvailable ? 'COMPARAÇÃO TEMPORAL PRONTA' : 'COMPARAÇÃO TEMPORAL AINDA NÃO DISPONÍVEL'}</strong><p>{historyAvailable ? `Score ${formatPoints(historyScore.current)} · variação ${formatPoints(historyScore.delta)} desde a última leitura.` : 'Configure a persistência executiva para comparar esta leitura com ontem, semana anterior ou último snapshot. O Nexus não fabrica tendências.'}</p>{historyAvailable && historyChanges.length > 0 ? <div className="analytics-history-changes">{historyChanges.map(change => <span key={change.key}><b>{change.label}</b><em>{change.previous} → {change.current}</em></span>)}</div> : null}</div><span className="analytics-comparison-badge">{historyAvailable ? 'LIVE' : 'N/D'}</span></div>
    </section>
  );
}

export default ExecutiveAnalyticsCenter;
