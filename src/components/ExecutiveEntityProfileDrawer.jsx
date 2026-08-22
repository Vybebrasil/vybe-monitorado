import React, { useEffect, useMemo } from 'react';
import { ArrowUpRight, Briefcase, Users, Workflow, X } from 'lucide-react';
import { statusColorFor } from '../data/status-colors.js';
import { delayUrgency, formatDate, formatNumber } from './executive-helpers.js';
import { PeopleAvatars } from './PeopleAvatars.jsx';

const COMPLETED = ['finalizado', 'publicado', 'cancelado', 'feito', 'concluído', 'entregue'];
const asValues = value => Array.isArray(value) ? value.map(item => typeof item === 'object' ? item?.name : item).filter(Boolean) : String(value || '').split(/[,;|]/).map(value => value.trim()).filter(Boolean);
const isCompleted = item => item?.isCompleted === true || COMPLETED.some(label => String(item?.status || '').toLowerCase().includes(label));
const isDelayed = item => Boolean(item?.isDelayed || item?.isDelayedPrazo || item?.isDelayedVeiculacao || item?.overdue || item?.delayType);
const itemClient = item => item?.client || item?.cliente || 'Sem cliente';
const itemStage = item => item?.stage || item?.etapa || item?.quadro || 'Etapa não informada';
const itemOwnerValues = item => [...new Set([...asValues(item?.owner || item?.responsible || item?.responsavel), ...(item?.responsavelPeople || []).map(person => person?.name).filter(Boolean)])];

function sourceUrl(item) {
  if (!item?.id) return null;
  return item.source === 'demand'
    ? `https://gestaovybes-team.monday.com/boards/8385559107/pulses/${item.id}`
    : `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${item.id}`;
}

export default function ExecutiveEntityProfileDrawer({ panel, setPanel, snapshot }) {
  useEffect(() => {
    if (!panel) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [panel, setPanel]);

  const isEntityPanel = Boolean(panel && panel.type === 'entity');
  const kind = isEntityPanel ? (panel.kind || 'client') : 'client';
  const entityId = isEntityPanel ? String(panel.id || '') : '';
  const productionRows = Array.isArray(snapshot?.itemRows) && snapshot.itemRows.length ? snapshot.itemRows : Array.isArray(snapshot?.activeItems) && snapshot.activeItems.length ? snapshot.activeItems : (snapshot?.delayDetails || []);
  const demandRows = Array.isArray(snapshot?.demandItemRows) && snapshot.demandItemRows.length ? snapshot.demandItemRows : Array.isArray(snapshot?.demandItems) && snapshot.demandItems.length ? snapshot.demandItems : (snapshot?.delayedDemandItems || []);
  const rows = useMemo(() => {
    const production = productionRows.map(item => ({ ...item, source: 'production' }));
    const demands = demandRows.map(item => ({ ...item, source: 'demand' }));
    return [...production, ...demands].filter(item => {
      if (isCompleted(item)) return false;
      if (kind === 'client') return itemClient(item) === entityId;
      if (kind === 'stage') return itemStage(item) === entityId;
      return itemOwnerValues(item).includes(entityId);
    }).sort((a, b) => Number(isDelayed(b)) - Number(isDelayed(a)) || (Number(b.daysOverdue) || 0) - (Number(a.daysOverdue) || 0) || itemClient(a).localeCompare(itemClient(b), 'pt-BR'));
  }, [productionRows, demandRows, kind, entityId]);
  if (!isEntityPanel) return null;
  const delayedRows = rows.filter(isDelayed);
  const productionCount = rows.filter(item => item.source === 'production').length;
  const demandCount = rows.filter(item => item.source === 'demand').length;
  const stages = [...new Set(rows.map(itemStage))];
  const clients = [...new Set(rows.map(itemClient))];
  const title = kind === 'client' ? entityId : kind === 'stage' ? entityId : entityId;
  const eyebrow = kind === 'client' ? 'Perfil de cliente' : kind === 'stage' ? 'Perfil de etapa' : 'Perfil de responsável';
  const icon = kind === 'client' ? Briefcase : kind === 'stage' ? Workflow : Users;
  const Icon = icon;

  return <div className="drawer-overlay" onClick={() => setPanel(null)}>
    <aside className={`drawer entity-profile-drawer ${delayedRows.length ? 'critical' : 'stable'}`} onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><p className="entity-profile-eyebrow"><Icon size={14} /> {eyebrow}</p><h3>{title}</h3><span>Estado atual · coorte aberta · somente leitura</span></div><button className="drawer-close" aria-label="Fechar perfil" onClick={() => setPanel(null)}><X size={28} /></button></div>
      <div className="drawer-content">
        <section className="entity-profile-summary"><div><span>Itens abertos</span><strong>{formatNumber(rows.length)}</strong></div><div className={delayedRows.length ? 'critical' : 'stable'}><span>Atrasos</span><strong>{formatNumber(delayedRows.length)}</strong></div><div><span>Produção</span><strong>{formatNumber(productionCount)}</strong></div><div><span>Demandas</span><strong>{formatNumber(demandCount)}</strong></div></section>
        <section className="entity-profile-context"><strong>{kind === 'client' ? 'Leitura do cliente' : kind === 'stage' ? 'Leitura da etapa' : 'Leitura da pessoa'}</strong><p>{delayedRows.length ? `${formatNumber(delayedRows.length)} sinais de atraso pedem investigação nesta coorte. A lista abaixo começa pelo item mais urgente.` : rows.length ? 'Existem itens abertos sem atraso identificado nesta leitura.' : 'Não há linhas abertas suficientes para formar um perfil observável neste snapshot.'}</p><small>{kind === 'client' ? `${formatNumber(stages.length)} etapas · ${formatNumber(productionCount)} Produção · ${formatNumber(demandCount)} Solicitações de Demandas` : kind === 'stage' ? `${formatNumber(clients.length)} clientes relacionados · ${formatNumber(rows.length)} itens abertos` : 'O Nexus mostra concentração operacional; não transforma ausência de dados em uma nota individual.'}</small></section>
        {rows.length ? <section className="entity-profile-evidence"><div className="entity-profile-section-heading"><span>Evidências abertas</span><small>{formatNumber(rows.length)} no total · finalizados fora da coorte</small></div><div className="entity-profile-list">{rows.map((item, index) => { const urgency = isDelayed(item) ? delayUrgency(item.daysOverdue) : { tone: 'stable', label: 'No prazo', description: 'Sem atraso identificado nesta leitura.' }; const color = statusColorFor(item.status, snapshot?.quantitative?.statusColors); return <article className={`entity-profile-row urgency-${urgency.tone}`} key={item.id || `${item.source}-${item.name}-${index}`}><div className="entity-profile-row-top"><strong>{item.name || item.itemName || 'Item sem nome'}</strong><span className={`urgency-chip ${urgency.tone}`} title={urgency.description}>{isDelayed(item) ? `${item.daysOverdue || 0}d · ${urgency.label}` : 'No prazo'}</span></div><div className="entity-profile-row-meta"><span>{item.source === 'demand' ? 'Solicitações de Demandas' : 'Produção de Conteúdo'}</span><span>{itemClient(item)}</span><span>{itemStage(item)}</span>{item.status ? <span className="monday-status-badge" style={{ color, borderColor: color }}>{item.status}</span> : null}</div><div className="entity-profile-row-meta"><span>Prazo: {formatDate(item.prazo || item.deadline)}</span>{item.source === 'production' ? <span>Veiculação: {formatDate(item.veiculacao)}</span> : null}<span className="people-field"><PeopleAvatars people={item.responsavelPeople} names={item.responsavel || item.responsible} label="Responsável" /></span></div>{sourceUrl(item) ? <a className="investigation-evidence-link" href={sourceUrl(item)} target="_blank" rel="noreferrer">Abrir evidência no Monday <ArrowUpRight size={13} /></a> : null}</article>; })}</div></section> : <div className="entity-profile-empty"><strong>Perfil sem evidência aberta.</strong><span>O Nexus não vai fabricar performance, atraso ou causa quando o snapshot não trouxe linhas para este recorte.</span></div>}
      </div>
    </aside>
  </div>;
}
