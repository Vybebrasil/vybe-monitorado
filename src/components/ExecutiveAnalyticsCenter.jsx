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

export function ExecutiveAnalyticsCenter({ snapshot, history, onSelect, onOpenAnalyst }) {
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
  const maxOwner = Math.max(...owners.map(item => Number(item.delayedTotal) || 0), 1);
  const maxClient = Math.max(...clients.map(item => Number(item.delayedItems) || 0), 1);
  const maxStage = Math.max(...stages.map(item => Number(item.count) || 0), 1);
  const maxStatus = Math.max(...statuses.map(([, count]) => Number(count) || 0), 1);
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

      <div className="analytics-kpi-grid">
        <Kpi label="ITENS EM FLUXO" value={formatNumber(active)} detail={`${formatPct(quantitative.activePct)} do escopo lido`} tone="cyan" onClick={() => onSelect?.({ type: 'kpi', id: 'activeItems', title: 'Itens em fluxo' })} />
        <Kpi label="CONCLUÍDOS" value={formatNumber(completed)} detail={`${formatPct(productivity.completionPct)} do escopo lido`} tone="green" onClick={() => onSelect?.({ type: 'kpi', id: 'activeItems', title: 'Itens concluídos' })} />
        <Kpi label="ATRASOS DE PRODUÇÃO" value={formatNumber(delayed)} detail={`${formatPct(productivity.delayedPctOfActive)} dos ativos`} tone="red" onClick={() => onSelect?.({ type: 'kpi', id: 'internal-delays', title: 'Atrasos em Produção de Conteúdo' })} />
        <Kpi label="DEMANDAS VENCIDAS" value={formatNumber(demandDelayed)} detail="Solicitações de Demandas" tone="orange" onClick={() => onSelect?.({ type: 'kpi', id: 'overdue-demands', title: 'Solicitações de Demandas vencidas' })} />
        <Kpi label="PRONTOS PARA AGENDAR" value={formatNumber(ready)} detail={`${formatPct(pct(ready, active))} dos ativos`} tone="purple" onClick={() => onSelect?.({ type: 'kpi', id: 'activeItems', title: 'Itens prontos para agendar' })} />
        <Kpi label="PLACAR BRUTO" value={score === null || score === undefined ? 'N/D' : formatPoints(score)} detail="pressão operacional atual" tone={Number(score) < 0 ? 'red' : 'green'} onClick={() => onSelect?.({ type: 'kpi', id: 'health', title: 'Saúde Executiva' })} />
      </div>

      <div className="analytics-grid analytics-grid-main">
        <article className="analytics-panel analytics-flow-panel">
          <div className="analytics-panel-heading"><div><span>FLUXO DE ENTREGA</span><strong>Volume atual por estado</strong></div><small>não é tendência histórica</small></div>
          {[['Ativos', active, 'cyan'], ['Concluídos', completed, 'green'], ['Atrasados', delayed, 'red'], ['Prontos para agendar', ready, 'purple']].map(([label, value, tone]) => <div className="analytics-flow-row" key={label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><Bar value={value} max={Math.max(active, completed, delayed, ready, 1)} tone={tone} /><small>{formatPct(pct(value, totalScope || active))}</small></div>)}
          <div className="analytics-panel-note"><strong>LEITURA</strong><span>O fluxo mostra estoque e distribuição da carteira nesta leitura. A comparação temporal permanece N/D enquanto não houver histórico disponível.</span></div>
        </article>

        <article className="analytics-panel analytics-owner-panel">
          <div className="analytics-panel-heading"><div><span><Users size={13} /> CONCENTRAÇÃO POR RESPONSÁVEL</span><strong>Sinais de capacidade observável</strong></div><small>não é ranking de valor individual</small></div>
          {owners.length === 0 ? <div className="analytics-empty"><ShieldAlert size={16} /><span>Responsáveis não disponíveis nesta leitura.</span></div> : owners.slice(0, 6).map(owner => { const total = Array.isArray(owner.posts) ? owner.posts.length : Number(owner.posts ?? owner.totalItems) || 0; const ownerDelayed = Number(owner.delayedTotal) || 0; return <button type="button" className="analytics-owner-row" key={owner.name} onClick={() => onSelect?.({ type: 'owner', id: owner.name, title: `Performance observável: ${owner.name}` })}><span className="analytics-owner-name">{owner.name}</span><Bar value={ownerDelayed} max={maxOwner} tone={ownerDelayed > 0 ? 'red' : 'green'} /><strong>{formatNumber(ownerDelayed)}</strong><small>{formatNumber(total)} itens · {formatNumber(ownerDelayed)} sinais associados</small><ArrowUpRight size={13} /></button>; })}
        </article>
      </div>

      <div className="analytics-grid analytics-grid-secondary">
        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>RISCO POR CLIENTE</span><strong>Onde a previsibilidade está exposta?</strong></div><small>atrasos / itens abertos</small></div>
          {clients.length === 0 ? <div className="analytics-empty"><span>Nenhum cliente com atraso no recorte.</span></div> : clients.map(client => <button type="button" className="analytics-client-row" key={client.client} onClick={() => onSelect?.({ type: 'client', id: client.client, title: `Performance observável: ${client.client}` })}><span>{client.client}</span><Bar value={Number(client.delayedItems) || 0} max={maxClient} tone="orange" /><strong>{formatNumber(client.delayedItems)}</strong><small>{formatPct(client.riskPct)} exposição</small><ArrowUpRight size={13} /></button>)}
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>ETAPAS DA PRODUÇÃO</span><strong>Onde o trabalho está acumulado?</strong></div><small>{formatNumber(stages.length)} etapas</small></div>
          {stages.length === 0 ? <div className="analytics-empty"><span>Etapas não disponíveis nesta leitura.</span></div> : stages.slice(0, 8).map(stage => <button type="button" className="analytics-stage-row" key={stage.stage} onClick={() => onSelect?.({ type: 'filter', filterKey: 'stage', id: stage.stage, title: `Etapa: ${stage.stage}` })}><span>{stage.stage}</span><Bar value={Number(stage.count) || 0} max={maxStage} tone="cyan" /><strong>{formatNumber(stage.count)}</strong><small>{formatPct(stage.pctOfActive)}</small><ArrowUpRight size={13} /></button>)}
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><span>MIX DE STATUS</span><strong>Como a carteira está distribuída?</strong></div><small>{formatNumber(active)} ativos</small></div>
          {statuses.length === 0 ? <div className="analytics-empty"><span>Status não disponíveis nesta leitura.</span></div> : statuses.map(([label, count]) => { const color = quantitative.statusColors?.[label] || statusColorFor(label) || '#5eead4'; return <button type="button" className="analytics-status-row" key={label} onClick={() => onSelect?.({ type: 'filter', filterKey: 'status', id: label, title: `Status: ${label}` })}><span><i style={{ background: color }} />{label}</span><Bar value={Number(count) || 0} max={maxStatus} tone="status" /><strong>{formatNumber(count)}</strong><ArrowUpRight size={13} /></button>; })}
        </article>
      </div>

      <div className="analytics-comparison-card"><span className="analytics-comparison-dot" /><div><strong>{historyAvailable ? 'COMPARAÇÃO TEMPORAL PRONTA' : 'COMPARAÇÃO TEMPORAL AINDA NÃO DISPONÍVEL'}</strong><p>{historyAvailable ? `Score ${formatPoints(historyScore.current)} · variação ${formatPoints(historyScore.delta)} desde a última leitura.` : 'Configure a persistência executiva para comparar esta leitura com ontem, semana anterior ou último snapshot. O Nexus não fabrica tendências.'}</p>{historyAvailable && historyChanges.length > 0 ? <div className="analytics-history-changes">{historyChanges.map(change => <span key={change.key}><b>{change.label}</b><em>{change.previous} → {change.current}</em></span>)}</div> : null}</div><span className="analytics-comparison-badge">{historyAvailable ? 'LIVE' : 'N/D'}</span></div>
    </section>
  );
}

export default ExecutiveAnalyticsCenter;
