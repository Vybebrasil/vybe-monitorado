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

function matchesPanelFilters(item, filters = {}) {
  return (!filters.owner || matchesOwner(item, filters.owner))
    && (!filters.client || itemClient(item) === filters.client)
    && (!filters.stage || itemStage(item) === filters.stage)
    && (!filters.status || String(item?.status || '') === filters.status);
}

function isCompletedStatus(value) {
  return ['finalizado', 'publicado', 'cancelado', 'feito', 'concluído', 'entregue'].some(label => String(value || '').toLowerCase().includes(label));
}

function isCompleted(item) {
  if (item?.isCompleted === true) return true;
  return isCompletedStatus(item?.status);
}

function isReady(item) {
  if (item?.isReady === true) return true;
  return ['agendado', 'para agendar'].some(label => String(item?.status || '').toLowerCase().includes(label));
}

function displayUrgencyLabel(label) {
  const value = String(label || '').toLowerCase();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function AnalyticsDrilldownDrawer({ panel, setPanel, snapshot }) {
  const [showAll, setShowAll] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  useEffect(() => {
    setShowAll(false);
    setShowCompleted((panel?.targetType === 'kpi' && panel?.id === 'completedItems') || (panel?.targetType === 'filter' && panel?.filterKey === 'status' && isCompletedStatus(panel?.id)));
  }, [panel]);
  useEffect(() => {
    if (!panel) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, setPanel]);

  const targetType = panel?.targetType;
  const activeItems = Array.isArray(snapshot?.activeItems) ? snapshot.activeItems : [];
  const productionItems = Array.isArray(snapshot?.itemRows) ? snapshot.itemRows : activeItems;
  const delayDetails = Array.isArray(snapshot?.delayDetails) ? snapshot.delayDetails : [];
  const demandItems = Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : [];
  const demandRows = Array.isArray(snapshot?.demandItemRows) ? snapshot.demandItemRows : demandItems;
  const sourceItems = targetType === 'kpi' && panel?.id === 'overdue-demands' ? demandRows : productionItems;

  const items = useMemo(() => {
    if (!panel) return [];
    const scoped = rows => rows.filter(item => matchesPanelFilters(item, panel.filters || {}));
    let rows = [];
    if (targetType === 'owner') rows = [...productionItems, ...delayDetails].filter((item, index, list) => list.findIndex(candidate => candidate?.id === item?.id) === index && matchesOwner(item, panel.id));
    if (targetType === 'client') rows = productionItems.filter(item => itemClient(item) === panel.id);
    if (targetType === 'filter') {
      const key = panel.filterKey;
      rows = productionItems.filter(item => key === 'stage' ? itemStage(item) === panel.id : String(item?.status || '') === panel.id);
    }
    if (targetType === 'item') {
      rows = [...productionItems, ...demandRows].filter(item => String(item?.id || '') === String(panel.itemId || panel.id || ''));
    }
    if (targetType === 'kpi') {
      if (panel.id === 'internal-delays') rows = delayDetails.filter(item => String(item.delayType || '').includes('prazo interno'));
      if (panel.id === 'publication') rows = delayDetails.filter(item => String(item.delayType || '').includes('veiculação'));
      if (panel.id === 'overdue-demands') rows = sourceItems.filter(item => item?.isDelayed);
      if (panel.id === 'activeItems') rows = productionItems.filter(item => !isCompleted(item));
      if (panel.id === 'completedItems') rows = productionItems.filter(isCompleted);
      if (panel.id === 'readyItems') rows = productionItems.filter(item => !isCompleted(item) && isReady(item));
    }
    return scoped(rows);
  }, [activeItems, delayDetails, demandRows, panel, productionItems, sourceItems, targetType]);

  const completedItems = useMemo(() => items.filter(isCompleted), [items]);
  const itemsToDisplay = useMemo(() => {
    const operational = items.filter(item => !isCompleted(item));
    const rows = showCompleted ? items : operational;
    return [...rows].sort((a, b) => {
      const completedDelta = Number(isCompleted(a)) - Number(isCompleted(b));
      if (completedDelta) return completedDelta;
      const delayedDelta = Number(isDelayed(b)) - Number(isDelayed(a));
      if (delayedDelta) return delayedDelta;
      const overdueDelta = (Number(b.daysOverdue) || 0) - (Number(a.daysOverdue) || 0);
      if (overdueDelta) return overdueDelta;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }, [items, showCompleted]);

  if (!panel || panel.type !== 'analytics') return null;
  const delayed = items.filter(isDelayed);
  const clients = new Set(items.map(itemClient).filter(Boolean));
  const owners = new Set(items.flatMap(item => splitOwners(item?.responsavel)));
  const totalDays = delayed.reduce((sum, item) => sum + (Number(item.daysOverdue) || 0), 0);
  const visibleItems = showAll ? itemsToDisplay : itemsToDisplay.slice(0, 5);
  const isCompletedOnlyPanel = (targetType === 'kpi' && panel?.id === 'completedItems') || (targetType === 'filter' && panel?.filterKey === 'status' && isCompletedStatus(panel?.id));
  const eyebrow = targetType === 'owner' ? 'Analytics · responsável' : targetType === 'client' ? 'Analytics · cliente' : targetType === 'filter' ? `Analytics · ${panel.filterKey === 'stage' ? 'etapa' : 'status'}` : targetType === 'item' ? 'História · item alterado' : 'Analytics · indicador';
  const title = panel.title || 'Investigação analítica';
  const subtitle = targetType === 'owner'
    ? 'Carteira e sinais operacionais associados à pessoa selecionada. Esta leitura não é avaliação causal de produtividade.'
    : targetType === 'client'
      ? 'Itens ativos, atrasos, prazos e concentração observável do cliente nesta leitura.'
      : targetType === 'filter'
        ? 'Itens que pertencem exatamente ao filtro selecionado, mantendo a fonte e o status original.'
        : targetType === 'item'
          ? 'Evidência atual do item que sofreu uma mudança no Vybe Painel. O horário do evento vem do delta operacional.'
          : 'Evidências que compõem o indicador selecionado, sem misturar Produção de Conteúdo e Solicitações de Demandas.';

  return <div className="drawer-overlay analytics-drawer-overlay" onClick={() => setPanel(null)}>
    <aside className="drawer investigation-drawer analytics-drilldown-drawer" onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><h3>{title}</h3><p>{eyebrow} · somente leitura</p></div><button type="button" className="drawer-close" aria-label="Fechar análise" onClick={() => setPanel(null)}><X size={32} /></button></div>
      <div className="drawer-content">
        <section className="analytics-drilldown-hero"><span><BarChart3 size={14} /> Performance observável</span><h4>{title}</h4><p>{subtitle}</p></section>
        <div className="analytics-drilldown-metrics"><div><strong>{formatNumber(items.length)}</strong><span>Itens no recorte</span></div><div><strong>{formatNumber(delayed.length)}</strong><span>Com sinal de atraso</span></div><div><strong>{formatNumber(clients.size)}</strong><span>Clientes</span></div><div><strong>{formatNumber(owners.size)}</strong><span>Responsáveis</span></div><div><strong>{formatNumber(totalDays)}D</strong><span>Dias acumulados</span></div></div>
        {targetType === 'owner' ? <div className="investigation-callout"><span>Leitura correta</span><p>Volume e atraso podem refletir concentração de carteira, etapa, prioridade e complexidade. O Nexus mostra sinais para investigação, não uma nota individual.</p></div> : null}
        {targetType === 'item' ? <div className="investigation-callout"><span>Fonte do evento</span><p>Este item foi aberto a partir de uma mudança recebida do delta do Vybe Painel. O card abaixo mostra o estado atual e o link direto para a evidência no Monday.</p></div> : null}
        {targetType === 'kpi' && panel.id === 'health' ? <div className="investigation-callout"><span>Composição</span><p>{snapshot?.portfolioStability?.explanation || 'O placar combina sinais de atraso, execução e prontidão observados no snapshot.'}</p></div> : null}
        {items.length === 0 ? <div className="investigation-empty"><strong>Sem evidência suficiente.</strong><span>Esta seleção não trouxe itens no recorte atual. O Nexus mantém N/D ou zero sem fabricar dados.</span></div> : <>
          {!isCompletedOnlyPanel && completedItems.length > 0 ? <div className="analytics-evidence-controls"><div><span>Finalizados</span><strong>{formatNumber(completedItems.length)} itens concluídos ficam ocultos por padrão.</strong></div><button type="button" className="analytics-completed-toggle" onClick={() => { setShowCompleted(value => !value); setShowAll(false); }}>{showCompleted ? 'Ocultar finalizados' : `Mostrar finalizados (${formatNumber(completedItems.length)})`}</button></div> : null}
          <div className="kpi-investigation-section-title"><span>Evidências · {formatNumber(itemsToDisplay.length)} exibidas{itemsToDisplay.length !== items.length ? ` · ${formatNumber(items.length)} no recorte` : ''}</span><strong>{delayed.length ? `${formatNumber(delayed.length)} com sinal` : 'sem atraso no recorte'}</strong></div>
          {itemsToDisplay.length === 0 ? <div className="investigation-empty"><strong>Nenhum item aberto neste recorte.</strong><span>Os itens encontrados estão finalizados. Use “Mostrar finalizados” para consultar o histórico.</span></div> : <ul className="kpi-evidence-list analytics-evidence-list">{visibleItems.map((item, index) => {
            const delayedItem = isDelayed(item);
            const urgency = delayedItem ? delayUrgency(item.daysOverdue) : { tone: 'stable', label: 'Dentro do prazo', description: 'O prazo não aparece vencido nesta leitura.' };
            const statusColor = statusColorFor(item.status, snapshot?.quantitative?.statusColors);
            return <li key={item.id || `${item.name}-${index}`} className={`kpi-evidence-card urgency-${urgency.tone}${isCompleted(item) ? ' item-completed' : ''}`}>
              <div className="kpi-evidence-card-head"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`}>{delayedItem ? `Atraso: ${item.daysOverdue || 0}D · ${displayUrgencyLabel(urgency.label)}` : 'Dentro do prazo'}</span></div>
              <div className="kpi-evidence-card-meta"><span>{itemClient(item)}</span><span>{itemStage(item)}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColor, borderColor: statusColor }}>{item.status}</span> : null}</div>
              <div className="kpi-evidence-card-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span><span className="people-field"><b>Resp.</b><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></span></div>
              {item.editorDesigner ? <div className="kpi-evidence-card-meta"><span className="people-field"><b>Editor/Designer</b><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span></div> : null}
              {item.id ? <a className="investigation-evidence-link" href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer">Abrir no Monday ↗</a> : null}
            </li>;
          })}</ul>}
          {itemsToDisplay.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `Ver mais (${itemsToDisplay.length - 5})`}</button> : null}
        </>}
      </div>
    </aside>
  </div>;
}

export default AnalyticsDrilldownDrawer;
