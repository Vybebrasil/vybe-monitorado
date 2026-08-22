import { ArrowUpRight, Crosshair, ShieldAlert } from 'lucide-react';
import { formatNumber, formatPoints } from './executive-helpers.js';

function firstRisk(snapshot) {
  return snapshot?.executiveRisks?.[0] || null;
}

function firstDecision(snapshot) {
  return snapshot?.decisionsNeeded?.[0] || null;
}

export function JarvisDecisionBriefing({ snapshot, onSelect }) {
  const risk = firstRisk(snapshot);
  const decision = firstDecision(snapshot);
  const deduction = snapshot?.portfolioStability?.scoreDeductions?.[0] || null;
  const score = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score);
  const freshness = snapshot?.sourceQuality?.freshness || 'live';
  const sourceVersion = snapshot?.sourceQuality?.mirrorVersion;
  const title = risk?.title || 'Nenhum risco dominante identificado';
  const why = risk?.whyItMatters || 'A leitura atual não apresenta um sinal dominante que exija intervenção executiva imediata.';
  const recommendation = decision?.title || risk?.recommendedDecision || 'Continuar observando a tendência e confirmar a próxima mudança de versão.';
  const focusId = risk?.client ? `client:${risk.client}` : risk?.id || deduction?.id || 'health';
  const riskLabel = risk ? `${risk.severityLabel || 'Risco'} · ${risk.client || 'carteira'}` : 'Leitura estável';

  return (
    <section className={`jarvis-decision-briefing data-panel ${freshness}`} aria-label="Briefing decisório do JARVIS">
      <div className="jarvis-decision-briefing-header">
        <div className="jarvis-decision-briefing-kicker"><Crosshair size={14} aria-hidden="true" /> Briefing JARVIS · decisão agora</div>
        <span className={`jarvis-briefing-freshness ${freshness}`}>{freshness === 'live' ? 'Ao vivo' : freshness === 'stale' ? 'Desatualizado' : freshness === 'fallback' ? 'Leitura direta' : 'Pendente'}</span>
      </div>
      <div className="jarvis-decision-briefing-grid">
        <div className="jarvis-decision-briefing-lead">
          <span className="jarvis-decision-label">Prioridade identificada</span>
          <h2>{title}</h2>
          <p>{why}</p>
          <button type="button" className="jarvis-decision-action" onClick={() => onSelect?.(focusId)}>
            Investigar esta prioridade <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="jarvis-decision-briefing-details">
          <div className="jarvis-decision-detail"><span><ShieldAlert size={13} aria-hidden="true" /> Por que agora</span><strong>{riskLabel}</strong><small>{risk?.evidence?.[0]?.detail || 'Sem evidência dominante nesta leitura.'}</small></div>
          <div className="jarvis-decision-detail"><span>Decisão sugerida</span><strong>{recommendation}</strong><small>{decision?.context || 'A recomendação permanece subordinada à evidência exibida no drawer.'}</small></div>
          <div className="jarvis-decision-metrics"><span><b>{Number.isFinite(score) ? formatPoints(score) : 'N/D'}</b> placar bruto</span><span><b>{formatNumber(snapshot?.decisionsNeeded?.length || 0)}</b> decisões pendentes</span><span><b>{sourceVersion ?? 'N/D'}</b> versão do espelho</span></div>
        </div>
      </div>
    </section>
  );
}
