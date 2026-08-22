import React from 'react';
import { Activity, Users, Workflow } from 'lucide-react';
import { formatNumber, formatPct } from './executive-helpers.js';
import { ExecutiveInsightHeader, ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

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
    isExact: true,
    signalCount: owner.delayed,
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
    .sort((a, b) => b.delayedPct - a.delayedPct || b.active - a.active);
}

export function ExecutivePerformancePanel({ snapshot, onOpenOwner, onOpenStage, onOpenHistory }) {
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
      delayed: null,
      signalCount: Number(owner.delayedTotal) || 0,
      ready: 0,
      isExact: false,
      completionPct: null,
      delayedPct: null
    };
  })).slice(0, 6);

  const largestLoad = [...topOwners].sort((a, b) => Number(b.active) - Number(a.active))[0];
  const hasNumeric = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const highestDelay = [...topOwners].filter(owner => hasNumeric(owner.delayedPct) && Number(owner.active) > 0).sort((a, b) => Number(b.delayedPct) - Number(a.delayedPct))[0];
  const bottleneck = [...visibleStages].filter(stage => hasNumeric(stage.delayedPct)).sort((a, b) => Number(b.delayedPct) - Number(a.delayedPct))[0];
  const largestStage = [...visibleStages].sort((a, b) => Number(b.active ?? b.count) - Number(a.active ?? a.count))[0];
  const pressureTone = delayedItems > 0 ? 'critical' : 'stable';

  return (
    <section className="executive-module performance-module team-command" aria-label="Visão executiva de time e performance">
      <ExecutiveInsightHeader
        className="team-command-hero"
        eyebrow={<><Activity size={14} aria-hidden="true" /> Time · capacidade observável</>}
        title="Onde a capacidade está pressionada?"
        description="A leitura combina pressão da operação, concentração por etapa e sinais individuais para indicar onde investigar primeiro."
        recommendation={bottleneck ? `${bottleneck.stage} concentra ${formatNumber(bottleneck.delayed || 0)} atrasos em ${formatNumber(bottleneck.active ?? bottleneck.count)} itens ativos.` : largestStage ? `${largestStage.stage} concentra ${formatNumber(largestStage.active ?? largestStage.count)} itens ativos; a pressão exata aguarda linhas detalhadas.` : 'Não há uma etapa crítica dominante nesta leitura.'}
        impactLabel="Pressão atual"
        impactValue={delayedItems > 0 ? formatPct(activeItems ? delayedItems / activeItems * 100 : null) : '0%'}
        impactNote={`${formatNumber(delayedItems)} atrasos · ${formatNumber(activeItems)} itens ativos`}
        tone={pressureTone}
        primaryAction={highestDelay ? 'Investigar maior pressão' : undefined}
        onPrimary={() => highestDelay && onOpenOwner?.(highestDelay.name)}
        context="Concentração aponta onde investigar; não é medição de valor individual."
      />

      <div className="team-command-kpis">
        <div><span>Em execução</span><strong>{formatNumber(activeItems)}</strong><small>itens ativos</small></div>
        <div><span>Concluídos</span><strong>{formatNumber(completedItems)}</strong><small>{formatPct(totalScope ? completedItems / totalScope * 100 : null)} da base</small></div>
        <div className="critical"><span>Atrasados</span><strong>{formatNumber(delayedItems)}</strong><small>{formatPct(activeItems ? delayedItems / activeItems * 100 : null)} dos ativos</small></div>
        <div className="cyan"><span>Prontos para agenda</span><strong>{formatNumber(readyToSchedule)}</strong><small>próxima entrega</small></div>
      </div>

      <div className="team-command-signals">
        <div><span>Maior carga observada</span><strong>{largestLoad?.name || 'N/D'}</strong><small>{largestLoad ? `${formatNumber(largestLoad.active)} ativos` : 'Sem dados completos'}</small></div>
        <div><span>Maior pressão relativa</span><strong>{highestDelay?.name || 'N/D'}</strong><small>{highestDelay ? `${formatPct(highestDelay.delayedPct)} dos ativos em atraso` : 'pressão individual N/D sem linhas detalhadas'}</small></div>
        <div><span>{bottleneck ? 'Etapa mais pressionada' : 'Etapa com maior volume'}</span><strong>{bottleneck?.stage || largestStage?.stage || 'N/D'}</strong><small>{bottleneck ? `${formatNumber(bottleneck.delayed || 0)} atrasos · ${formatPct(bottleneck.delayedPct)}` : largestStage ? `${formatNumber(largestStage.active ?? largestStage.count)} itens · pressão detalhada N/D` : 'Sem dados completos'}</small></div>
      </div>

      <div className="team-command-grid">
        <article className="team-capacity-panel">
          <ExecutiveSectionHeader icon={Users} eyebrow="Depois da etapa" title="Pessoas e carga atual" note="clique para investigar" />
          {topOwners.length === 0 ? <div className="executive-empty-state"><strong>Dados de responsável não disponíveis.</strong><span>O Nexus não transforma ausência de dados em uma nota individual.</span></div> : <div className="team-capacity-cards">{topOwners.map(owner => {
            const delayed = Number(owner.delayed) || 0;
            const signalCount = Number(owner.signalCount ?? owner.delayed) || 0;
            const delayedPct = owner.delayedPct;
            return <button type="button" className="team-capacity-card" key={owner.name} onClick={() => onOpenOwner?.(owner.name)}>
              <span className="team-capacity-name">{owner.name}</span><b>{formatPct(delayedPct)}</b>
              <i><em style={{ width: `${Math.min(100, Number(delayedPct) || 0)}%` }} /></i>
              <div><small>Ativos<strong>{formatNumber(owner.active)}</strong></small><small>{owner.isExact ? 'Concluídos' : 'Sinais'}<strong>{owner.isExact ? (owner.completed === null ? 'N/D' : formatNumber(owner.completed)) : formatNumber(signalCount)}</strong></small><small>{owner.isExact ? 'Atrasos' : 'Pressão'}<strong>{owner.isExact ? formatNumber(delayed) : 'N/D'}</strong></small></div>
              <u>Investigar ↗</u>
            </button>;
          })}</div>}
        </article>

        <aside className="team-stage-panel">
          <ExecutiveSectionHeader icon={Workflow} eyebrow="Primeiro diagnóstico" title="Pressão por etapa" note={`${formatNumber(visibleStages.length)} etapas`} />
          <div className="team-stage-list">{visibleStages.slice(0, 6).map(stage => <button type="button" className="team-stage-row" key={stage.stage} onClick={() => onOpenStage?.(stage.stage)}>
            <div><span>{stage.stage}</span><strong>{formatNumber(stage.active ?? stage.count)}</strong></div>
            <i><b style={{ width: `${Math.min(100, Number(stage.delayedPct) || Number(stage.pctOfActive) || 0)}%` }} /></i>
            <small>{stage.delayed === null || stage.delayed === undefined ? `${formatPct(stage.pctOfActive)} da carteira` : `${formatNumber(stage.delayed)} atrasos · ${formatPct(stage.delayedPct)}`}</small>
          </button>)}</div>
          <div className="team-command-note"><strong>Como ler</strong><span>Pressão pode vir de prioridade, dependência, prazo, cadastro ou capacidade. O nome aponta onde investigar, não quem culpar.</span><button type="button" onClick={onOpenHistory}>Ver história do fluxo ↗</button></div>
        </aside>
      </div>
    </section>
  );
}
