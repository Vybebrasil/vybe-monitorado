import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, X } from 'lucide-react';
import { PeopleAvatars } from './PeopleAvatars.jsx';
import { delayUrgency, formatDate, formatNumber, formatPct, mondayItemUrl, splitOwners } from './executive-helpers.js';
import { statusColorFor } from '../data/status-colors.js';

function isDelayed(item) {
  return Boolean(item?.isDelayedPrazo || item?.isDelayedVeiculacao || item?.isDelayed || item?.delayType);
}

function itemClient(item) {
  return item?.client || item?.cliente || 'Sem cliente';
}

function itemStage(item) {
  return item?.stage || item?.quadro || 'Etapa não informada';
}

function matchesOwner(item, owner) {
  if (!owner) return false;
  if (splitOwners(item?.responsavel).some(name => name === owner)) return true;
  return (item?.responsavelPeople || []).some(person => person?.name === owner);
}

export function AnalyticsDrilldownDrawer({ panel, setPanel, snapshot }) {
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(false); }, [panel]);
  useEffect(() => {
    if (!panel) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, setPanel]);

  const targetType = panel?.targetType;
  const activeItems = Array.isArray(snapshot?.activeItems) ? snapshot.activeItems : [];
  const delayDetails = Array.isArray(snapshot?.delayDetails) ? snapshot.delayDetails : [];
  const demandItems = Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : [];
  const sourceItems = targetType === 'kpi' && panel?.id === 'overdue-demands' ? (Array.isArray(snapshot?.delayedDemandItems) ? snapshot.delayedDemandItems : demandItems) : activeItems;

  const items = useMemo(() => {
    if (!panel) return [];
    if (targetType === 'owner') return [...activeItems, ...delayDetails].filter((item, index, list) => list.findIndex(candidate => candidate?.id === item?.id) === index && matchesOwner(item, panel.id));
    if (targetType === 'client') return activeItems.filter(item => itemClient(item) === panel.id);
    if (targetType === 'filter') {
      const key = panel.filterKey;
      return activeItems.filter(item => key === 'stage' ? itemStage(item) === panel.id : String(item?.status || '') === panel.id);
    }
    if (targetType === 'kpi') {
      if (panel.id === 'internal-delays') return delayDetails.filter(item => String(item.delayType || '').includes('prazo interno'));
      if (panel.id === 'publication') return delayDetails.filter(item => String(item.delayType || '').includes('veiculação'));
      if (panel.id === 'overdue-demands') return sourceItems.filter(item => item?.isDelayed);
      if (panel.id === 'activeItems') return activeItems;
      return [];
    }
    return [];
  }, [activeItems, delayDetails, panel, sourceItems, targetType]);

  if (!panel || panel.type !== 'analytics') return null;
  const delayed = items.filter(isDelayed);
  const clients = new Set(items.map(itemClient).filter(Boolean));
  const owners = new Set(items.flatMap(item => splitOwners(item?.responsavel)));
  const totalDays = delayed.reduce((sum, item) => sum + (Number(item.daysOverdue) || 0), 0);
  const visibleItems = showAll ? items : items.slice(0, 5);
  const eyebrow = targetType === 'owner' ? 'ANALYTICS · RESPONSÁVEL' : targetType === 'client' ? 'ANALYTICS · CLIENTE' : targetType === 'filter' ? `ANALYTICS · ${panel.filterKey === 'stage' ? 'ETAPA' : 'STATUS'}` : 'ANALYTICS · INDICADOR';
  const title = panel.title || 'Investigação analítica';
  const subtitle = targetType === 'owner'
    ? 'Carteira e sinais operacionais associados à pessoa selecionada. Esta leitura não é avaliação causal de produtividade.'
    : targetType === 'client'
      ? 'Itens ativos, atrasos, prazos e concentração observável do cliente nesta leitura.'
      : targetType === 'filter'
        ? 'Itens que pertencem exatamente ao filtro selecionado, mantendo a fonte e o status original.'
        : 'Evidências que compõem o indicador selecionado, sem misturar Produção de Conteúdo e Solicitações de Demandas.';

  return <div className="drawer-overlay analytics-drawer-overlay" onClick={() => setPanel(null)}>
    <aside className="drawer investigation-drawer analytics-drilldown-drawer" onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><h3>{title}</h3><p>{eyebrow} · SOMENTE LEITURA</p></div><button type="button" className="drawer-close" aria-label="Fechar análise" onClick={() => setPanel(null)}><X size={32} /></button></div>
      <div className="drawer-content">
        <section className="analytics-drilldown-hero"><span><BarChart3 size={14} /> PERFORMANCE OBSERVÁVEL</span><h4>{title}</h4><p>{subtitle}</p></section>
        <div className="analytics-drilldown-metrics"><div><strong>{formatNumber(items.length)}</strong><span>ITENS NO RECORTE</span></div><div><strong>{formatNumber(delayed.length)}</strong><span>COM SINAL DE ATRASO</span></div><div><strong>{formatNumber(clients.size)}</strong><span>CLIENTES</span></div><div><strong>{formatNumber(owners.size)}</strong><span>RESPONSÁVEIS</span></div><div><strong>{formatNumber(totalDays)}D</strong><span>DIAS ACUMULADOS</span></div></div>
        {targetType === 'owner' ? <div className="investigation-callout"><span>LEITURA CORRETA</span><p>Volume e atraso podem refletir concentração de carteira, etapa, prioridade e complexidade. O Nexus mostra sinais para investigação, não uma nota individual.</p></div> : null}
        {targetType === 'kpi' && panel.id === 'health' ? <div className="investigation-callout"><span>COMPOSIÇÃO</span><p>{snapshot?.portfolioStability?.explanation || 'O placar combina sinais de atraso, execução e prontidão observados no snapshot.'}</p></div> : null}
        {items.length === 0 ? <div className="investigation-empty"><strong>Sem evidência suficiente.</strong><span>Esta seleção não trouxe itens no recorte atual. O Nexus mantém N/D ou zero sem fabricar dados.</span></div> : <>
          <div className="kpi-investigation-section-title"><span>EVIDÊNCIAS · {formatNumber(items.length)} ITEM(S)</span><strong>{delayed.length ? `${formatNumber(delayed.length)} com sinal` : 'sem atraso no recorte'}</strong></div>
          <ul className="kpi-evidence-list analytics-evidence-list">{visibleItems.map((item, index) => {
            const delayedItem = isDelayed(item);
            const urgency = delayedItem ? delayUrgency(item.daysOverdue) : { tone: 'stable', label: 'DENTRO DO PRAZO', description: 'O prazo não aparece vencido nesta leitura.' };
            const statusColor = statusColorFor(item.status, snapshot?.quantitative?.statusColors);
            return <li key={item.id || `${item.name}-${index}`} className={`kpi-evidence-card urgency-${urgency.tone}`}>
              <div className="kpi-evidence-card-head"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`}>{delayedItem ? `ATRASO: ${item.daysOverdue || 0}D · ${urgency.label}` : 'DENTRO DO PRAZO'}</span></div>
              <div className="kpi-evidence-card-meta"><span>{itemClient(item)}</span><span>{itemStage(item)}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColor, borderColor: statusColor }}>{item.status}</span> : null}</div>
              <div className="kpi-evidence-card-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span><span className="people-field"><b>Resp.</b><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></span></div>
              {item.editorDesigner ? <div className="kpi-evidence-card-meta"><span className="people-field"><b>Editor/Designer</b><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span></div> : null}
              {item.id ? <a className="investigation-evidence-link" href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer">ABRIR NO MONDAY ↗</a> : null}
            </li>;
          })}</ul>
          {items.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'VER MENOS' : `VER MAIS (${items.length - 5})`}</button> : null}
        </>}
      </div>
    </aside>
  </div>;
}

export default AnalyticsDrilldownDrawer;
