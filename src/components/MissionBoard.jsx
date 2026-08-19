import { buildMissions, formatNumber, formatPoints } from './executive-helpers.js';

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
        <span className="score-ledger-row-action">ABRIR CAUSA ↗</span>
      </button>
    );
  };

  return (
    <section className="mission-board data-panel" aria-label="Missões da carteira e placar executivo">
      <div className="mission-board-header">
        <div className="mission-board-copy"><span className="executive-section-kicker">VYBE OS · MISSÕES DA CARTEIRA</span><h2>Recupere o placar da operação</h2><p>Cada missão nasce de um sinal real do Monday. Não é competição entre pessoas: é recuperação do sistema.</p><div className="mission-objective"><span>OBJETIVO DA LEITURA</span><strong>Resolver sinais comprovados e devolver pontos ao placar.</strong></div></div>
        <div className={`mission-score ${score < 0 ? 'negative' : ''}`}><span>PLACAR BRUTO ATUAL</span><strong>{formatPoints(score)}</strong><small>{formatPoints(recoverable)} recuperáveis</small><em>Meta de recuperação: 100 pts</em></div>
      </div>
      <div className="mission-layout">
        <div className="mission-list">
          {missions.map((mission, index) => (
            <button type="button" className={`mission-card ${mission.accent}`} key={mission.id} onClick={() => onSelect(mission.kpiId, mission.readinessId)} aria-label={`Abrir missão: ${mission.title}`}>
              <div className="mission-card-top"><span>MISSÃO {String(index + 1).padStart(2, '0')}</span><b>{mission.status}</b></div>
              <strong>{mission.title}</strong>
              <div className="mission-card-meta"><span>{formatNumber(mission.current)} {mission.unit} restantes</span><b>{formatPoints(mission.recoverablePoints)} recuperáveis</b></div>
              <div className="mission-progress" aria-label="Progresso da missão"><i style={{ width: `${mission.progressPct}%` }} /></div>
              <small>{mission.description}</small>
              <em>ABRIR EVIDÊNCIAS ↗</em>
            </button>
          ))}
        </div>
        <div className="score-ledger">
          <div className="score-ledger-header"><div><span>PLACAR · ORIGEM DOS DESCONTOS</span><strong>O que está tirando pontos</strong></div><b>{deductions.length} fontes · -{formatNumber(lostPoints)} pts perdidos</b></div>
          <div className="score-ledger-summary"><span>FECHAMENTO DO PLACAR</span><strong>{formatNumber(scoreBase)} pts base − {formatNumber(lostPoints)} pts perdidos = {formatPoints(score)}</strong><small>{formatPoints(recoverable)} recuperáveis se as missões forem comprovadas.</small></div>
          <div className="score-ledger-group"><span className="score-ledger-group-title">EXECUÇÃO E ENTREGA</span>{operationalDeductions.map(renderDeduction)}</div>
          <div className="score-ledger-group readiness"><span className="score-ledger-group-title">PRONTIDÃO DA CARTEIRA</span>{readinessDeductions.map(renderDeduction)}</div>
        </div>
      </div>
    </section>
  );
}
