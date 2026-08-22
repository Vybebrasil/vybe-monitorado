import { ShieldAlert } from 'lucide-react';
import { buildMissions, formatNumber, formatPoints } from './executive-helpers.js';
import { ExecutiveDisclosure, ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

export function MissionBoard({ snapshot, onSelect }) {
  const missions = buildMissions(snapshot);
  const score = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score);
  const deductions = snapshot?.portfolioStability?.scoreDeductions || [];
  const recoverable = Number(snapshot?.portfolioStability?.recoveryPointsAvailable) || missions.reduce((sum, mission) => sum + mission.recoverablePoints, 0);
  const lostPoints = deductions.reduce((sum, deduction) => sum + (Number(deduction.points) || 0), 0);
  const scoreBase = 100;
  if (!missions.length && !deductions.length) return null;
  const readinessIds = new Set(['planning-source-gap', 'missing-planning', 'dashboard-source-gap', 'missing-dashboard']);
  const operationalDeductions = deductions.filter(deduction => !readinessIds.has(deduction.id));
  const readinessDeductions = deductions.filter(deduction => readinessIds.has(deduction.id));
  const openDeduction = (deduction) => {
    const isReadiness = readinessIds.has(deduction.id);
    const id = isReadiness ? 'readiness' : deduction.id === 'overdue-demands' ? 'health' : deduction.id === 'execution-gap' ? 'execution' : deduction.id === 'publication-risk' ? 'publication' : 'delays';
    onSelect(id, isReadiness ? deduction.id : undefined);
  };
  const renderDeduction = deduction => {
    const isSystemic = deduction.mode === 'source_gap';
    const observedCount = Number(deduction.observedCount ?? deduction.count) || 0;
    const penalizedCount = Number(deduction.penalizedCount ?? deduction.count) || 0;
    const protectedCount = Number(deduction.protectedCount) || 0;
    const populationLabel = isSystemic
      ? `${formatNumber(observedCount)} clientes observados · 1 penalização sistêmica`
      : `${formatNumber(observedCount)} observados · ${formatNumber(penalizedCount)} penalizados${protectedCount ? ` · ${formatNumber(protectedCount)} protegidos` : ''}`;
    const ruleLabel = isSystemic ? '-5 pts no total · penalização única da fonte' : `${formatNumber(penalizedCount)} × -${formatNumber(deduction.pointsPerItem)} pts`;
    return (
      <button type="button" className={`score-ledger-row ${isSystemic ? 'systemic' : ''}`} key={deduction.id} onClick={() => openDeduction(deduction)}>
        <span className="score-ledger-row-copy">
          <span className="score-ledger-row-top"><strong>{deduction.label}</strong><b className="score-ledger-penalty">-{formatNumber(deduction.points)} pts perdidos</b></span>
          <small><strong>{populationLabel}</strong> <i>·</i> {ruleLabel} <i>·</i> <b>-{formatNumber(deduction.points)} pts no total</b> <i>·</i> {deduction.source}</small>
        </span>
        <span className="score-ledger-row-action">Abrir causa ↗</span>
      </button>
    );
  };
  const renderMission = (mission, index) => (
    <button type="button" className={`mission-card ${mission.accent} ${index === 0 ? 'mission-card-primary' : 'mission-card-compact'}`} key={mission.id} onClick={() => onSelect(mission.kpiId, mission.readinessId)} aria-label={`Abrir missão: ${mission.title}`}>
      <div className="mission-card-top"><span>Missão {String(index + 1).padStart(2, '0')}</span><b>{mission.status}</b></div>
      <strong>{mission.title}</strong>
      <div className="mission-card-meta"><span>{formatNumber(mission.current)} {mission.unit} restantes</span><b>{formatPoints(mission.recoverablePoints)} recuperáveis</b></div>
      <div className="mission-progress" aria-label="Progresso da missão"><i style={{ width: `${mission.progressPct}%` }} /></div>
      <small>{mission.description}</small>
      <em>Abrir evidências ↗</em>
    </button>
  );

  return (
    <section className="mission-board data-panel hierarchy-secondary" aria-label="Missões da carteira e placar executivo">
      <ExecutiveSectionHeader icon={ShieldAlert} eyebrow="Recuperação" title="Qual movimento recupera mais pontos?" note={`${missions.length} missões abertas`} />
      <div className="mission-board-summary">
        <div className="mission-board-copy"><p>Cada missão nasce de um sinal real do Monday. O placar mede recuperação do sistema, não competição entre pessoas.</p><div className="mission-objective"><span>Próximo passo</span><strong>{missions[0]?.title || 'Acompanhar os sinais disponíveis.'}</strong></div></div>
        <div className={`mission-score ${score < 0 ? 'negative' : ''}`}><span>Placar bruto</span><strong>{formatPoints(score)}</strong><small>{formatPoints(recoverable)} recuperáveis</small><em>base de {scoreBase} pts</em></div>
      </div>
      <div className="mission-layout">
        <div className="mission-list">
          {missions.length ? <>
            {renderMission(missions[0], 0)}
            {missions.length > 1 ? <div className="mission-secondary-list">{missions.slice(1).map((mission, index) => renderMission(mission, index + 1))}</div> : null}
          </> : <div className="mission-empty">Nenhuma missão crítica nesta leitura.</div>}
        </div>
        {deductions.length ? <ExecutiveDisclosure label="Origem dos descontos" summary={`${deductions.length} fontes · -${formatNumber(lostPoints)} pts`}>
          <div className="score-ledger">
            <div className="score-ledger-summary"><span>Fechamento do placar</span><strong>{formatNumber(scoreBase)} pts base − {formatNumber(lostPoints)} pts perdidos = {formatPoints(score)}</strong><small>{formatPoints(recoverable)} recuperáveis se as missões forem comprovadas.</small></div>
            <div className="score-ledger-group"><span className="score-ledger-group-title">Execução e entrega</span>{operationalDeductions.map(renderDeduction)}</div>
            <div className="score-ledger-group readiness"><span className="score-ledger-group-title">Prontidão da carteira</span>{readinessDeductions.map(renderDeduction)}</div>
          </div>
        </ExecutiveDisclosure> : null}
      </div>
    </section>
  );
}
