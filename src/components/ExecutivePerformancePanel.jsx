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
  const topOwners = (derivedOwners.length ? derivedOwners : owners.map(owner => ({
    name: owner.name,
    total: Number(owner.posts) || 0,
    active: Number(owner.posts) || 0,
    completed: 0,
    delayed: Number(owner.delayedTotal) || 0,
    ready: 0,
    completionPct: null,
    delayedPct: Number(owner.posts) ? Number(((Number(owner.delayedTotal) || 0) / Number(owner.posts) * 100).toFixed(1)) : null
  }))).slice(0, 6);

  return (
    <section className="executive-module performance-module" aria-label="Visão executiva de time e performance">
      <header className="executive-module-header">
        <div><span className="executive-section-kicker">TIME · PERFORMANCE OBSERVÁVEL</span><h2>Como a capacidade está distribuída?</h2><p>Volume, entrega e sinais de atraso. Não é diagnóstico de produtividade individual nem avaliação de pessoas.</p></div>
        <span className="executive-module-source">Monday.com · Produção de Conteúdo</span>
      </header>
      <div className="executive-module-kpi-grid performance-kpis">
        <div className="executive-module-kpi"><span>CARTEIRA ATIVA</span><strong>{formatNumber(activeItems)}</strong><small>itens em execução</small></div>
        <div className="executive-module-kpi stable"><span>CONCLUÍDOS</span><strong>{formatNumber(completedItems)}</strong><small>{formatPct(totalScope ? completedItems / totalScope * 100 : null)} da base lida</small></div>
        <div className="executive-module-kpi critical"><span>ATRASADOS</span><strong>{formatNumber(delayedItems)}</strong><small>{formatPct(activeItems ? delayedItems / activeItems * 100 : null)} dos ativos</small></div>
        <div className="executive-module-kpi cyan"><span>PRONTOS PARA AGENDAR</span><strong>{formatNumber(readyToSchedule)}</strong><small>Agendado + Para agendar</small></div>
      </div>
      <div className="executive-performance-grid">
        <div className="executive-module-list">
          <div className="executive-module-section-title"><span>SINAIS POR RESPONSÁVEL</span><b>não é ranking de valor individual</b></div>
          {topOwners.length === 0 ? <div className="executive-empty-state"><strong>Dados de responsável não disponíveis.</strong><span>O Nexus não transforma ausência de dados em uma nota individual.</span></div> : topOwners.map(owner => {
            const total = Number(owner.total) || 0;
            const delayed = Number(owner.delayed) || 0;
            const delayedPct = owner.delayedPct;
            return <button type="button" className="executive-owner-row" key={owner.name} onClick={() => onOpenOwner?.(owner.name)}>
              <span className="executive-owner-name">{owner.name}</span>
              <span className="executive-owner-track"><i style={{ width: `${Math.min(100, Number(delayedPct) || 0)}%` }} /></span>
              <strong>{formatNumber(delayed)}</strong><small>{formatNumber(owner.active)} ativos · {formatNumber(owner.completed)} concluídos · {formatPct(delayedPct)} dos ativos</small><em>INVESTIGAR ↗</em>
            </button>;
          })}
        </div>
        <aside className="executive-module-side">
          <div className="executive-module-section-title"><span>DISTRIBUIÇÃO POR ETAPA</span><b>{formatNumber(visibleStages.length)} etapas</b></div>
          {visibleStages.slice(0, 6).map(stage => <div className="executive-stage-row" key={stage.stage}><span>{stage.stage}</span><strong>{formatNumber(stage.active ?? stage.count)}</strong><i><b style={{ width: `${Math.min(100, Number(stage.pctOfActive) || (activeItems ? (Number(stage.active || 0) / activeItems * 100) : 0))}%` }} /></i><small>{stage.delayed === null || stage.delayed === undefined ? formatPct(stage.pctOfActive) : `${formatNumber(stage.delayed)} atrasos · ${formatPct(stage.delayedPct)}`}</small></div>)}
          <div className="executive-module-note"><strong>LEITURA CORRETA</strong><span>Alta concentração de itens ou atrasos indica necessidade de investigação de capacidade, prioridade e cadastro — não culpa automática.</span></div>
        </aside>
      </div>
    </section>
  );
}
