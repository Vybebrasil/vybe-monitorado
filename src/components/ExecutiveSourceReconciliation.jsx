import React from 'react';
import { ArrowUpRight, GitCompareArrows, ShieldAlert } from 'lucide-react';
import { formatNumber } from './executive-helpers.js';
import { ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

function relationRows(sourceRelation = {}) {
  const counts = sourceRelation.counts || {};
  return [
    { key: 'productionOnly', label: 'Somente Produção de Conteúdo', value: counts.productionOnlyClients, tone: 'cyan', description: 'Cliente tem itens de produção abertos, sem solicitação aberta correspondente.' },
    { key: 'demandOnly', label: 'Somente Solicitações de Demandas', value: counts.demandOnlyClients, tone: 'orange', description: 'Cliente tem solicitação aberta sem item de produção correspondente.' },
    { key: 'overlap', label: 'Nas duas fontes', value: counts.overlapClients, tone: 'purple', description: 'Cliente possui itens abertos nas duas fontes e merece conferir a relação.' }
  ];
}

export default function ExecutiveSourceReconciliation({ snapshot, onOpenClient }) {
  const relation = snapshot?.sourceRelation || {};
  const counts = relation.counts || {};
  const rows = relationRows(relation).filter(row => Number(row.value) > 0);
  const overlaps = Array.isArray(relation.overlapDetails) ? relation.overlapDetails.slice(0, 5) : [];
  const oneSided = [
    { key: 'production-only', label: 'Clientes somente em Produção', items: Array.isArray(relation.productionOnlyClients) ? relation.productionOnlyClients : [], tone: 'cyan' },
    { key: 'demand-only', label: 'Clientes somente em Demandas', items: Array.isArray(relation.demandOnlyClients) ? relation.demandOnlyClients : [], tone: 'orange' }
  ];
  const totalSignals = Number(counts.productionOnlyClients || 0) + Number(counts.demandOnlyClients || 0) + Number(counts.overlapClients || 0);

  return <article className="executive-source-reconciliation" aria-label="Reconciliação entre fontes">
    <ExecutiveSectionHeader icon={GitCompareArrows} eyebrow="Qualidade da operação" title="Produção × Solicitações" note={relation.note || 'relação entre fontes'} />
    <div className="source-reconciliation-intro"><div><strong>{formatNumber(totalSignals)}</strong><span>relações de clientes observadas</span></div><p>Este módulo encontra onde as duas fontes se complementam ou parecem não ter correspondência. Não altera o Monday.</p></div>
    <div className="source-reconciliation-grid">
      {(rows.length ? rows : [{ key: 'empty', label: 'Relação ainda não disponível', value: null, tone: 'neutral', description: 'O snapshot não entregou dados suficientes para reconciliar os boards.' }]).map(row => <div className={`source-reconciliation-card ${row.tone}`} key={row.key}>
        <span>{row.label}</span><strong>{row.value == null ? 'N/D' : formatNumber(row.value)}</strong><small>{row.description}</small>{row.key !== 'empty' ? <ArrowUpRight size={14} aria-hidden="true" /> : null}
      </div>)}
    </div>
    {oneSided.some(group => group.items.length) ? <div className="source-reconciliation-one-sided">{oneSided.filter(group => group.items.length).map(group => <div className="source-reconciliation-one-sided-group" key={group.key}><div className="source-reconciliation-overlaps-title"><span>{group.label}</span><small>{formatNumber(group.items.length)} clientes</small></div><div className="source-reconciliation-client-list">{group.items.slice(0, 5).map(client => <button type="button" className={`source-reconciliation-client ${group.tone}`} key={client} onClick={() => onOpenClient?.(client)}><span>{client}</span><ArrowUpRight size={13} aria-hidden="true" /></button>)}</div>{group.items.length > 5 ? <small className="source-reconciliation-more">Mais {formatNumber(group.items.length - 5)} clientes no explorador.</small> : null}</div>)}</div> : null}
    {overlaps.length ? <div className="source-reconciliation-overlaps"><div className="source-reconciliation-overlaps-title"><span><ShieldAlert size={14} /> Possíveis sobreposições</span><small>até 5 exemplos</small></div>{overlaps.map(item => <button type="button" className="source-reconciliation-overlap" key={item.client} onClick={() => onOpenClient?.(item.client)}><span>{item.client}</span><small>Produção: {formatNumber(item.productionOpen)} abertos · {formatNumber(item.productionDelayed)} atrasados · Demandas: {formatNumber(item.demandOpen)} abertas · {formatNumber(item.demandDelayed)} vencidas</small><ArrowUpRight size={13} aria-hidden="true" /></button>)}</div> : null}
  </article>;
}
