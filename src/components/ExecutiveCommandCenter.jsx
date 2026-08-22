import React from 'react';
import { ArrowUpRight, BarChart3, Clock3, ShieldAlert, Target, Users } from 'lucide-react';
import { buildMissions, formatNumber, formatPct, formatPoints } from './executive-helpers.js';
import { TrendChart } from './ExecutiveAnalyticsCenter.jsx';
import { ExecutiveDisclosure, ExecutiveInsightHeader, ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';
import { ExecutiveEvidencePreview } from './ExecutiveEvidencePreview.jsx';

const top = (items, count = 3) => (Array.isArray(items) ? items.slice(0, count) : []);

function Metric({ label, value, note, tone = 'neutral', onClick, priority = 'supporting' }) {
  const content = <><span>{label}</span><strong>{value}</strong><small>{note}</small></>;
  return onClick
    ? <button type="button" className={`command-metric ${tone} ${priority}`} onClick={onClick} aria-label={`${label}: ${value}`}>{content}<ArrowUpRight size={14} aria-hidden="true" /></button>
    : <div className={`command-metric ${tone} ${priority}`}>{content}</div>;
}

function DecisionCard({ mission, index, onSelect }) {
  return <button type="button" className={`command-decision-card ${mission.accent || 'attention'}`} onClick={() => onSelect?.(mission.kpiId, mission.readinessId)}>
    <span className="command-decision-order">0{index + 1}</span>
    <div><small>{mission.source || 'Sinal executivo observado'}</small><strong>{mission.title}</strong><p>{formatNumber(mission.current)} {mission.unit} · {formatPoints(mission.recoverablePoints)} recuperáveis</p></div>
    <ArrowUpRight size={16} aria-hidden="true" />
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
  const demandOpenCount = demands > 0 || demandDelayed === 0 ? demands : null;
  const demandDataNote = demandOpenCount === null ? 'abertas N/D · board não reconciliado' : `${formatNumber(demandOpenCount)} solicitações abertas`;
  const ready = Number(productivity.readyToSchedule) || 0;
  const score = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score);
  const total = active + completed;
  const missions = top(buildMissions(snapshot), 3);
  const owners = top(productivity.topResponsibles, 3);
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
  const primaryMission = missions[0];
  const tone = delayed > 0 ? 'critical' : stalled > 0 ? 'warning' : 'stable';

  return <section className="command-center" aria-label="Resumo executivo da agência">
    <ExecutiveInsightHeader
      className="command-hero"
      eyebrow={<><Target size={14} aria-hidden="true" /> Comando executivo · agora</>}
      title={delayed > 0 ? `${delayed} entregas exigem decisão.` : stalled > 0 ? `${stalled} clientes precisam de retomada.` : 'Operação sem pressão crítica dominante.'}
      description={primaryMission?.description || 'O Nexus organiza o próximo movimento com base nos sinais observáveis da operação.'}
      recommendation={primaryMission ? `${primaryMission.title} · ${formatNumber(primaryMission.current)} ${primaryMission.unit}.` : 'Acompanhar os sinais que podem mudar a decisão.'}
      impactLabel="Placar atual"
      impactValue={Number.isFinite(score) ? formatPoints(score) : 'N/D'}
      impactNote={`${delayed + demandDelayed + stalled} sinais de pressão ativos`}
      tone={tone}
      primaryAction="Abrir prioridade"
      onPrimary={() => primaryMission && onSelect?.(primaryMission.kpiId, primaryMission.readinessId)}
      secondaryAction="Investigar no Analista"
      onSecondary={onOpenAnalyst}
      context="Produção de Conteúdo e Solicitações de Demandas seguem separadas nesta leitura."
    />

    <div className="command-metric-grid" aria-label="Indicadores de apoio à decisão">
      <Metric label="Em fluxo" value={formatNumber(active)} note={`${formatPct(total ? active / total * 100 : null)} da base`} onClick={() => onSelect?.('active')} />
      <Metric label="Atrasos · Produção" value={formatNumber(delayed)} note={`${formatPct(active ? delayed / active * 100 : null)} dos ativos`} tone={delayed ? 'critical' : 'stable'} onClick={() => onSelect?.('delays')} priority="primary" />
      <Metric label="Demandas vencidas" value={formatNumber(demandDelayed)} note={demandDataNote} tone={demandDelayed ? 'warning' : 'stable'} onClick={() => onSelect?.('health')} priority="primary" />
      <Metric label="Prontos para agendar" value={formatNumber(ready)} note={`${formatPct(active ? ready / active * 100 : null)} dos ativos`} tone="cyan" onClick={() => onSelect?.('ready')} />
      <Metric label="Sem execução" value={formatNumber(stalled)} note="clientes ativos" tone={stalled ? 'warning' : 'stable'} onClick={() => onSelect?.('execution')} priority="primary" />
    </div>

    <section className={`command-live-changes${liveChanges?.available ? ' available' : ''}`} aria-label="Mudanças desde a última sincronização">
      <div className="command-live-changes-heading"><div><Clock3 size={15} aria-hidden="true" /><span>Mudanças desde a última sincronização</span></div><small>{liveChanges?.version ? `espelho v${liveChanges.version}` : 'delta do Vybe Painel'}</small></div>
      {liveChanges?.available ? <><div className="command-live-change-metrics"><strong>{formatNumber(liveChanges.count)} <small>itens afetados</small></strong><strong>{formatNumber(liveChanges.completed)} <small>finalizados</small></strong><strong>{formatNumber(liveChanges.removed)} <small>removidos</small></strong></div><div className="command-live-change-list">{changedItems.map(item => <button type="button" key={`${item.itemId}-${item.changedAt}`} onClick={() => onSelect?.(`item:${item.itemId}`)}><span>{item.itemName}</span><small>{[item.status, item.client, item.stage].filter(Boolean).join(' · ') || 'mudança operacional'}</small><ArrowUpRight size={13} aria-hidden="true" /></button>)}</div></> : <p className="command-live-changes-empty">Nenhuma mudança nova recebida nesta sincronização. O Nexus está acompanhando o delta sem reconsultar o histórico operacional.</p>}
    </section>

    <div className="command-core-grid">
      <article className="command-panel command-decisions">
        <ExecutiveSectionHeader icon={ShieldAlert} eyebrow="Agora" title="Decisões prioritárias" note="até 3 sinais" />
        <div className="command-decision-list">
          {missions.length ? missions.map((mission, index) => <DecisionCard key={mission.id} mission={mission} index={index} onSelect={onSelect} />) : <div className="command-empty">Nenhuma missão crítica nesta leitura.</div>}
        </div>
      </article>

      <article className="command-panel command-operations">
        <ExecutiveSectionHeader icon={Target} eyebrow="Contexto" title="Pressão operacional" note="Produção × Solicitações" />
        <div className="command-operation-row"><div><span>Produção de Conteúdo</span><strong>{formatNumber(active)} em fluxo</strong><small>{formatNumber(delayed)} atrasos internos</small></div><i><b className="production" style={{ width: `${Math.min(100, active ? delayed / active * 100 : 0)}%` }} /></i></div>
        <div className="command-operation-row"><div><span>Solicitações de Demandas</span><strong>{demandOpenCount === null ? 'N/D abertas' : `${formatNumber(demandOpenCount)} abertas`}</strong><small>{formatNumber(demandDelayed)} vencidas · {demandOpenCount === null ? 'board não reconciliado' : 'coorte atual'}</small></div><i><b className="demands" style={{ width: `${Math.min(100, demandOpenCount ? demandDelayed / demandOpenCount * 100 : 0)}%` }} /></i></div>
        <div className="command-operation-row"><div><span>Entrega</span><strong>{formatNumber(completed)} concluídos</strong><small>{formatNumber(ready)} prontos para agenda</small></div><i><b className="delivery" style={{ width: `${Math.min(100, total ? completed / total * 100 : 0)}%` }} /></i></div>
      </article>
    </div>

    <ExecutiveDisclosure label="Memória executiva" summary={historyReady ? 'histórico real disponível' : 'sem snapshots persistidos nesta implantação'}>
      <div className="command-memory-strip-inner">
        <p>O presente vira histórico quando há persistência.</p>
        <button type="button" className="executive-inline-link" onClick={onOpenHistory}>Abrir história ↗</button>
        <div className="command-memory-grid"><div><strong>{alerts === null ? 'N/D' : formatNumber(alerts)}</strong><span>alertas em ciclo</span></div><div><strong>{persistentRisks === null ? 'N/D' : formatNumber(persistentRisks)}</strong><span>riscos persistentes</span></div><div><strong>{clientRiskCount === null ? 'N/D' : formatNumber(clientRiskCount)}</strong><span>clientes em risco histórico</span></div><div><strong>{evaluatedDecisions === null ? 'N/D' : formatNumber(evaluatedDecisions)}</strong><span>decisões com impacto medido</span></div></div>
      </div>
    </ExecutiveDisclosure>

    <div className="command-signal-grid">
      <article className="command-panel">
        <ExecutiveSectionHeader icon={Users} eyebrow="Sinais de capacidade" title="Capacidade do time" note="top 3 atrasos" />
        <ExecutiveEvidencePreview title="Concentração atual" note="clique para investigar" items={owners} total={productivity.topResponsibles?.length || owners.length} empty="Nenhum atraso interno mapeado." renderItem={owner => <button type="button" className="command-ranking-row" onClick={() => onSelect?.(`owner:${owner.name}`)}><span>{owner.name}</span><strong>{formatNumber(owner.delayedTotal || 0)}</strong><small>atrasos associados</small><ArrowUpRight size={13} aria-hidden="true" /></button>} />
      </article>
      <article className="command-panel">
        <ExecutiveSectionHeader icon={BarChart3} eyebrow="Previsibilidade" title="Clientes sob pressão" note="top 4 exposições" />
        <ExecutiveEvidencePreview title="Risco atual" note="atrasos / itens abertos" items={clients} total={snapshot?.clientRanking?.filter(client => Number(client.delayedItems) > 0).length || clients.length} empty="Nenhum cliente exposto nesta leitura." renderItem={client => <button type="button" className="command-ranking-row clients" onClick={() => onSelect?.(`client:${client.client}`)}><span>{client.client}</span><strong>{formatPct(client.riskPct)}</strong><small>{formatNumber(client.delayedItems)} atrasos</small><ArrowUpRight size={13} aria-hidden="true" /></button>} />
      </article>
    </div>

    {historyReady ? <section className="command-history-live"><div><Clock3 size={16} aria-hidden="true" /><span>História da operação</span><small>Veja a evolução real e os eventos que mudaram a carteira.</small></div><button type="button" onClick={onOpenHistory}>Abrir história ↗</button></section> : <section className="command-history-strip">
      <div><Clock3 size={16} aria-hidden="true" /><span>Histórico ainda não ativo</span><small>A leitura atual está funcionando; a comparação temporal aguarda o datastore de snapshots.</small></div>
      <div><strong>{projection?.mode === 'observed_trend' ? 'Tendência ativa' : 'Sem previsão histórica'}</strong><small>{projection?.mode === 'observed_trend' ? 'Comparações baseadas em snapshots reais.' : 'Cenários de esforço permanecem disponíveis no Analytics.'}</small></div><button type="button" onClick={onOpenHistory}>Ver história e logs ↗</button>
    </section>}
  </section>;
}
