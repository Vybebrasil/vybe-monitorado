import React from 'react';
import { formatNumber, formatPct } from './executive-helpers.js';

const COMPLETED_STATUSES = ['finalizado', 'publicado', 'cancelado', 'feito', 'concluído', 'entregue'];
const ownersOf = item => [...new Set([
  ...(Array.isArray(item?.responsavelPeople) ? item.responsavelPeople.map(person => person?.name).filter(Boolean) : []),
  ...String(item?.owner || item?.responsible || item?.responsavel || '').split(/[,;|]/).map(value => value.trim()).filter(Boolean)
])];
const statusOf = item => String(item?.status || '').trim();
const completedOf = item => Boolean(item?.isCompleted) || COMPLETED_STATUSES.some(status => statusOf(item).toLowerCase().includes(status));
const delayedOf = item => Boolean(item?.isDelayed || item?.isDelayedPrazo || item?.isDelayedVeiculacao || item?.overdue || item?.delayType);
const stageOf = item => String(item?.stage || item?.etapa || item?.quadro || 'Etapa não informada').trim() || 'Etapa não informada';

function buildObservableOwners(rows) {
  const map = new Map();
  rows.forEach(item => ownersOf(item).forEach(name => {
    const current = map.get(name) || { name, total: 0, active: 0, completed: 0, delayed: 0, ready: 0 };
    current.total += 1;
    if (completedOf(item)) current.completed += 1;
    else current.active += 1;
    if (delayedOf(item) && !completedOf(item)) current.delayed += 1;
    if (['agendado', 'para agendar'].some(status => statusOf(item).toLowerCase().includes(status))) current.ready += 1;
    map.set(name, current);
  }));
  return [...map.values()].map(owner => ({
    ...owner,
    completionPct: owner.total ? Number(((owner.completed / owner.total) * 100).toFixed(1)) : null,
    delayedPct: owner.active ? Number(((owner.delayed / owner.active) * 100).toFixed(1)) : null
  })).sort((a, b) => b.delayed - a.delayed || b.active - a.active || a.name.localeCompare(b.name));
}

function buildObservableStages(rows) {
  const map = new Map();
  rows.filter(item => !completedOf(item)).forEach(item => {
    const stage = stageOf(item);
    const current = map.get(stage) || { stage, active: 0, delayed: 0 };
    current.active += 1;
    if (delayedOf(item)) current.delayed += 1;
    map.set(stage, current);
  });
  return [...map.values()].map(stage => ({ ...stage, delayedPct: stage.active ? Number(((stage.delayed / stage.active) * 100).toFixed(1)) : null }))
    .sort((a, b) => b.active - a.active || b.delayed - a.delayed);
}

export function ExecutivePerformancePanel({ snapshot, onOpenOwner }) {
  const productivity = snapshot?.productivity || {};
  const activeItems = Number(productivity.activeItems ?? snapshot?.quantitative?.activeItems) || 0;
  const completedItems = Number(productivity.completedItems ?? snapshot?.quantitative?.completedItems) || 0;
  const delayedItems = Number(productivity.delayedItems ?? snapshot?.quantitative?.overdueInternal) || 0;
  const readyToSchedule = Number(productivity.readyToSchedule) || 0;
  const totalScope = activeItems + completedItems;
  const owners = Array.isArray(productivity.topResponsibles) ? productivity.topResponsibles : [];
  const stages = Array.isArray(productivity.byStage) ? productivity.byStage : [];
  const detailedRows = snapshot?.itemRowsComplete === true && Array.isArray(snapshot?.itemRows) ? snapshot.itemRows : [];
  const derivedOwners = detailedRows.length ? buildObservableOwners(detailedRows) : [];
  const derivedStages = detailedRows.length ? buildObservableStages(detailedRows) : [];
  const visibleStages = derivedStages.length ? derivedStages : stages.map(stage => ({ ...stage, active: Number(stage.count) || 0, delayed: null, delayedPct: null }));
  const topOwners = (derivedOwners.length ? derivedOwners : owners.map(owner => {
    const active = Array.isArray(owner.posts) ? owner.posts.length : (Number(owner.posts) || 0);
    return {
      name: owner.name,
      total: active,
      active,
      completed: null,
      delayed: Number(owner.delayedTotal) || 0,
      ready: 0,
      completionPct: null,
      delayedPct: active ? Number((((Number(owner.delayedTotal) || 0) / active) * 100).toFixed(1)) : null
    };
  })).slice(0, 6);

  const largestLoad = [...topOwners].sort((a, b) => Number(b.active) - Number(a.active))[0];
  const highestDelay = [...topOwners].filter(owner => Number(owner.active) > 0).sort((a, b) => Number(b.delayedPct) - Number(a.delayedPct))[0];
  const bottleneck = [...visibleStages].sort((a, b) => Number(b.delayedPct) - Number(a.delayedPct))[0];

  return (
    <section className="executive-module performance-module team-command" aria-label="Visão executiva de time e performance">
      <header className="team-command-hero">
        <div><span className="executive-section-kicker">TIME · CAPACIDADE OBSERVÁVEL</span><h2>O time está absorvendo a operação?</h2><p>Compare carga, entrega e pressão sem transformar volume em avaliação de valor individual.</p></div>
        <div className="team-command-answer"><span>RESPOSTA AGORA</span><strong>{delayedItems > 0 ? `${formatPct(activeItems ? delayedItems / activeItems * 100 : null)} da carteira está atrasada` : 'Sem atraso dominante'}</strong><small>Monday.com · Produção de Conteúdo</small></div>
      </header>

      <div className="team-command-kpis">
        <div><span>EM EXECUÇÃO</span><strong>{formatNumber(activeItems)}</strong><small>itens ativos</small></div>
        <div><span>CONCLUÍDOS</span><strong>{formatNumber(completedItems)}</strong><small>{formatPct(totalScope ? completedItems / totalScope * 100 : null)} da base</small></div>
        <div className="critical"><span>ATRASADOS</span><strong>{formatNumber(delayedItems)}</strong><small>{formatPct(activeItems ? delayedItems / activeItems * 100 : null)} dos ativos</small></div>
        <div className="cyan"><span>PRONTOS PARA AGENDA</span><strong>{formatNumber(readyToSchedule)}</strong><small>próxima entrega</small></div>
      </div>

      <div className="team-command-signals">
        <div><span>MAIOR CARGA OBSERVADA</span><strong>{largestLoad?.name || 'N/D'}</strong><small>{largestLoad ? `${formatNumber(largestLoad.active)} ativos` : 'Sem dados completos'}</small></div>
        <div><span>MAIOR PRESSÃO RELATIVA</span><strong>{highestDelay?.name || 'N/D'}</strong><small>{highestDelay ? `${formatPct(highestDelay.delayedPct)} dos ativos em atraso` : 'Sem dados completos'}</small></div>
        <div><span>ETAPA MAIS PRESSIONADA</span><strong>{bottleneck?.stage || 'N/D'}</strong><small>{bottleneck ? `${formatNumber(bottleneck.delayed || 0)} atrasos · ${formatPct(bottleneck.delayedPct)}` : 'Sem dados completos'}</small></div>
      </div>

      <div className="team-command-grid">
        <article className="team-capacity-panel">
          <header><div><span>MAPA DE CAPACIDADE</span><strong>Pessoas e carga atual</strong></div><small>clique para investigar</small></header>
          {topOwners.length === 0 ? <div className="executive-empty-state"><strong>Dados de responsável não disponíveis.</strong><span>O Nexus não transforma ausência de dados em uma nota individual.</span></div> : <div className="team-capacity-cards">{topOwners.map(owner => {
            const delayed = Number(owner.delayed) || 0;
            const delayedPct = owner.delayedPct;
            return <button type="button" className="team-capacity-card" key={owner.name} onClick={() => onOpenOwner?.(owner.name)}>
              <span className="team-capacity-name">{owner.name}</span><b>{formatPct(delayedPct)}</b>
              <i><em style={{ width: `${Math.min(100, Number(delayedPct) || 0)}%` }} /></i>
              <div><small>ATIVOS<strong>{formatNumber(owner.active)}</strong></small><small>CONCLUÍDOS<strong>{owner.completed === null ? 'N/D' : formatNumber(owner.completed)}</strong></small><small>ATRASOS<strong>{formatNumber(delayed)}</strong></small></div>
              <u>INVESTIGAR ↗</u>
            </button>;
          })}</div>}
        </article>

        <aside className="team-stage-panel">
          <header><div><span>GARGALOS POR ETAPA</span><strong>Pressão do fluxo</strong></div><small>{formatNumber(visibleStages.length)} etapas</small></header>
          <div className="team-stage-list">{visibleStages.slice(0, 6).map(stage => <div className="team-stage-row" key={stage.stage}>
            <div><span>{stage.stage}</span><strong>{formatNumber(stage.active ?? stage.count)}</strong></div>
            <i><b style={{ width: `${Math.min(100, Number(stage.delayedPct) || Number(stage.pctOfActive) || 0)}%` }} /></i>
            <small>{stage.delayed === null || stage.delayed === undefined ? `${formatPct(stage.pctOfActive)} da carteira` : `${formatNumber(stage.delayed)} atrasos · ${formatPct(stage.delayedPct)}`}</small>
          </div>)}</div>
          <div className="team-command-note"><strong>COMO LER</strong><span>Pressão pode vir de prioridade, dependência, prazo, cadastro ou capacidade. O nome aponta onde investigar, não quem culpar.</span></div>
        </aside>
      </div>
    </section>
  );
}
