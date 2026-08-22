import { Activity } from 'lucide-react';
import { formatNumber, formatPct } from './executive-helpers.js';
import { ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

function tone(value) {
  if (value === null || value === undefined) return 'unknown';
  if (value >= 40) return 'critical';
  if (value >= 20) return 'attention';
  return 'clear';
}

function Pulse({ label, value, detail, source }) {
  const numeric = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null;
  return (
    <div className="executive-pulse-item">
      <div className="executive-pulse-label"><span>{label}</span><b>{numeric === null ? 'N/D' : `${formatPct(numeric)}`}</b></div>
      <div className={`executive-pulse-track ${tone(numeric)}`}><i style={{ width: `${numeric ?? 0}%` }} /></div>
      <small>{detail} · {source}</small>
    </div>
  );
}

export function ExecutivePulseBars({ snapshot }) {
  const quantitative = snapshot?.quantitative || {};
  const execution = snapshot?.portfolioExecution || {};
  const eligible = Number(execution.eligibleClients) || 0;
  const delayedInternal = quantitative.overdueInternalPctOfActive ?? null;
  const delayedPublication = quantitative.overduePublicationPctOfActive ?? null;
  const executionGap = eligible ? ((Number(execution.stalled?.length) || 0) / eligible) * 100 : null;

  return (
    <section className="executive-pulse-bars data-panel hierarchy-secondary" aria-label="Barras de pressão executiva">
      <ExecutiveSectionHeader icon={Activity} eyebrow="Comparação" title="Onde a pressão está proporcionalmente maior?" note={`${formatNumber(quantitative.activeItems || 0)} itens · ${formatNumber(eligible)} clientes`} />
      <div className="executive-pulse-grid">
        <Pulse label="Atraso interno" value={delayedInternal} detail={`${formatNumber(quantitative.overdueInternal || 0)} itens`} source="Produção de Conteúdo" />
        <Pulse label="Risco de veiculação" value={delayedPublication} detail={`${formatNumber(quantitative.overduePublication || 0)} itens`} source="data de veiculação" />
        <Pulse label="Gap de execução" value={executionGap} detail={`${formatNumber(execution.stalled?.length || 0)} clientes`} source="sem conteúdo/demanda" />
      </div>
    </section>
  );
}
