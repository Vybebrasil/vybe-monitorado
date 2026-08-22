import React from 'react';
import { ArrowUpRight, CheckCircle2, CircleDot, Target } from 'lucide-react';
import { formatDate, formatNumber } from './executive-helpers.js';
import { ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

const STATUS_LABELS = {
  decision_needed: 'Decisão necessária',
  directive_defined: 'Diretriz definida',
  impact_tracking: 'Impacto em acompanhamento',
  normalized: 'Normalizada',
  dismissed: 'Dispensada'
};
const RESULT_LABELS = { improved: 'Melhorou', stable: 'Estável', worsened: 'Piorou', inconclusive: 'Inconclusivo' };

function checkpointState(value) {
  if (!value) return { label: 'Sem checkpoint', tone: 'warning' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: 'Checkpoint inválido', tone: 'warning' };
  return date.getTime() < Date.now() ? { label: `Checkpoint vencido · ${formatDate(value)}`, tone: 'critical' } : { label: `Checkpoint · ${formatDate(value)}`, tone: 'stable' };
}

export default function ExecutiveDecisionLoop({ intelligence, onOpenDecision }) {
  const memory = intelligence?.memory || {};
  const records = Array.isArray(memory.records) ? memory.records : [];
  const effectiveness = intelligence?.effectiveness || {};
  const risks = Array.isArray(intelligence?.persistentRisks) ? intelligence.persistentRisks : [];
  const active = records.filter(record => !['normalized', 'dismissed'].includes(record.status));
  const checkpointsAtRisk = active.filter(record => checkpointState(record.checkpointAt).tone !== 'stable');

  return <article className="executive-decision-loop" aria-label="Ciclo de decisão executiva">
    <ExecutiveSectionHeader icon={Target} eyebrow="Memória executiva" title="Decisão → checkpoint → impacto" note={memory.note || 'registro executivo'} />
    <div className="decision-loop-summary"><div><strong>{formatNumber(active.length)}</strong><span>decisões em acompanhamento</span></div><div className={checkpointsAtRisk.length ? 'critical' : 'stable'}><strong>{formatNumber(checkpointsAtRisk.length)}</strong><span>sem checkpoint válido</span></div><div><strong>{formatNumber(Number(effectiveness.evaluatedDecisions) || 0)}</strong><span>impactos medidos</span></div><p>Este ciclo pertence à memória do Nexus. Não altera status ou itens no Monday.</p></div>
    {records.length ? <div className="decision-loop-list">{records.slice(0, 5).map(record => { const checkpoint = checkpointState(record.checkpointAt); return <button type="button" className={`decision-loop-row ${checkpoint.tone}`} key={record.id} onClick={() => onOpenDecision?.(record)}><div className="decision-loop-icon">{record.impact ? <CheckCircle2 size={15} /> : <CircleDot size={15} />}</div><div className="decision-loop-copy"><strong>{record.title}</strong><span>{record.clientId || record.ownerRole || 'CMO/COO'} · {STATUS_LABELS[record.status] || record.status || 'Estado não informado'}</span><small>{record.directive || record.context || 'Sem diretriz registrada.'}</small></div><div className="decision-loop-result"><b className={checkpoint.tone}>{record.impact ? RESULT_LABELS[record.impact.result] || record.impact.result : checkpoint.label}</b><small>{record.impact?.observedIndicator || `${formatNumber(record.historyCount || 1)} atualização(ões)`}</small></div><ArrowUpRight size={14} aria-hidden="true" /></button>; })}</div> : <div className="decision-loop-empty"><strong>Nenhuma decisão executiva persistida.</strong><span>Os alertas podem ser investigados agora, mas o ciclo só fica mensurável quando existe decisão, checkpoint e impacto observado.</span></div>}
    {records.length > 5 ? <div className="decision-loop-footnote">Mais {formatNumber(records.length - 5)} decisões na memória executiva. Abra História para acompanhar o conjunto completo.</div> : null}
    {risks.length ? <div className="decision-loop-risk"><strong>{formatNumber(risks.length)} risco(s) persistente(s) precisam de acompanhamento.</strong><span>A ausência de checkpoint ou um impacto negativo mantém o sinal aberto até nova medição.</span></div> : null}
  </article>;
}
