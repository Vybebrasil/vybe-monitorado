import { useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Filter, ShieldAlert, Target } from 'lucide-react';
import { formatNumber, formatPoints } from './executive-helpers.js';
import { TrendChart } from './ExecutiveAnalyticsCenter.jsx';
import { ExecutiveInsightHeader } from './ExecutiveInsightHeader.jsx';

const EVENT_LABELS = {
  item_entered_scope: 'Item entrou no fluxo',
  item_left_scope: 'Item saiu do fluxo',
  status_changed: 'Status alterado',
  deadline_changed: 'Prazo alterado',
  delay_started: 'Atraso iniciado',
  delay_resolved: 'Atraso resolvido',
  responsible_changed: 'Responsável alterado',
  stage_changed: 'Etapa alterada',
  operational_update: 'Atualização do Vybe Painel',
  snapshot_captured: 'Snapshot capturado'
};

const EVENT_TONES = {
  delay_started: 'critical',
  deadline_changed: 'warning',
  status_changed: 'cyan',
  operational_update: 'cyan',
  delay_resolved: 'positive',
  snapshot_captured: 'neutral'
};

function formatEventDate(value) {
  if (!value) return 'data indisponível';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'data indisponível' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function ChangeStat({ label, value, delta }) {
  const numericDelta = Number(delta);
  const direction = Number.isFinite(numericDelta) && numericDelta > 0 ? 'up' : Number.isFinite(numericDelta) && numericDelta < 0 ? 'down' : 'flat';
  return <div className={`history-change-stat ${direction}`}><span>{label}</span><strong>{value}</strong><small>{Number.isFinite(numericDelta) ? `${numericDelta > 0 ? '+' : ''}${formatNumber(numericDelta)} desde o início da janela` : 'sem comparação'}</small></div>;
}

export default function ExecutiveHistoryCenter({ snapshot, timeSeries, history, intelligence, onOpenAnalyst }) {
  const [eventType, setEventType] = useState('all');
  const [eventSource, setEventSource] = useState('all');
  const [eventClient, setEventClient] = useState('all');
  const [eventResponsible, setEventResponsible] = useState('all');
  const [eventStage, setEventStage] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const events = Array.isArray(intelligence?.events) ? intelligence.events : [];
  const clients = [...new Set(events.map(event => event.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const responsibles = [...new Set(events.map(event => event.responsible).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const stages = [...new Set(events.map(event => event.stage).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const types = [...new Set(events.map(event => event.type).filter(Boolean))];
  const filteredEvents = events
    .filter(event => eventType === 'all' || event.type === eventType)
    .filter(event => eventSource === 'all' || event.source === eventSource)
    .filter(event => eventClient === 'all' || event.client === eventClient)
    .filter(event => eventResponsible === 'all' || event.responsible === eventResponsible)
    .filter(event => eventStage === 'all' || event.stage === eventStage);
  const visibleEvents = showAll ? filteredEvents : filteredEvents.slice(0, 8);
  const points = Array.isArray(timeSeries?.points) ? timeSeries.points : [];
  const current = points.at(-1) || null;
  const baseline = points[0] || null;
  const historyReady = timeSeries?.available === true && points.length >= 2;
  const currentScore = Number.isFinite(Number(current?.score)) ? formatPoints(current.score) : Number.isFinite(Number(snapshot?.portfolioStability?.score)) ? formatPoints(snapshot.portfolioStability.score) : 'N/D';
  const baselineScore = Number.isFinite(Number(baseline?.score)) ? formatPoints(baseline.score) : 'N/D';
  const deltaScore = Number.isFinite(Number(current?.score)) && Number.isFinite(Number(baseline?.score)) ? Number(current.score) - Number(baseline.score) : null;
  const historyMessage = timeSeries?.message || 'Configure o datastore executivo para acumular pontos reais.';
  const effectiveness = intelligence?.effectiveness || {};
  const learning = intelligence?.learning || {};
  const persistentRiskCount = Array.isArray(intelligence?.persistentRisks) ? intelligence.persistentRisks.length : 0;
  const eventCount = events.length;
  const alerts = Array.isArray(intelligence?.alerts) ? intelligence.alerts : [];
  const cycleSteps = [
    { label: 'Observado', value: eventCount, note: eventCount ? `${eventCount} mudanças registradas` : 'aguarda eventos persistidos' },
    { label: 'Investigado', value: persistentRiskCount, note: persistentRiskCount ? `${persistentRiskCount} riscos persistentes` : 'sem memória de risco' },
    { label: 'Decidido', value: Number(effectiveness.totalDecisions) || Number(effectiveness.evaluatedDecisions) || 0, note: effectiveness.totalDecisions || effectiveness.evaluatedDecisions ? 'decisões acompanhadas' : 'aguarda decisão registrada' },
    { label: 'Medido', value: Number(effectiveness.evaluatedDecisions) || 0, note: effectiveness.evaluatedDecisions ? `${Number(effectiveness.positiveRate) || 0}% com resultado` : 'aguarda impacto observado' },
    { label: 'Aprendido', value: Array.isArray(learning?.learnings) ? learning.learnings.length : 0, note: learning?.note || 'sem aprendizagem persistida' }
  ];

  return <section className="history-center" aria-label="História e logs executivos">
    <ExecutiveInsightHeader
      className="history-center-hero"
      eyebrow={<><Clock3 size={14} aria-hidden="true" /> História da operação</>}
      title="O que mudou e qual correção importa?"
      description="Snapshots mostram evolução; eventos mostram mudanças. Decisões e impactos fecham o ciclo quando a memória executiva está disponível."
      recommendation={historyReady ? `${formatNumber(eventCount)} eventos e ${formatNumber(points.length)} snapshots reais disponíveis para comparação.` : 'A leitura atual funciona; a comparação temporal e a memória de eventos aguardam persistência.'}
      impactLabel="Eventos observáveis"
      impactValue={events.length ? formatNumber(eventCount) : 'N/D'}
      impactNote={historyReady ? `${formatNumber(points.length)} snapshots persistidos` : 'histórico pendente'}
      tone={historyReady ? 'stable' : 'warning'}
      secondaryAction={historyReady ? undefined : 'Ver instruções'}
      onSecondary={historyReady ? undefined : onOpenAnalyst}
      context={history?.available ? 'Comparação real da operação.' : historyMessage}
    />

    {historyReady ? <>
      <div className="history-stat-grid">
        <ChangeStat label="Placar" value={`${currentScore} pts`} delta={deltaScore} />
        <ChangeStat label="Atrasos de Produção" value={formatNumber(current?.delayedProduction)} delta={Number(current?.delayedProduction) - Number(baseline?.delayedProduction)} />
        <ChangeStat label="Demandas vencidas" value={formatNumber(current?.overdueDemands)} delta={Number(current?.overdueDemands) - Number(baseline?.overdueDemands)} />
        <ChangeStat label="Itens concluídos" value={formatNumber(current?.completedItems)} delta={Number(current?.completedItems) - Number(baseline?.completedItems)} />
      </div>
      <article className="history-chart-panel"><header><div><Activity size={15} /><span>Linha do tempo · agência</span></div><small>{baselineScore} → {currentScore} no período</small></header><TrendChart timeSeries={timeSeries} /></article>
    </> : <section className="history-empty-panel"><div className="history-empty-icon"><Clock3 size={22} /></div><div><strong>A história ainda não começou a ser armazenada.</strong><p>A leitura atual funciona, mas o Nexus não pode desenhar linhas ou comparar períodos sem snapshots persistidos. Logs técnicos não substituem histórico operacional.</p><span>Ative o datastore de snapshots, decisões, impactos, saúde e eventos para transformar cada leitura real em memória executiva.</span></div><button type="button" onClick={onOpenAnalyst}>Abrir instruções <ArrowUpRight size={14} /></button></section>}

    <article className="history-cycle-panel"><header><div><Target size={15} /><span>Ciclo de correção</span></div><small>do sinal ao resultado</small></header><div className="history-cycle-track">{cycleSteps.map((step, index) => <div className={`history-cycle-step ${step.value > 0 ? 'available' : 'pending'}`} key={step.label}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step.label}</strong><b>{step.value > 0 ? formatNumber(step.value) : 'N/D'}</b><small>{step.note}</small></div>)}</div><p className="history-cycle-note">O Nexus só deve considerar uma correção comprovada quando existe decisão, checkpoint e impacto observado. Um log técnico sozinho não prova melhora.</p></article>

    <article className="history-alert-panel"><header><div><ShieldAlert size={15} /><span>Alertas acionáveis</span></div><small>{formatNumber(alerts.length)} sinais com próxima ação</small></header>{alerts.length ? <div className="history-alert-list">{alerts.slice(0, 5).map(alert => <div className={`history-alert-row ${alert.severity || 'medium'}`} key={alert.id}><div><strong>{alert.title || alert.label || 'Alerta executivo'}</strong><span>{alert.label || alert.type || 'sinal operacional'}</span></div><p>{alert.reason || 'O Nexus detectou um sinal que merece investigação.'}</p><small>Próximo: {alert.recommendedAction || 'abrir a investigação correspondente.'}</small></div>)}</div> : <div className="history-log-empty"><strong>Nenhum alerta acionável nesta leitura.</strong><span>Alertas aparecerão quando houver atraso, concentração, fonte desatualizada ou decisão sem acompanhamento.</span></div>}</article>

    <div className="history-log-panel">
      <header><div><ShieldAlert size={15} /><span>Eventos executivos</span></div><small>{formatNumber(filteredEvents.length)} eventos no recorte</small></header>
      <div className="history-log-explainer"><Target size={14} /><span><strong>Não são logs técnicos.</strong> São mudanças de operação derivadas de snapshots e deltas do Vybe Painel: status, prazo, atraso, responsável, etapa e recuperação.</span></div>
      <div className="history-filter-bar" aria-label="Filtros da história">
        <label><Filter size={13} /><span>Tipo</span><select value={eventType} onChange={event => setEventType(event.target.value)}><option value="all">Todos</option>{types.map(type => <option key={type} value={type}>{EVENT_LABELS[type] || type}</option>)}</select></label>
        <label><span>Fonte</span><select value={eventSource} onChange={event => setEventSource(event.target.value)}><option value="all">Todas</option><option value="Vybe Painel · espelho operacional">Vybe Painel</option><option value="Produção de Conteúdo">Produção de Conteúdo</option><option value="Solicitações de Demandas">Solicitações de Demandas</option></select></label>
        <label><span>Cliente</span><select value={eventClient} onChange={event => setEventClient(event.target.value)}><option value="all">Todos</option>{clients.map(client => <option key={client} value={client}>{client}</option>)}</select></label>
        <label><span>Responsável</span><select value={eventResponsible} onChange={event => setEventResponsible(event.target.value)}><option value="all">Todos</option>{responsibles.map(responsible => <option key={responsible} value={responsible}>{responsible}</option>)}</select></label>
        <label><span>Etapa</span><select value={eventStage} onChange={event => setEventStage(event.target.value)}><option value="all">Todas</option>{stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select></label>
      </div>
      {visibleEvents.length ? <div className="history-event-list">{visibleEvents.map(event => <article key={event.id} className={`history-event-row ${EVENT_TONES[event.type] || 'neutral'}`}><div className="history-event-time">{formatEventDate(event.capturedAt)}</div><div className="history-event-dot" /><div className="history-event-content"><div><strong>{event.title || EVENT_LABELS[event.type] || 'Evento executivo'}</strong><span>{EVENT_LABELS[event.type] || event.type}</span></div><p>{event.detail || 'Mudança observada na leitura operacional.'}</p><small>{[event.source, event.client, event.responsible, event.stage].filter(Boolean).join(' · ')}</small></div>{event.evidenceUrl ? <a href={event.evidenceUrl} target="_blank" rel="noreferrer">Monday ↗</a> : null}</article>)}</div> : <div className="history-log-empty"><strong>{events.length ? 'Nenhum evento corresponde aos filtros.' : 'Nenhum evento executivo persistido ainda.'}</strong><span>{events.length ? 'Amplie o recorte para visualizar outras mudanças.' : 'Quando a persistência estiver ativa, cada captura poderá gerar uma mudança rastreável aqui.'}</span></div>}
      {filteredEvents.length > 8 ? <button type="button" className="history-more-button" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `Ver mais (${filteredEvents.length - 8})`}</button> : null}
    </div>
  </section>;
}
