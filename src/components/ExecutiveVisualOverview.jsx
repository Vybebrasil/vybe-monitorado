import { Activity, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { formatNumber, formatPct, formatPoints } from './executive-helpers.js';
import { statusColorFor } from '../data/status-colors.js';

function scoreTone(score) {
  if (score < 0) return 'critical';
  if (score < 50) return 'attention';
  return 'stable';
}

export function ExecutiveVisualOverview({ snapshot, onSelect }) {
  const quantitative = snapshot?.quantitative || {};
  const score = Number.isFinite(snapshot?.portfolioStability?.score) ? snapshot.portfolioStability.score : null;
  const active = Number(quantitative.activeItems) || 0;
  const riskClients = snapshot?.clientRanking?.filter(item => (Number(item.delayedItems) || 0) > 0).length || 0;
  const stalled = snapshot?.portfolioExecution?.stalled?.length || 0;
  const delayed = Number(quantitative.overdueInternal) || 0;
  const publication = Number(quantitative.overduePublication) || 0;
  const scorePct = score === null ? 0 : Math.max(0, Math.min(100, ((score + 100) / 200) * 100));
  const tone = scoreTone(score ?? 0);
  const statusEntries = Object.entries(quantitative.statusCounts || {})
    .map(([label, count]) => ({ label, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const statusTotal = statusEntries.reduce((sum, item) => sum + item.count, 0) || 1;
  const pipeline = [
    { label: 'Ativos', value: active, pct: Number(quantitative.activePct) || 0, tone: 'cyan' },
    { label: 'Atrasados', value: delayed, pct: active ? (delayed / active) * 100 : 0, tone: 'red' },
    { label: 'Veiculações', value: publication, pct: active ? (publication / active) * 100 : 0, tone: 'violet' },
  ];
  const investigate = (id) => onSelect?.(id);

  return (
    <section className="nexus-visual-overview" aria-label="Visão visual da operação">
      <article className={`nexus-visual-card nexus-health-visual ${tone}`}>
        <div className="nexus-visual-card-heading"><span><Activity size={14} /> Saúde da operação</span><small>score bruto</small></div>
        <div className="nexus-health-visual-body">
          <div className="nexus-score-ring" style={{ '--score-angle': `${scorePct * 3.6}deg` }}><div><strong>{score === null ? 'N/D' : formatPoints(score)}</strong><small>{score === null ? 'sem leitura' : score < 0 ? 'recuperação' : 'estabilidade'}</small></div></div>
          <div className="nexus-health-copy"><strong>{score === null ? 'Leitura indisponível' : score < 0 ? 'Pressão acima da linha de recuperação' : 'Operação dentro da faixa de controle'}</strong><span>{formatNumber(riskClients)} clientes com sinal de exposição nesta leitura.</span><button type="button" onClick={() => investigate('health')}>Ver composição <ArrowUpRight size={13} /></button></div>
        </div>
      </article>

      <article className="nexus-visual-card nexus-risk-visual">
        <div className="nexus-visual-card-heading"><span><ShieldAlert size={14} /> Pressão por frente</span><small>{formatNumber(delayed + publication + stalled)} sinais</small></div>
        <div className="nexus-risk-stack" aria-label="Distribuição de sinais de pressão">
          <span className="risk-segment red" style={{ width: `${Math.min(100, delayed ? 45 + delayed : 0)}%` }} />
          <span className="risk-segment violet" style={{ width: `${Math.min(100, publication * 4)}%` }} />
          <span className="risk-segment gold" style={{ width: `${Math.min(100, stalled * 8)}%` }} />
        </div>
        <div className="nexus-risk-legend">
          <button type="button" onClick={() => investigate('delays')}><i className="red" /><strong>{formatNumber(delayed)}</strong><span>internos</span></button>
          <button type="button" onClick={() => investigate('publication')}><i className="violet" /><strong>{formatNumber(publication)}</strong><span>veiculações</span></button>
          <button type="button" onClick={() => investigate('execution')}><i className="gold" /><strong>{formatNumber(stalled)}</strong><span>sem execução</span></button>
        </div>
      </article>

      <article className="nexus-visual-card nexus-status-visual">
        <div className="nexus-visual-card-heading"><span><Activity size={14} /> Mix de status</span><small>{formatNumber(active)} ativos</small></div>
        <div className="nexus-status-rows">
          {statusEntries.map(item => {
            const color = quantitative.statusColors?.[item.label] || statusColorFor(item.label) || '#5eead4';
            return <div className="nexus-status-row" key={item.label}><span className="nexus-status-row-label"><i style={{ background: color }} />{item.label}</span><strong>{formatNumber(item.count)}</strong><span className="nexus-status-row-track"><i style={{ width: `${(item.count / statusTotal) * 100}%`, background: color }} /></span></div>;
          })}
          {!statusEntries.length ? <span className="nexus-empty-visual">Sem composição de status disponível.</span> : null}
        </div>
      </article>

      <article className="nexus-visual-card nexus-pipeline-visual">
        <div className="nexus-visual-card-heading"><span><Activity size={14} /> Pipeline de entrega</span><small>recorte atual</small></div>
        <div className="nexus-pipeline-bars">
          {pipeline.map(item => <div className="nexus-pipeline-row" key={item.label}><div><span>{item.label}</span><strong>{formatNumber(item.value)}</strong></div><div className="nexus-pipeline-track"><i className={item.tone} style={{ width: `${Math.min(100, Math.max(item.value > 0 ? 6 : 0, item.pct))}%` }} /></div><small>{formatPct(item.pct)}</small></div>)}
        </div>
      </article>
    </section>
  );
}

export default ExecutiveVisualOverview;
