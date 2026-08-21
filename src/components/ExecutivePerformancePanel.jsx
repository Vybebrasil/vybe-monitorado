import React from 'react';
import { formatNumber, formatPct } from './executive-helpers.js';

export function ExecutivePerformancePanel({ snapshot, onOpenOwner }) {
  const productivity = snapshot?.productivity || {};
  const activeItems = Number(productivity.activeItems ?? snapshot?.quantitative?.activeItems) || 0;
  const completedItems = Number(productivity.completedItems ?? snapshot?.quantitative?.completedItems) || 0;
  const delayedItems = Number(productivity.delayedItems ?? snapshot?.quantitative?.overdueInternal) || 0;
  const readyToSchedule = Number(productivity.readyToSchedule) || 0;
  const totalScope = activeItems + completedItems;
  const owners = Array.isArray(productivity.topResponsibles) ? productivity.topResponsibles : [];
  const stages = Array.isArray(productivity.byStage) ? productivity.byStage : [];
  const topOwners = owners.slice(0, 6);

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
            const total = Number(owner.posts) || 0;
            const delayed = Number(owner.delayedTotal) || 0;
            const pct = total ? delayed / total * 100 : 0;
            return <button type="button" className="executive-owner-row" key={owner.name} onClick={() => onOpenOwner?.(owner.name)}>
              <span className="executive-owner-name">{owner.name}</span>
              <span className="executive-owner-track"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
              <strong>{formatNumber(delayed)}</strong><small>{formatNumber(total)} itens · {formatPct(pct)} com atraso</small><em>INVESTIGAR ↗</em>
            </button>;
          })}
        </div>
        <aside className="executive-module-side">
          <div className="executive-module-section-title"><span>DISTRIBUIÇÃO POR ETAPA</span><b>{formatNumber(stages.length)} etapas</b></div>
          {stages.slice(0, 6).map(stage => <div className="executive-stage-row" key={stage.stage}><span>{stage.stage}</span><strong>{formatNumber(stage.count)}</strong><i><b style={{ width: `${Math.min(100, Number(stage.pctOfActive) || 0)}%` }} /></i><small>{formatPct(stage.pctOfActive)}</small></div>)}
          <div className="executive-module-note"><strong>LEITURA CORRETA</strong><span>Alta concentração de itens ou atrasos indica necessidade de investigação de capacidade, prioridade e cadastro — não culpa automática.</span></div>
        </aside>
      </div>
    </section>
  );
}
