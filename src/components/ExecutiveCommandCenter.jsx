import React from 'react';
import { ArrowUpRight, BarChart3, ShieldAlert, Clock3, Target, Users } from 'lucide-react';
import { buildMissions, formatNumber, formatPct, formatPoints } from './executive-helpers.js';
import { TrendChart } from './ExecutiveAnalyticsCenter.jsx';

const top = (items, count = 3) => (Array.isArray(items) ? items.slice(0, count) : []);

function Metric({ label, value, note, tone = 'neutral', onClick }) {
  const content = <><span>{label}</span><strong>{value}</strong><small>{note}</small></>;
  return onClick
    ? <button type="button" className={`command-metric ${tone}`} onClick={onClick}>{content}<ArrowUpRight size={14} /></button>
    : <div className={`command-metric ${tone}`}>{content}</div>;
}

function DecisionCard({ mission, index, onSelect }) {
  return <button type="button" className={`command-decision-card ${mission.accent || 'attention'}`} onClick={() => onSelect?.(mission.kpiId, mission.readinessId)}>
    <span className="command-decision-order">0{index + 1}</span>
    <div><small>{mission.source || 'Sinal executivo observado'}</small><strong>{mission.title}</strong><p>{formatNumber(mission.current)} {mission.unit} · {formatPoints(mission.recoverablePoints)} recuperáveis</p></div>
    <ArrowUpRight size={16} />
  </button>;
}

export default function ExecutiveCommandCenter({ snapshot, timeSeries, intelligence, onSelect, onOpenAnalyst, onOpenHistory }) {
  const quantitative = snapshot?.quantitative || {};
  const productivity = snapshot?.productivity || {};
  const summary = snapshot?.summary || {};
  const execution = snapshot?.portfolioExecution || {};
  const active = Number(productivity.activeItems ?? quantitative.activeItems) || 0;
  const completed = Number(productivity.completedItems ?? quantitative.completedItems) || 0;
  const delayed = Number(summary.delayedTeam ?? quantitative.overdueInternal) || 0;
  const demandRows = Array.isArray(snapshot?.demandItemRows) ? snapshot.demandItemRows : (Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : []);
  const demands = demandRows.length;
  const demandDelayed = Number(summary.delayedDemands) || 0;
  const ready = Number(productivity.readyToSchedule) || 0;
  const score = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score);
  const total = active + completed;
  const missions = top(buildMissions(snapshot), 3);
  const owners = top(productivity.topResponsibles, 4);
  const clients = top((snapshot?.clientRanking || []).filter(client => Number(client.delayedItems) > 0).sort((a, b) => Number(b.riskPct) - Number(a.riskPct)), 4);
  const stalled = Array.isArray(execution.stalled) ? execution.stalled.length : 0;
  const historyReady = timeSeries?.available === true;
  const projection = intelligence?.projections;
  const persistentRisks = Array.isArray(intelligence?.persistentRisks) ? intelligence.persistentRisks.length : null;
  const alerts = Array.isArray(intelligence?.alerts) ? intelligence.alerts.length : null;
  const clientRiskCount = Number.isFinite(Number(intelligence?.clientHealth?.atRiskCount)) ? Number(intelligence.clientHealth.atRiskCount) : null;
  const evaluatedDecisions = Number.isFinite(Number(intelligence?.effectiveness?.evaluatedDecisions)) ? Number(intelligence.effectiveness.evaluatedDecisions) : null;
  const liveChanges = intelligence?.liveChanges || null;
  const changedItems = Array.isArray(liveChanges?.affectedItems) ? liveChanges.affectedItems.slice(0, 4) : [];

  return <section className="command-center" aria-label="Resumo executivo da agência">
    <header className="command-hero">
      <div className="command-hero-copy">
        <span className="command-eyebrow"><Target size={14} /> COMANDO EXECUTIVO · AGORA</span>
        <h1>{delayed > 0 ? `${delayed} entregas exigem decisão.` : stalled > 0 ? `${stalled} clientes precisam de retomada.` : 'Operação sem pressão crítica dominante.'}</h1>
        <p>{missions[0]?.description || 'O Nexus organiza o próximo movimento com base nos sinais observáveis da operação.'}</p>
        <div className="command-hero-actions">
          <button type="button" className="command-primary" onClick={() => missions[0] && onSelect?.(missions[0].kpiId, missions[0].readinessId)}>ABRIR PRIORIDADE <ArrowUpRight size={15} /></button>
          <button type="button" className="command-secondary" onClick={onOpenAnalyst}>INVESTIGAR NO ANALISTA</button>
        </div>
      </div>
      <div className="command-score">
        <span>PLACAR DA OPERAÇÃO</span>
        <strong>{Number.isFinite(score) ? formatPoints(score) : 'N/D'}</strong>
        <small>{delayed + demandDelayed + stalled} sinais de pressão ativos</small>
      </div>
    </header>

    <div className="command-metric-grid">
      <Metric label="EM FLUXO" value={formatNumber(active)} note={`${formatPct(total ? active / total * 100 : null)} da base`} onClick={() => onSelect?.('active')} />
      <Metric label="ATRASOS · PRODUÇÃO" value={formatNumber(delayed)} note={`${formatPct(active ? delayed / active * 100 : null)} dos ativos`} tone={delayed ? 'critical' : 'stable'} onClick={() => onSelect?.('delays')} />
      <Metric label="DEMANDAS VENCIDAS" value={formatNumber(demandDelayed)} note={`${formatNumber(demands)} solicitações abertas`} tone={demandDelayed ? 'warning' : 'stable'} onClick={() => onSelect?.('health')} />
      <Metric label="PRONTOS PARA AGENDAR" value={formatNumber(ready)} note={`${formatPct(active ? ready / active * 100 : null)} dos ativos`} tone="cyan" onClick={() => onSelect?.('ready')} />
      <Metric label="SEM EXECUÇÃO" value={formatNumber(stalled)} note="clientes ativos" tone={stalled ? 'warning' : 'stable'} onClick={() => onSelect?.('execution')} />
    </div>

    <section className={`command-live-changes${liveChanges?.available ? ' available' : ''}`} aria-label="Mudanças desde a última sincronização">
      <div className="command-live-changes-heading"><div><Clock3 size={15} /><span>MUDANÇAS DESDE A ÚLTIMA SINCRONIZAÇÃO</span></div><small>{liveChanges?.version ? `espelho v${liveChanges.version}` : 'delta do Vybe Painel'}</small></div>
      {liveChanges?.available ? <><div className="command-live-change-metrics"><strong>{formatNumber(liveChanges.count)} <small>itens afetados</small></strong><strong>{formatNumber(liveChanges.completed)} <small>finalizados</small></strong><strong>{formatNumber(liveChanges.removed)} <small>removidos</small></strong></div><div className="command-live-change-list">{changedItems.map(item => <button type="button" key={`${item.itemId}-${item.changedAt}`} onClick={() => onSelect?.(`item:${item.itemId}`)}><span>{item.itemName}</span><small>{[item.status, item.client, item.stage].filter(Boolean).join(' · ') || 'mudança operacional'}</small><ArrowUpRight size={13} /></button>)}</div></> : <p className="command-live-changes-empty">Nenhuma mudança nova recebida nesta sincronização. O Nexus está acompanhando o delta sem reconsultar o histórico operacional.</p>}
    </section>

    <div className="command-core-grid">
      <article className="command-panel command-decisions">
        <header><div><ShieldAlert size={15} /><span>DECISÕES PRIORITÁRIAS</span></div><small>somente os 3 maiores sinais</small></header>
        <div className="command-decision-list">
          {missions.length ? missions.map((mission, index) => <DecisionCard key={mission.id} mission={mission} index={index} onSelect={onSelect} />) : <div className="command-empty">Nenhuma missão crítica nesta leitura.</div>}
        </div>
      </article>

      <article className="command-panel command-operations">
        <header><div><Target size={15} /><span>PRESSÃO OPERACIONAL</span></div><small>Produção × Solicitações</small></header>
        <div className="command-operation-row"><div><span>PRODUÇÃO DE CONTEÚDO</span><strong>{formatNumber(active)} em fluxo</strong><small>{formatNumber(delayed)} atrasos internos</small></div><i><b className="production" style={{ width: `${Math.min(100, active ? delayed / active * 100 : 0)}%` }} /></i></div>
        <div className="command-operation-row"><div><span>SOLICITAÇÕES DE DEMANDAS</span><strong>{formatNumber(demands)} abertas</strong><small>{formatNumber(demandDelayed)} vencidas</small></div><i><b className="demands" style={{ width: `${Math.min(100, demands ? demandDelayed / demands * 100 : 0)}%` }} /></i></div>
        <div className="command-operation-row"><div><span>ENTREGA</span><strong>{formatNumber(completed)} concluídos</strong><small>{formatNumber(ready)} prontos para agenda</small></div><i><b className="delivery" style={{ width: `${Math.min(100, total ? completed / total * 100 : 0)}%` }} /></i></div>
      </article>
    </div>

    <section className="command-memory-strip"><header><div><Clock3 size={15} /><span>MEMÓRIA EXECUTIVA</span></div><small>o presente vira histórico quando há persistência</small><button type="button" onClick={onOpenHistory}>ABRIR HISTÓRIA ↗</button></header><div className="command-memory-grid"><div><strong>{alerts === null ? 'N/D' : formatNumber(alerts)}</strong><span>alertas em ciclo</span></div><div><strong>{persistentRisks === null ? 'N/D' : formatNumber(persistentRisks)}</strong><span>riscos persistentes</span></div><div><strong>{clientRiskCount === null ? 'N/D' : formatNumber(clientRiskCount)}</strong><span>clientes em risco histórico</span></div><div><strong>{evaluatedDecisions === null ? 'N/D' : formatNumber(evaluatedDecisions)}</strong><span>decisões com impacto medido</span></div></div></section>

    <div className="command-signal-grid">
      <article className="command-panel">
        <header><div><Users size={15} /><span>CAPACIDADE DO TIME</span></div><small>concentração observável</small></header>
        <div className="command-ranking">
          {owners.map(owner => <button type="button" key={owner.name} onClick={() => onSelect?.(`owner:${owner.name}`)}><span>{owner.name}</span><strong>{formatNumber(owner.delayedTotal || 0)}</strong><small>atrasos associados</small></button>)}
        </div>
      </article>
      <article className="command-panel">
        <header><div><BarChart3 size={15} /><span>CLIENTES SOB PRESSÃO</span></div><small>atrasos / itens abertos</small></header>
        <div className="command-ranking clients">
          {clients.map(client => <button type="button" key={client.client} onClick={() => onSelect?.(`client:${client.client}`)}><span>{client.client}</span><strong>{formatPct(client.riskPct)}</strong><small>{formatNumber(client.delayedItems)} atrasos</small></button>)}
        </div>
      </article>
    </div>

    {historyReady ? <section className="command-history-live"><div><Clock3 size={16} /><span>HISTÓRIA DA OPERAÇÃO</span><small>Veja a evolução real e os eventos que mudaram a carteira.</small></div><button type="button" onClick={onOpenHistory}>ABRIR HISTÓRIA ↗</button></section> : <section className="command-history-strip">
      <div><Clock3 size={16} /><span>HISTÓRICO AINDA NÃO ATIVO</span><small>A leitura atual está funcionando; a comparação temporal aguarda o datastore de snapshots.</small></div>
      <div><strong>{projection?.mode === 'observed_trend' ? 'TENDÊNCIA ATIVA' : 'SEM PREVISÃO HISTÓRICA'}</strong><small>{projection?.mode === 'observed_trend' ? 'Comparações baseadas em snapshots reais.' : 'Cenários de esforço permanecem disponíveis no Analytics.'}</small></div><button type="button" onClick={onOpenHistory}>VER HISTÓRIA & LOGS ↗</button>
    </section>}
  </section>;
}
