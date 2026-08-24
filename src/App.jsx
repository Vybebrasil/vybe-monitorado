import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Target, Activity, ShieldAlert, Crosshair, X, Info, RefreshCw } from 'lucide-react';
import { statusColorFor } from './data/status-colors.js';
import { PeopleAvatars } from './components/PeopleAvatars.jsx';
import { buildMissions, canonicalStage, clampPct, clickable, delayUrgency, formatDate, formatNumber, formatPct, formatPoints, mondayItemUrl, riskTone, scoreComposition, splitOwners, statusTone } from './components/executive-helpers.js';
import { ExecutiveMeter } from './components/ExecutiveMeter.jsx';
import { ReadinessKpiBand } from './components/ReadinessKpiBand.jsx';
import { MissionBoard } from './components/MissionBoard.jsx';
import { ExecutivePulseBars } from './components/ExecutivePulseBars.jsx';
import { ExecutiveDemandPanel } from './components/ExecutiveDemandPanel.jsx';
import { ExecutivePerformancePanel } from './components/ExecutivePerformancePanel.jsx';
import ExecutiveOperationsExplorer from './components/ExecutiveOperationsExplorer.jsx';
import ExecutiveSourceReconciliation from './components/ExecutiveSourceReconciliation.jsx';
import ExecutiveEntityProfileDrawer from './components/ExecutiveEntityProfileDrawer.jsx';
import { ExecutiveDashboardShell } from './components/ExecutiveDashboardShell.jsx';
import { ExecutiveAnalyticsCenter } from './components/ExecutiveAnalyticsCenter.jsx';
import ExecutiveCommandCenter from './components/ExecutiveCommandCenter.jsx';
import { AnalyticsDrilldownDrawer } from './components/AnalyticsDrilldownDrawer.jsx';
import ExecutiveHistoryCenter from './components/ExecutiveHistoryCenter.jsx';

// Carregada sob demanda: sÃ³ ela usa Recharts, que responde pela maior parte do bundle.
const AnalystStation = lazy(() => import('./stations/AnalystStation.jsx'));
const ZenStation = lazy(() => import('./stations/ZenStation.jsx'));

// --- COMPONENTES VYBE OS ---

const HudHeader = ({ title, subtitle }) => (
  <div className="hud-bar">
    <div>
      <span style={{ color: 'var(--vybe-text-muted)' }}>+ VYBE INTELLIGENCE / </span>
      <span style={{ color: 'var(--vybe-orange)' }}>{title}</span>
    </div>
    <div style={{ color: 'var(--vybe-text-muted)' }}>{subtitle}</div>
  </div>
);

const HudFooter = ({ snapshot, contextLabel = 'JARVIS / GUIA EXECUTIVO' }) => {
  const stability = Number.isFinite(snapshot?.portfolioStability?.score) ? snapshot.portfolioStability.score : null;
  // O corte Ã© do domÃ­nio (stable / attention / risk), nÃ£o um nÃºmero solto na UI.
  const stabilityStatus = snapshot?.portfolioStability?.status;
  const overdueInternal = snapshot?.quantitative?.overdueInternal ?? 0;
  const stalled = snapshot?.portfolioExecution?.stalled?.length ?? 0;

  return (
    <div className="hud-bar bottom">
      <div>{contextLabel}</div>
      <div className="hud-telemetry">
        <div className={`telemetry-box ${stabilityStatus === 'risk' ? 'alert' : stabilityStatus === 'attention' ? 'warning' : ''}`}>
          <span className="telemetry-val">{stability === null ? 'N/D' : `${stability}%`}</span>
          <span className="telemetry-label">ESTABILIDADE</span>
        </div>
        <div className={`telemetry-box ${overdueInternal > 0 ? 'warning' : ''}`}>
          <span className="telemetry-val">{overdueInternal}</span>
          <span className="telemetry-label">GARGALOS INT.</span>
        </div>
        <div className={`telemetry-box ${stalled > 0 ? 'alert' : ''}`}>
          <span className="telemetry-val">{stalled}</span>
          <span className="telemetry-label">SEM EXECUÃ‡ÃƒO</span>
        </div>
      </div>
      <div>VYBE OS / CENTRAL OPERACIONAL</div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p>{payload[0].payload.name || payload[0].payload.stage}</p>
        <span>{payload[0].value} ITENS</span>
      </div>
    );
  }
  return null;
};

function SourceFreshness({ snapshot, onRefresh, refreshing, refreshError }) {
  const quality = snapshot?.sourceQuality || {};
  const boards = quality.monday?.boards || {};
  const complete = quality.complete ?? quality.monday?.complete;
  const freshness = quality.freshness || 'live';
  const sync = quality.sync || null;
  const fieldCoverage = quality.fieldCoverage || null;
  const mixedConsistency = quality.consistency?.mode === 'mixed';
  const capturedAt = quality.capturedAt || snapshot?.generatedAt;
  const capturedLabel = capturedAt
    ? new Date(capturedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'horÃ¡rio indisponÃ­vel';
  const boardLabels = [
    ['production', 'ProduÃ§Ã£o de ConteÃºdo'],
    ['clients', 'Clientes'],
    ['demands', 'SolicitaÃ§Ãµes de Demandas']
  ];
  const calendarSignals = snapshot?.calendarSignals;
  const calendarAvailable = calendarSignals?.quality?.status === 'ok';
  const derivedRecordCount = quality.records ?? snapshot?.quantitative?.activeItems ?? snapshot?.summary?.openItems ?? null;
  const recordLabel = quality.records === null || quality.records === undefined ? 'itens no recorte' : 'registros lidos';
  const displaySourceCount = value => Number.isFinite(Number(value)) && Number(value) > 0 ? formatNumber(value) : 'N/D';
  const displayBoard = (board, label) => {
    if (!board) return null;
    const status = board.complete ? 'OK' : board.derived ? 'metadado parcial' : 'incompleta';
    const pages = board.pages === null || board.pages === undefined ? 'pÃ¡ginas N/D' : `${formatNumber(board.pages)} pÃ¡g.`;
    return <span key={label} className={board.complete ? 'source-board-ok' : 'source-board-warning'}><b>{label}</b> {displaySourceCount(board.count)} reg. Â· {pages} Â· {status}</span>;
  };

  const statusLabel = freshness === 'fallback'
    ? 'Leitura direta'
    : freshness === 'stale'
      ? 'Dados desatualizados'
      : complete
        ? 'Leitura completa'
        : 'Leitura parcial';
  const sourceLabel = quality.source || 'Monday.com';
  const syncLabel = sync?.version ? `versÃ£o ${sync.version}${sync.ageSeconds !== null && sync.ageSeconds !== undefined ? ` Â· ${sync.ageSeconds}s` : ''}` : null;
  const stableCycles = Number(sync?.versionMonitor?.pollsWithoutVersionChange) || 0;
  const monitorLabel = stableCycles >= 2 ? ` Â· estÃ¡vel hÃ¡ ${stableCycles} ciclos` : '';

  return (
    <div className={`source-freshness-strip ${complete ? 'complete' : 'partial'} ${freshness}`} aria-label="Qualidade e frescor das fontes">
      <div className="source-freshness-main">
        <span className="source-freshness-dot" />
        <strong>{statusLabel}</strong>
        <span>{sourceLabel} Â· capturado {capturedLabel}{syncLabel ? ` Â· ${syncLabel}` : ''}{monitorLabel}</span>
        <button type="button" className="manual-refresh-button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing} title="Buscar novamente os dados do Monday e da Agenda agora">
          <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Atualizando dadosâ€¦' : freshness === 'stale' || freshness === 'fallback' ? 'Atualizar agora' : 'Atualizar dados'}
        </button>
        {refreshError ? <span className="manual-refresh-error" role="alert">AtualizaÃ§Ã£o falhou Â· {refreshError}</span> : null}
      </div>
      <div className="source-freshness-stats">
        <span><b>{displaySourceCount(derivedRecordCount)}</b> {recordLabel}</span>
        <span><b>{quality.pages === null || quality.pages === undefined ? 'N/D' : formatNumber(quality.pages)}</b> pÃ¡ginas confirmadas</span>
        {boardLabels.map(([key, label]) => displayBoard(boards[key], label))}
        {fieldCoverage && !fieldCoverage.complete ? <span className="source-board-warning"><b>Campos</b> faltando: {fieldCoverage.missing.join(', ')}</span> : null}
        {mixedConsistency ? <span className="source-board-warning" title={quality.consistency.note}><b>Coorte mista</b> ProduÃ§Ã£o versionada Â· demais fontes diretas</span> : null}
        {calendarSignals ? <span className={calendarAvailable ? 'source-board-ok' : 'source-board-warning'}><b>Agenda</b> {calendarAvailable ? `${formatNumber(calendarSignals.next7Count)} em 7d Â· ${formatNumber(calendarSignals.riskClientsWithoutMeeting?.length)} riscos sem reuniÃ£o` : 'indisponÃ­vel'}</span> : null}
      </div>
    </div>
  );
}

function SnapshotDeltaBand({ history }) {
  const available = history?.available === true;
  const formatSigned = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return '0';
    return `${numeric > 0 ? '+' : ''}${formatNumber(numeric)}`;
  };
  const directionLabel = direction => direction === 'improving' ? 'melhorou' : direction === 'worsening' ? 'piorou' : 'estÃ¡vel';
  const directionClass = direction => direction === 'improving' ? 'improving' : direction === 'worsening' ? 'worsening' : 'stable';

  if (!available) {
    const firstRead = history?.status === 'no_baseline';
    return (
      <section className="snapshot-delta-band unavailable" aria-label="EvoluÃ§Ã£o do placar">
        <div>
          <span className="snapshot-delta-kicker">O QUE MUDOU DESDE A ÃšLTIMA LEITURA</span>
          <h3>{firstRead ? 'Primeira leitura persistida' : 'Sem comparaÃ§Ã£o histÃ³rica'}</h3>
          <p>{history?.message || 'Configure o histÃ³rico executivo para acompanhar recuperaÃ§Ã£o, piora e novos sinais.'}</p>
        </div>
        <span className="snapshot-delta-state">HISTÃ“RICO NÃƒO DISPONÃVEL</span>
      </section>
    );
  }

  const score = history.score || {};
  const changes = history.changes || [];
  return (
    <section className="snapshot-delta-band" aria-label="O que mudou desde a Ãºltima leitura">
      <div className="snapshot-delta-lead">
        <span className="snapshot-delta-kicker">O QUE MUDOU DESDE A ÃšLTIMA LEITURA</span>
        <h3>{score.delta > 0 ? 'A operaÃ§Ã£o recuperou pressÃ£o' : score.delta < 0 ? 'A operaÃ§Ã£o acumulou pressÃ£o' : 'A operaÃ§Ã£o permaneceu estÃ¡vel'}</h3>
        <p>ComparaÃ§Ã£o real entre snapshots persistidos; sem tendÃªncia artificial.</p>
      </div>
      <div className={`snapshot-delta-score ${directionClass(score.direction)}`}>
        <strong>{formatSigned(score.delta)} pts</strong>
        <span>{score.current ?? 'N/D'} pts atuais Â· {directionLabel(score.direction)}</span>
      </div>
      <div className="snapshot-delta-changes">
        {changes.slice(0, 6).map(change => (
          <div key={change.key} className={`snapshot-delta-item ${directionClass(change.direction)}`}>
            <strong>{change.label}</strong>
            <span>{change.previous} â†’ {change.current}</span>
            <small>{formatSigned(change.delta)} Â· {directionLabel(change.direction)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExecutiveKpiBand({ snapshot, riskClients, onSelect, history, onRefresh, refreshing, refreshError }) {
  const quantitative = snapshot?.quantitative || {};
  const execution = snapshot?.portfolioExecution || {};
  const activeItems = Number(quantitative.activeItems) || 0;
  const activeBase = activeItems + (Number(quantitative.completedItems) || 0);
  const eligibleClients = Number(execution.eligibleClients) || 0;
  const exposedPct = eligibleClients ? (Number(riskClients) / eligibleClients) * 100 : null;
  const stalledPct = eligibleClients ? (Number(execution.stalled?.length || 0) / eligibleClients) * 100 : null;
  const stability = snapshot?.portfolioStability?.score;
  const delayedInternal = Number(quantitative.overdueInternal) || 0;
  const delayedPublication = Number(quantitative.overduePublication) || 0;
  const stalledCount = Number(execution.stalled?.length || 0);
  const delayedDemands = Number(snapshot?.summary?.delayedDemands) || 0;
  const healthScore = Number.isFinite(Number(stability)) ? Number(stability) : 0;
  const healthExplanation = scoreComposition(snapshot);
  const stabilityTone = healthScore < 0 ? 'catastrophic' : healthScore < 25 ? 'critical' : healthScore < 60 ? 'warning' : 'stable';
  const cards = [
    { id: 'health', label: 'SAÃšDE EXECUTIVA', value: formatPoints(healthScore), detail: `${healthScore < 0 ? 'ABAIXO DA LINHA DE RECUPERAÃ‡ÃƒO' : snapshot?.portfolioStability?.label || 'sem leitura'} Â· score bruto`, progress: healthScore, min: -100, max: 100, tone: stabilityTone, title: 'Score bruto de pressÃ£o operacional. Pode ficar negativo; nÃ£o Ã© percentual de itens saudÃ¡veis nem indicador financeiro.', explanation: healthExplanation, action: 'Abrir composiÃ§Ã£o do score' },
    { id: 'delays', label: 'ATRASOS INTERNOS', value: formatNumber(delayedInternal), detail: `${formatPct(quantitative.overdueInternalPctOfActive)} dos ativos Â· -${formatNumber(delayedInternal * 2)} pts`, progress: quantitative.overdueInternalPctOfActive, tone: 'critical', title: 'Itens ativos de ProduÃ§Ã£o de ConteÃºdo com prazo interno vencido.', explanation: `${formatNumber(delayedInternal)} itens de ProduÃ§Ã£o de ConteÃºdo no Monday, distribuÃ­dos por cliente, responsÃ¡vel, etapa, status e dias de atraso. Cada item retira 2 pontos.`, action: 'Abrir os atrasos de ProduÃ§Ã£o de ConteÃºdo' },
    { id: 'exposure', label: 'CLIENTES EXPOSTOS', value: formatNumber(riskClients), detail: eligibleClients ? `${formatNumber(riskClients)} de ${formatNumber(eligibleClients)} ativos Â· ${formatPct(exposedPct)}` : 'denominador indisponÃ­vel', progress: exposedPct, tone: 'warning', title: 'Clientes com pelo menos um atraso agregado no recorte.', explanation: `${formatNumber(riskClients)} de ${formatNumber(eligibleClients)} clientes ativos tÃªm pelo menos um atraso interno ou de veiculaÃ§Ã£o.`, action: 'Abrir clientes expostos' },
    { id: 'execution', label: 'SEM EXECUÃ‡ÃƒO', value: formatNumber(stalledCount), detail: `${formatPct(stalledPct)} da carteira Â· -${formatNumber(stalledCount * 5)} pts`, progress: stalledPct, tone: 'critical', title: 'Clientes ativos sem conteÃºdo em ProduÃ§Ã£o de ConteÃºdo e sem solicitaÃ§Ã£o aberta.', explanation: `${formatNumber(stalledCount)} clientes estÃ£o sem conteÃºdo em ProduÃ§Ã£o de ConteÃºdo e sem demanda aberta; onboarding Ã© tratado separadamente. Cada um retira 5 pontos.`, action: 'Abrir clientes sem execuÃ§Ã£o' },
    { id: 'active', priority: 'supporting', label: 'ITENS ATIVOS', value: formatNumber(activeItems), detail: `${formatPct(quantitative.activePct)} da base histÃ³rica`, progress: quantitative.activePct, tone: 'cyan', title: 'Itens ativos no recorte atual do board ProduÃ§Ã£o de ConteÃºdo.', explanation: `${formatNumber(activeItems)} ativos de ${formatNumber(activeBase)} itens lidos, excluindo Finalizado, Publicado e Cancelado do recorte ativo.`, action: 'Abrir composiÃ§Ã£o da carteira' },
    { id: 'publication', priority: 'supporting', label: 'VEICULAÃ‡Ã•ES VENCIDAS', value: formatNumber(delayedPublication), detail: `${formatPct(quantitative.overduePublicationPctOfActive)} dos ativos Â· -${formatNumber(delayedPublication * 5)} pts`, progress: quantitative.overduePublicationPctOfActive, tone: 'warning', title: 'Itens de ProduÃ§Ã£o de ConteÃºdo que ultrapassaram a data prevista de veiculaÃ§Ã£o.', explanation: `${formatNumber(delayedPublication)} itens tÃªm a veiculaÃ§Ã£o vencida; cada item serÃ¡ mostrado com cliente, responsÃ¡vel, prazo e motivo. Cada um retira 5 pontos.`, action: 'Abrir veiculaÃ§Ãµes vencidas' }
  ];
  const primaryCards = cards.filter(card => !card.priority);
  const supportCards = cards.filter(card => card.priority === 'supporting');
  const activeSignals = [delayedInternal, delayedPublication, stalledCount, delayedDemands].filter(value => value > 0).length;
  const renderCard = card => (
    <article className={`executive-kpi-card ${card.tone} ${card.priority || 'decision-primary'}`} key={card.id} {...clickable(() => onSelect(card.id), `${card.action}: ${card.label}`)}>
      <div className="executive-kpi-card-top"><span className="executive-kpi-label">{card.label}</span><span className="executive-kpi-card-action">INVESTIGAR â†—</span></div>
      <strong className="executive-kpi-value">{card.value}</strong>
      <span className="executive-kpi-detail">{card.detail}</span>
      <ExecutiveMeter value={card.progress} min={card.min ?? 0} max={card.max ?? 100} tone={card.tone} label={card.title} displayValue={card.id === 'health' ? formatPoints(healthScore) : undefined} />
      <div className="executive-kpi-tooltip"><strong>{card.title}</strong><span>{card.explanation}</span><small>{card.action}</small></div>
    </article>
  );

  return (
    <section className="executive-kpi-band" aria-label="KPIs executivos da carteira">
      <div className="executive-kpi-header"><div><span className="executive-section-kicker">DECIDA PELA CARTEIRA</span><h2>O que exige decisÃ£o agora?</h2><p className="executive-kpi-subtitle">Quatro sinais prioritÃ¡rios, dois indicadores de suporte e investigaÃ§Ã£o em um clique.</p></div><div className="executive-kpi-context"><strong>{activeSignals}</strong><span>sinais crÃ­ticos ativos</span><b>{formatPoints(healthScore)}</b><small>placar bruto</small></div></div>
      <SourceFreshness snapshot={snapshot} onRefresh={onRefresh} refreshing={refreshing} refreshError={refreshError} />
      <div className="executive-kpi-primary-row">{primaryCards.map(renderCard)}</div>
      <div className="executive-kpi-support-row" aria-label="KPIs de suporte">{supportCards.map(renderCard)}</div>
      <SnapshotDeltaBand history={history} />
    </section>
  );
}





function StageDistribution({ snapshot }) {
  const activeItems = Number(snapshot?.quantitative?.activeItems) || 0;
  const byStage = snapshot?.productivity?.byStage || [];
  const groupCounts = snapshot?.quantitative?.groupCounts || {};
  const source = byStage.length ? byStage : Object.entries(groupCounts).map(([stage, count]) => ({ stage, count, pctOfActive: activeItems ? (count / activeItems) * 100 : 0 }));
  const categories = ['RedaÃ§Ã£o', 'ProduÃ§Ã£o', 'CriaÃ§Ã£o', 'SaÃ­das'].map(stage => {
    const matching = source.filter(row => canonicalStage(row.stage) === stage);
    const count = matching.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
    return { stage, count, pct: activeItems ? (count / activeItems) * 100 : 0 };
  });
  const max = Math.max(...categories.map(row => row.count), 1);

  return (
    <section className="data-panel visual-panel stage-distribution" aria-label="DistribuiÃ§Ã£o de itens por etapa">
      <div className="data-panel-title"><span>FLUXO DA CARTEIRA Â· POR ETAPA</span><span className="panel-subtitle">{formatNumber(activeItems)} ATIVOS</span></div>
      <div className="visual-question">Onde o trabalho estÃ¡ concentrado?</div>
      <div className="stage-bars">
        {categories.map(row => (
          <div className="stage-bar-row" key={row.stage}>
            <div className="stage-bar-heading"><strong>{row.stage}</strong><span>{formatNumber(row.count)} Â· {formatPct(row.pct)}</span></div>
            <div className="stage-bar-track"><span style={{ width: `${(row.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="visual-footnote">RedaÃ§Ã£o, ProduÃ§Ã£o, CriaÃ§Ã£o e SaÃ­das seguem a divisÃ£o executiva do Nexus; os nomes operacionais do Monday sÃ£o normalizados apenas para leitura.</p>
    </section>
  );
}

function StatusComposition({ snapshot }) {
  const statusCounts = snapshot?.quantitative?.statusCounts || {};
  const statusColors = snapshot?.quantitative?.statusColors || {};
  const entries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + (Number(count) || 0), 0) || 1;
  const visible = entries.slice(0, 8);
  return (
    <section className="data-panel visual-panel status-composition" aria-label="ComposiÃ§Ã£o da carteira por status">
      <div className="data-panel-title"><span>COMPOSIÃ‡ÃƒO Â· STATUS MONDAY</span><span className="panel-subtitle">{formatNumber(total)} ATIVOS</span></div>
      <div className="visual-question">Em que estado a carteira estÃ¡?</div>
      <div className="status-stack" aria-label="DistribuiÃ§Ã£o proporcional dos status">
        {visible.map(([status, count]) => <span key={status} className={`status-segment ${statusTone(status)}`} style={{ width: `${(Number(count) / total) * 100}%`, backgroundColor: statusColorFor(status, statusColors) }} title={`${status}: ${formatNumber(count)} itens`} />)}
      </div>
      <div className="status-legend">
        {visible.map(([status, count]) => <div key={status} className="status-legend-item"><span className={`status-dot ${statusTone(status)}`} style={{ backgroundColor: statusColorFor(status, statusColors), boxShadow: `0 0 7px ${statusColorFor(status, statusColors)}` }} /><span>{status}</span><strong>{formatNumber(count)} <small>{formatPct((Number(count) / total) * 100)}</small></strong></div>)}
      </div>
      {entries.length > visible.length ? <div className="visual-footnote">+ {entries.length - visible.length} status adicionais no recorte. A composiÃ§Ã£o respeita os nomes existentes no Monday.</div> : null}
    </section>
  );
}

function ownerUrgency(daysOverdue) {
  const days = Number(daysOverdue) || 0;
  if (days >= 14) return { key: 'critical-max', label: 'CrÃ­tico mÃ¡ximo', short: `${days}D` };
  if (days >= 7) return { key: 'critical', label: 'CrÃ­tico', short: `${days}D` };
  if (days >= 3) return { key: 'high', label: 'Alto', short: `${days}D` };
  if (days >= 1) return { key: 'attention', label: 'AtenÃ§Ã£o', short: `${days}D` };
  return { key: 'clear', label: 'Sem atraso', short: '0D' };
}

function OwnerBars({ owners, totalDelays, statusColors, selectedOwnerId, onSelect, onOpen }) {
  const rankedOwners = owners.map(owner => {
    const maxDays = Math.max(...(owner.details || []).map(item => Number(item.daysOverdue) || 0), 0);
    return { ...owner, maxDays, urgency: ownerUrgency(maxDays) };
  }).sort((a, b) => b.maxDays - a.maxDays || Number(b.publication || 0) - Number(a.publication || 0) || b.count - a.count);
  const visible = rankedOwners.slice(0, 5);
  const max = Math.max(...rankedOwners.map(item => item.count), 1);
  const [hoveredOwnerId, setHoveredOwnerId] = useState(null);
  const activeOwnerId = hoveredOwnerId || selectedOwnerId;
  const visibleOwner = rankedOwners.find(owner => owner.id === activeOwnerId);
  const hoverDetails = visibleOwner?.details?.slice().sort((a, b) => (Number(b.daysOverdue) || 0) - (Number(a.daysOverdue) || 0)).slice(0, 5) || [];

  return (
    <section className="data-panel visual-panel owner-bars" aria-label="ConcentraÃ§Ã£o de atrasos por responsÃ¡vel">
      <div className="data-panel-title"><span>CONCENTRAÃ‡ÃƒO Â· RESPONSÃVEIS</span><span className="panel-subtitle">{formatNumber(totalDelays)} INTERNOS</span></div>
      <div className="visual-question">Onde os atrasos internos se concentram?</div>
      <div className="owner-bar-list">
        {visible.map(owner => {
          const isSelected = selectedOwnerId === owner.id;
          const isHovered = hoveredOwnerId === owner.id;
          const showOwnerPreview = hoveredOwnerId ? hoveredOwnerId === owner.id : isSelected;
          const selectOwner = () => {
            setHoveredOwnerId(owner.id);
            onSelect(owner);
          };
          return (
            <div
              className={`owner-bar-row ${owner.urgency.key} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
              key={owner.id}
              onMouseEnter={() => setHoveredOwnerId(owner.id)}
              onMouseLeave={() => setHoveredOwnerId(null)}
            >
              <button
                type="button"
                className="owner-bar-select"
                onClick={selectOwner}
                onFocus={() => setHoveredOwnerId(owner.id)}
                onBlur={() => setHoveredOwnerId(null)}
                aria-expanded={showOwnerPreview}
                aria-label={`${isSelected ? 'Pessoa selecionada' : 'Selecionar'} ${owner.name}`}
              >
                <div className="owner-bar-heading"><PeopleAvatars people={owner.people} names={owner.name} label={`ResponsÃ¡vel ${owner.name}`} size="md" /><div className="owner-bar-person-summary"><span className="owner-bar-person-name">{owner.name}</span><strong>{formatNumber(owner.count)} atrasos</strong><span>{owner.publication ? `${owner.publication} veiculaÃ§Ã£o` : 'sem veiculaÃ§Ã£o'}</span><em className={`owner-urgency-chip ${owner.urgency.key}`}>{owner.urgency.short} Â· {owner.urgency.label}</em></div><span className="owner-bar-share">{formatPct(totalDelays ? (owner.count / totalDelays) * 100 : null)}</span></div>
                <div className={`owner-bar-track ${owner.urgency.key}`}><span style={{ width: `${(owner.count / max) * 100}%` }} /></div>
                <small className="owner-bar-instruction"><strong>Maior atraso: {owner.maxDays} dia(s)</strong> Â· {isSelected ? 'selecionado Â· abrir abaixo' : 'selecione para fixar'}</small>
              </button>
              <button type="button" className="owner-bar-open" onClick={() => onOpen(owner)} aria-label={`Abrir todas as entregas de ${owner.name}`}>ABRIR {formatNumber(owner.count)} ENTREGAS â†—</button>
              {showOwnerPreview ? <div className="owner-bar-hover" role="tooltip">
                <div className="owner-bar-hover-title">{hoverDetails.length < 5 ? `${hoverDetails.length} DEMANDAS EM RISCO` : '5 DEMANDAS MAIS URGENTES'} Â· {owner.name}</div>
                {hoverDetails.length ? hoverDetails.map((item, index) => { const urgency = ownerUrgency(item.daysOverdue); return <a className={`owner-bar-hover-item ${urgency.key}`} key={item.id || `${item.name}-${index}`} href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer" title="Abrir evidÃªncia no Monday"><strong>{item.name}</strong><span>{item.client || 'Sem cliente'} Â· {item.stage || 'Etapa nÃ£o informada'}</span><small><b>{urgency.short} Â· {urgency.label}</b>{item.status ? ` Â· ${item.status}` : ''} <em>Abrir no Monday â†—</em></small></a>; }) : <span className="owner-bar-hover-empty">Nenhuma demanda detalhada disponÃ­vel.</span>}
              </div> : null}
            </div>
          );
        })}
      </div>
      <p className="visual-footnote">ConcentraÃ§Ã£o de sinais, nÃ£o mediÃ§Ã£o de produtividade individual. O denominador Ã© o total de atrasos internos encontrados. Clique no card para selecionar; use o botÃ£o para abrir todas as entregas.</p>
    </section>
  );
}

function RiskBars({ clients, showAll, onToggle, onSelect }) {
  const visible = clients.slice(0, showAll ? clients.length : 5);
  const max = Math.max(...clients.map(item => Number(item.riskPct) || 0), 1);
  return (
    <section className="data-panel visual-panel risk-bars" aria-label="Risco de previsibilidade por cliente">
      <div className="data-panel-title"><span>RISCO DE PREVISIBILIDADE Â· CLIENTES</span><span className="panel-subtitle">{formatNumber(clients.length)} EXPOSTOS</span></div>
      <div className="visual-question">Qual cliente exige decisÃ£o primeiro?</div>
      <div className="risk-bar-list">
        {visible.map(client => {
          const tone = riskTone(client.riskPct);
          return (
            <div className={`risk-bar-row ${tone}`} key={client.client} {...clickable(() => onSelect(client), `Abrir investigaÃ§Ã£o de ${client.client}`)}>
              <div className="risk-bar-heading"><strong>{client.client}</strong><span className={`risk-pct ${tone}`}>{formatPct(client.riskPct)}</span></div>
              <div className="risk-bar-track"><span style={{ width: `${(Number(client.riskPct) / max) * 100}%` }} /></div>
              <div className="risk-bar-meta"><span>{formatNumber(client.delayedItems)} atrasos / {formatNumber(client.openItems)} abertos</span><span>{formatNumber(client.internalDelays)} internos Â· {formatNumber(client.publicationDelays)} veiculaÃ§Ã£o</span></div>
            </div>
          );
        })}
      </div>
      {clients.length > 5 ? <button type="button" className="list-expand" onClick={onToggle}>{showAll ? 'Ver menos' : `VER MAIS (${clients.length - 5})`}</button> : null}
    </section>
  );
}

const buildInvestigation = (panel, list) => {
  const internal = list.filter(item => item.delayType?.includes('prazo interno'));
  const publication = list.filter(item => item.delayType?.includes('veiculaÃ§Ã£o'));
  const totalDays = list.reduce((total, item) => total + (Number(item.daysOverdue) || 0), 0);
  const clients = [...new Set(list.map(item => item.client).filter(Boolean))];
  const stages = [...new Set(list.map(item => item.stage).filter(Boolean))];
  const oldest = list.reduce((oldestItem, item) => (item.daysOverdue || 0) > (oldestItem?.daysOverdue || 0) ? item : oldestItem, null);
  const dominantStage = Object.entries(list.reduce((map, item) => {
    const stage = item.stage || 'Etapa nÃ£o informada';
    map[stage] = (map[stage] || 0) + 1;
    return map;
  }, {})).sort((a, b) => b[1] - a[1])[0];

  if (panel?.type === 'owner') {
    return {
      eyebrow: 'JARVIS Â· INVESTIGAÃ‡ÃƒO DE CAPACIDADE',
      title: `${panel.id} concentra um gargalo de fluxo`,
      narrative: `${list.length} item(s) atrasado(s) associado(s) a esta pessoa, distribuÃ­do(s) em ${clients.length || 1} cliente(s). O padrÃ£o aponta para concentraÃ§Ã£o de prazo, nÃ£o para uma mediÃ§Ã£o de produtividade individual.`,
      why: `${internal.length} atraso(s) de prazo interno${publication.length ? ` e ${publication.length} de veiculaÃ§Ã£o` : ''}. ${dominantStage ? `A maior concentraÃ§Ã£o aparece em â€œ${dominantStage[0]}â€ (${dominantStage[1]} item(s)).` : 'A etapa do fluxo nÃ£o estÃ¡ preenchida.'}`,
      recommendation: 'Investigar a causa do fluxo â€” dependÃªncia, aprovaÃ§Ã£o, briefing ou distribuiÃ§Ã£o â€” antes de atribuir mais carga ou cobrar velocidade.',
      metrics: [
        { label: 'ITENS AFETADOS', value: list.length },
        { label: 'CLIENTES', value: clients.length },
        { label: 'DIAS ACUMULADOS', value: totalDays },
        { label: 'MAIOR ATRASO', value: oldest ? `${oldest.daysOverdue}D` : 'N/D' }
      ],
      footer: 'A leitura identifica concentraÃ§Ã£o de sinais; nÃ£o classifica performance pessoal.'
    };
  }

  const client = panel?.id || 'este cliente';
  const delayed = list.filter(item => item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType);
  const onTime = list.length - delayed.length;
  return {
    eyebrow: 'JARVIS Â· INVESTIGAÃ‡ÃƒO DE PREVISIBILIDADE',
    title: `${client}: ${delayed.length} atrasados em ${list.length} itens abertos`,
    narrative: `${client} possui ${list.length} item(s) abertos no board ProduÃ§Ã£o de ConteÃºdo. ${delayed.length} estÃ£o atrasados e ${onTime} ainda nÃ£o venceram. A investigaÃ§Ã£o separa os dois grupos para nÃ£o confundir risco com volume de carteira.`,
    why: `${internal.length} atraso(s) de prazo interno${publication.length ? ` e ${publication.length} de veiculaÃ§Ã£o` : ''}. ${stages.length ? `O fluxo atravessa ${stages.length} etapa(s), com maior concentraÃ§Ã£o em â€œ${dominantStage?.[0] || stages[0]}â€.` : 'A etapa do fluxo nÃ£o estÃ¡ preenchida.'}`,
    recommendation: delayed.length > 0 ? 'Abrir primeiro os itens atrasados, confirmar o prÃ³ximo marco com a equipe e preparar a conversa executiva com o cliente se a data de veiculaÃ§Ã£o estiver comprometida.' : 'Nenhum item estÃ¡ atrasado nesta leitura; acompanhar os prÃ³ximos prazos sem tratar volume aberto como risco por si sÃ³.',
    metrics: [
      { label: 'ITENS ABERTOS', value: list.length },
      { label: 'ATRASADOS', value: delayed.length },
      { label: 'DENTRO DO PRAZO', value: onTime },
      { label: 'DIAS ACUMULADOS', value: totalDays }
    ],
    footer: 'O risco Ã© uma leitura de previsibilidade baseada nos itens abertos encontrados no Monday; itens concluÃ­dos ficam fora.'
  };
};

function InvestigationVisualSummary({ panel, list, delayDetails, snapshot }) {
  const delayedList = panel.type === 'client' ? list.filter(item => item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType) : list;
  const internal = delayedList.filter(item => item.isDelayedPrazo || item.delayType?.includes('prazo interno'));
  const publication = delayedList.filter(item => item.isDelayedVeiculacao || item.delayType?.includes('veiculaÃ§Ã£o'));
  const totalDays = delayedList.reduce((sum, item) => sum + (Number(item.daysOverdue) || 0), 0);
  const clientRow = snapshot?.clientRanking?.find(row => row.client === panel.id);
  const ownerBase = delayDetails.filter(item => item.delayType?.includes('prazo interno')).length || list.length;
  const numerator = panel.type === 'owner' ? list.length : (clientRow?.delayedItems ?? delayedList.length);
  const denominator = panel.type === 'owner' ? ownerBase : (clientRow?.openItems ?? list.length);
  const pct = panel.type === 'owner' ? (denominator ? (numerator / denominator) * 100 : null) : (clientRow?.riskPct ?? null);
  const stageCounts = Object.entries(list.reduce((acc, item) => {
    const stage = canonicalStage(item.stage);
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxStage = Math.max(...stageCounts.map(([, count]) => count), 1);
  const title = panel.type === 'owner' ? 'participaÃ§Ã£o nos atrasos internos' : 'exposiÃ§Ã£o dos itens abertos';

  return (
    <section className="investigation-visual-summary" aria-label="Resumo visual da investigaÃ§Ã£o">
      <div className="investigation-visual-head"><div><span>LEITURA VISUAL</span><strong>{title}</strong></div><b>{formatPct(pct)}</b></div>
      <div className="investigation-visual-track"><span style={{ width: `${clampPct(pct)}%` }} /></div>
      <div className="investigation-breakdown">
        <div><strong>{formatNumber(numerator)}</strong><span>{panel.type === 'owner' ? 'SINAIS ASSOCIADOS' : 'ATRASOS'}</span></div>
        <div><strong>{denominator === null ? 'N/D' : formatNumber(denominator)}</strong><span>{panel.type === 'owner' ? 'ATRASOS INTERNOS' : 'ITENS ABERTOS'}</span></div>
        <div><strong>{formatNumber(internal.length)}</strong><span>INTERNOS</span></div>
        <div><strong>{formatNumber(publication.length)}</strong><span>VEICULAÃ‡Ã•ES</span></div>
        <div><strong>{formatNumber(totalDays)}D</strong><span>DIAS ACUMULADOS</span></div>
      </div>
      {stageCounts.length > 0 ? (
        <div className="investigation-stage-bars">
          <span className="investigation-stage-label">ETAPAS DOMINANTES</span>
          {stageCounts.map(([stage, count]) => <div className="investigation-stage-row" key={stage}><span>{stage}</span><i><b style={{ width: `${(count / maxStage) * 100}%` }} /></i><strong>{count}</strong></div>)}
        </div>
      ) : null}
    </section>
  );
}

const DetailDrawer = ({ panel, setPanel, delayDetails, snapshot }) => {
  const [showAllClientItems, setShowAllClientItems] = useState(false);
  useEffect(() => {
    if (!panel) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, setPanel]);

  if (!panel || !['owner', 'client'].includes(panel.type)) return null;

  const activeItems = Array.isArray(snapshot?.activeItems) ? snapshot.activeItems : [];
  let list = [];
  if (panel.type === 'owner') {
    list = delayDetails.filter(d => splitOwners(d.responsavel).includes(panel.id));
  } else if (panel.type === 'client') {
    const clientItems = activeItems.filter(item => String(item.client || '') === String(panel.id));
    list = clientItems.length ? clientItems : delayDetails.filter(d => d.client === panel.id);
  }
  list = list.slice().sort((a, b) => {
    const delayedA = a.isDelayedPrazo || a.isDelayedVeiculacao || a.delayType ? 1 : 0;
    const delayedB = b.isDelayedPrazo || b.isDelayedVeiculacao || b.delayType ? 1 : 0;
    return delayedB - delayedA || (b.daysOverdue || 0) - (a.daysOverdue || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
  });
  const delayedClientItems = list.filter(item => item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType);
  const onTimeClientItems = list.filter(item => !(item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType));
  const investigation = buildInvestigation(panel, list);
  const renderEvidenceGroup = (items, label, expandable = false) => {
    const visibleItems = expandable && !showAllClientItems ? items.slice(0, 5) : items;
    return <>
      <div className="investigation-section-title">{label} Â· {items.length} ITEM(S)</div>
      <ul className="data-list investigation-evidence-list">
        {visibleItems.map((item, i) => {
          const link = mondayItemUrl(item.id);
          const delayed = Boolean(item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType);
          const urgency = delayed ? delayUrgency(item.daysOverdue) : { tone: 'stable', label: 'DENTRO DO PRAZO', description: 'O prazo ainda nÃ£o foi ultrapassado nesta leitura.' };
          return (
            <li key={item.id || `${item.name}-${i}`} className={`investigation-evidence-item urgency-${urgency.tone}`}>
              <div className="investigation-evidence-top"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`} title={urgency.description}>{delayed ? `ATRASO: ${item.daysOverdue || 0}D Â· ${urgency.label}` : 'DENTRO DO PRAZO'}</span></div>
              <div className="investigation-evidence-meta"><span>{item.client}</span><span>{item.stage || 'Etapa nÃ£o informada'}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColorFor(item.status, snapshot?.quantitative?.statusColors), borderColor: statusColorFor(item.status, snapshot?.quantitative?.statusColors) }}>{item.status}</span> : null}<span>{item.delayType || (delayed ? 'Atraso nÃ£o classificado' : 'Item aberto dentro do prazo')}</span></div>
              <div className="investigation-evidence-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>VeiculaÃ§Ã£o: {formatDate(item.veiculacao)}</span><span className="people-field"><b>Resp.</b><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="ResponsÃ¡vel" /></span></div>
              {item.editorDesigner && <div className="investigation-evidence-meta"><span className="people-field"><b>Editor/Designer</b><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span></div>}
              {link ? <a className="investigation-evidence-link" href={link} target="_blank" rel="noreferrer">Abrir no Monday â†—</a> : null}
            </li>
          );
        })}
      </ul>
      {expandable && items.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAllClientItems(value => !value)}>{showAllClientItems ? 'Ver menos' : `VER MAIS (${items.length - 5})`}</button> : null}
    </>;
  };

  return (
    <div className="drawer-overlay" onClick={() => setPanel(null)}>
      <aside className="drawer investigation-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>{panel.title}</h3>
            <p>INVESTIGAÃ‡ÃƒO EXECUTIVA Â· SOMENTE LEITURA</p>
          </div>
          <button className="drawer-close" aria-label="Fechar investigaÃ§Ã£o" onClick={() => setPanel(null)}><X size={32} /></button>
        </div>
        <div className="drawer-content">
          {list.length === 0 ? (
            <div className="investigation-empty"><strong>Sem evidÃªncia suficiente.</strong><span>O JARVIS nÃ£o vai inventar uma causa quando o Monday nÃ£o trouxe itens para este recorte.</span></div>
          ) : (
            <>
              <section className="investigation-hero">
                <span className="investigation-eyebrow">{investigation.eyebrow}</span>
                <h4>{investigation.title}</h4>
                <p>{investigation.narrative}</p>
              </section>
              <InvestigationVisualSummary panel={panel} list={list} delayDetails={delayDetails} snapshot={snapshot} />
              <div className="investigation-metrics">
                {investigation.metrics.map(metric => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
              </div>
              <section className="investigation-callout">
                <span>POR QUE ISSO IMPORTA</span>
                <p>{investigation.why}</p>
              </section>
              <section className="investigation-callout recommendation">
                <span>RECOMENDAÃ‡ÃƒO DO JARVIS</span>
                <p>{investigation.recommendation}</p>
              </section>
              <div className="client-investigation-total">{panel.type === 'client' ? `${delayedClientItems.length} atrasados Â· ${list.length} itens abertos no total` : `${list.length} evidÃªncias de atraso`}</div>
              {panel.type === 'client' ? <>
                {renderEvidenceGroup(delayedClientItems, 'ATRASADOS Â· PRODUÃ‡ÃƒO DE CONTEÃšDO')}
                {renderEvidenceGroup(onTimeClientItems, 'ABERTOS DENTRO DO PRAZO', onTimeClientItems.length > 5)}
              </> : renderEvidenceGroup(list, 'EVIDÃŠNCIAS Â· ITENS ATRASADOS')}
              <p className="investigation-footnote">{investigation.footer}</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};


function KpiInvestigationDrawer({ panel, setPanel, snapshot }) {
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(false); }, [panel]);
  if (!panel || panel.type !== 'kpi') return null;

  const quantitative = snapshot?.quantitative || {};
  const summary = snapshot?.summary || {};
  const execution = snapshot?.portfolioExecution || {};
  const delays = snapshot?.delayDetails || [];
  const internalDelays = delays.filter(item => item.delayType?.includes('prazo interno'));
  const publicationDelays = delays.filter(item => item.delayType?.includes('veiculaÃ§Ã£o'));
  const exposedClients = (snapshot?.clientRanking || []).filter(item => (Number(item.delayedItems) || 0) > 0).sort((a, b) => b.riskPct - a.riskPct);
  const statusRows = Object.entries(quantitative.statusCounts || {}).sort((a, b) => b[1] - a[1]);
  const stageRows = Object.entries(quantitative.groupCounts || {}).sort((a, b) => b[1] - a[1]);
  const activeItems = Array.isArray(snapshot?.activeItems) ? snapshot.activeItems : [];
  const selectedStatus = panel.statusFilter || '';
  const statusItems = selectedStatus ? activeItems.filter(item => String(item.status || '') === selectedStatus) : [];
  const visibleStatusItems = showAll ? statusItems : statusItems.slice(0, 5);
  const score = snapshot?.portfolioStability?.score;
  const delayedInternal = Number(quantitative.overdueInternal) || 0;
  const delayedPublication = Number(quantitative.overduePublication) || 0;
  const stalled = Number(execution.stalled?.length || 0);
  const delayedDemands = Number(summary.delayedDemands) || 0;
  const readiness = snapshot?.portfolioReadiness || {};
  const sourceRelation = snapshot?.sourceRelation || { counts: {}, overlapDetails: [], note: 'Relacionamento entre fontes ainda nÃ£o disponÃ­vel.' };
  const readinessDeduction = (readiness.scoreDeductions || []).find(deduction => deduction.id === panel.readinessId) || readiness.scoreDeductions?.[0];
  const readinessQuality = readinessDeduction?.kind === 'planning' ? readiness.quality?.planning : readiness.quality?.dashboard;
  const readinessQualityLabel = readinessQuality?.classification === 'source-empty-or-unmapped'
    ? 'FONTE VAZIA OU POSSIVELMENTE NÃƒO MAPEADA'
    : readinessQuality?.classification === 'partial-coverage'
      ? 'COBERTURA PARCIAL'
      : readinessQuality?.classification === 'complete-coverage'
        ? 'COBERTURA COMPLETA'
        : 'QUALIDADE NÃƒO INFORMADA';
  const readinessClients = readinessDeduction?.affectedClients || [];
  const readinessObservedClients = readinessDeduction?.observedClients || readinessClients;
  const readinessProtectedClients = readinessDeduction?.protectedClients || [];
  const visibleReadinessClients = showAll ? readinessClients : readinessClients.slice(0, 5);
  const visibleReadinessObservedClients = showAll ? readinessObservedClients : readinessObservedClients.slice(0, 5);
  const visibleReadinessProtectedClients = showAll ? readinessProtectedClients : readinessProtectedClients.slice(0, 5);
  const readinessKpis = readiness.kpis || {};
  const readinessKpi = {
    'readiness-planning': readinessKpis.planning,
    'readiness-meetings': readinessKpis.meetingsCurrentMonth,
    'readiness-agenda': readinessKpis.agendaNext30Days,
    'readiness-onboarding': readinessKpis.onboarding,
    'readiness-calendar': readinessKpis.calendar3Months
  }[panel.id];
  const readinessKpiWithClients = readinessKpi?.withClients || [];
  const readinessKpiWithoutClients = readinessKpi?.withoutClients || [];
  const readinessKpiClients = showAll ? [...readinessKpiWithClients, ...readinessKpiWithoutClients] : [...readinessKpiWithClients, ...readinessKpiWithoutClients].slice(0, 5);

  const configs = {
    health: { eyebrow: 'KPI Â· PLACAR EXECUTIVO', title: 'Qual Ã© a pressÃ£o real sobre o placar?', subtitle: 'O score bruto pode ficar negativo. Ele mostra o quanto a operaÃ§Ã£o estÃ¡ abaixo da linha de recuperaÃ§Ã£o.', accent: 'critical' },
    active: { eyebrow: 'KPI Â· CARTEIRA ATIVA', title: `O que compÃµe os ${formatNumber(quantitative.activeItems || 0)} itens ativos?`, subtitle: 'Clique em qualquer status para abrir os itens exatos desse grupo no board ProduÃ§Ã£o de ConteÃºdo.', accent: 'cyan' },
    delays: { eyebrow: 'KPI Â· PRODUÃ‡ÃƒO DE CONTEÃšDO', title: `${delayedInternal} itens de ProduÃ§Ã£o de ConteÃºdo com prazo interno vencido`, subtitle: 'Fonte: board ProduÃ§Ã£o de ConteÃºdo Â· prazo usado: prazo interno. Cada item abaixo tem cliente, responsÃ¡vel, etapa, status, datas e link direto para o Monday.', accent: 'critical' },
    exposure: { eyebrow: 'KPI Â· RISCO DE PREVISIBILIDADE', title: `${exposedClients.length} clientes expostos`, subtitle: 'Um cliente entra aqui quando possui pelo menos um atraso interno ou de veiculaÃ§Ã£o no recorte.', accent: 'warning' },
    execution: { eyebrow: 'KPI Â· GAP DE EXECUÃ‡ÃƒO', title: `${stalled} clientes sem execuÃ§Ã£o`, subtitle: 'Clientes ativos sem item no board ProduÃ§Ã£o de ConteÃºdo e sem SolicitaÃ§Ã£o de Demanda aberta; onboarding Ã© separado.', accent: 'critical' },
    publication: { eyebrow: 'KPI Â· PRODUÃ‡ÃƒO DE CONTEÃšDO', title: `${publicationDelays.length} veiculaÃ§Ãµes vencidas`, subtitle: 'Fonte: board ProduÃ§Ã£o de ConteÃºdo Â· prazo usado: data de veiculaÃ§Ã£o. SÃ£o itens que ultrapassaram a data prevista no Monday.', accent: 'warning' },
    readiness: { eyebrow: 'KPI Â· PRONTIDÃƒO EXECUTIVA', title: readinessDeduction?.label || 'Lacuna de prontidÃ£o', subtitle: 'A investigaÃ§Ã£o mostra se o problema estÃ¡ na fonte inteira ou em clientes especÃ­ficos, sem contar o mesmo cliente duas vezes.', accent: readinessDeduction?.kind === 'dashboard' ? 'cyan' : 'warning' },
    'readiness-planning': { eyebrow: 'KPI Â· PLANEJAMENTO', title: 'Quais clientes tÃªm ou nÃ£o tÃªm planejamento?', subtitle: 'Fonte: Monday.com Â· GestÃ£o de Clientes Â· Planejamento.', accent: 'warning' },
    'readiness-meetings': { eyebrow: 'KPI Â· REUNIÃ•ES Â· MONDAY', title: 'Quais clientes tiveram reuniÃ£o no mÃªs atual?', subtitle: 'Fonte: Monday.com Â· ReuniÃµes Â· coluna data. A leitura usa o mÃªs da captura atual.', accent: 'cyan' },
    'readiness-agenda': { eyebrow: 'KPI Â· AGENDA Â· GOOGLE CALENDAR', title: 'Quais clientes tÃªm reuniÃ£o na Agenda nos prÃ³ximos 30 dias?', subtitle: 'Fonte: Google Calendar Â· iCal Â· evento correspondido pelo nome do cliente. Esta fonte Ã© separada do board ReuniÃµes do Monday.', accent: 'cyan' },
    'readiness-onboarding': { eyebrow: 'KPI Â· FASE DE ENTRADA', title: 'Quais clientes estÃ£o em fase de entrada?', subtitle: 'A fase de entrada usa a janela de implantaÃ§Ã£o do Nexus e separa clientes novos do risco de inatividade.', accent: 'cyan' },
    'readiness-calendar': { eyebrow: 'KPI Â· CALENDÃRIO', title: 'Quais clientes tÃªm trÃªs meses de calendÃ¡rio?', subtitle: readinessKpi?.mapped ? 'Fonte: trÃªs colunas mensais configuradas no Monday.' : 'A leitura fica N/D atÃ© que trÃªs IDs de colunas mensais sejam mapeados no Monday.', accent: readinessKpi?.mapped ? 'warning' : 'cyan' }
  }[panel.id] || { eyebrow: 'KPI Â· INVESTIGAÃ‡ÃƒO', title: 'Detalhamento do KPI', subtitle: 'Leitura executiva baseada no snapshot atual.', accent: 'cyan' };

  const visibleDelays = showAll ? delays : delays.slice(0, 5);
  const visibleInternal = showAll ? internalDelays : internalDelays.slice(0, 5);
  const visiblePublication = showAll ? publicationDelays : publicationDelays.slice(0, 5);
  const visibleClients = showAll ? exposedClients : exposedClients.slice(0, 5);

  const evidencePenalty = item => {
    const delayType = String(item.delayType || '').toLowerCase();
    const hasInternal = delayType.includes('prazo interno');
    const hasPublication = delayType.includes('veiculaÃ§Ã£o');
    const labels = [hasInternal ? 'atraso interno' : null, hasPublication ? 'veiculaÃ§Ã£o em risco' : null].filter(Boolean);
    const points = (hasInternal ? 2 : 0) + (hasPublication ? 5 : 0);
    return { points: points || 2, label: labels.join(' + ') || 'sinal operacional' };
  };

  const evidenceList = (list, label, total = list.length, allItems = list) => {
    const totalPenalty = allItems.reduce((sum, item) => sum + evidencePenalty(item).points, 0);
    const visiblePenalty = list.reduce((sum, item) => sum + evidencePenalty(item).points, 0);
    const isPartialList = list.length < allItems.length;
    return (
    <>
      <div className="kpi-investigation-section-title"><span>{label} Â· {total} ITEM(S)</span><strong>-{formatNumber(totalPenalty)} pts no total</strong></div>
      {isPartialList ? <div className="kpi-evidence-subtotal">Exibindo {formatNumber(list.length)} de {formatNumber(allItems.length)} itens Â· -{formatNumber(visiblePenalty)} pts visÃ­veis</div> : null}
      <ul className="kpi-evidence-list">
        {list.map((item, index) => {
          const statusColor = statusColorFor(item.status, quantitative.statusColors);
          const urgency = delayUrgency(item.daysOverdue);
          const penalty = evidencePenalty(item);
          return <li key={item.id || `${item.name}-${index}`} className={`kpi-evidence-card urgency-${urgency.tone}`}>
            <div className="kpi-evidence-card-head"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`} title={urgency.description}>{item.daysOverdue ? `ATRASO: ${item.daysOverdue}D Â· ${urgency.label}` : 'EM ANDAMENTO'}</span><b className="evidence-penalty-chip">-{formatNumber(penalty.points)} pts Â· {penalty.label}</b></div>
            <div className="kpi-evidence-card-meta"><span>{item.client || 'Sem cliente'}</span><span className="people-field"><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="ResponsÃ¡vel" /></span><span>{item.stage || 'Etapa nÃ£o informada'}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColor, borderColor: statusColor }}>{item.status}</span> : null}</div>
            <div className="kpi-evidence-card-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>VeiculaÃ§Ã£o: {formatDate(item.veiculacao)}</span><span>{item.delayType || 'Atraso nÃ£o classificado'}</span>{item.editorDesigner ? <span className="people-field"><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span> : null}</div>
            <a className="investigation-evidence-link" href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer">Abrir no Monday â†—</a>
          </li>;
        })}
      </ul>
      {total > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${total - 5})`}</button> : null}
    </>
    );
  };

  return <div className="drawer-overlay" onClick={() => setPanel(null)}>
    <aside className={`drawer investigation-drawer kpi-investigation-drawer ${configs.accent}`} onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><h3>{configs.title}</h3><p>INVESTIGAÃ‡ÃƒO DO KPI Â· SOMENTE LEITURA</p></div><button className="drawer-close" aria-label="Fechar investigaÃ§Ã£o" onClick={() => setPanel(null)}><X size={32} /></button></div>
      <div className="drawer-content">
        <section className="investigation-hero"><span className="investigation-eyebrow">{configs.eyebrow}</span><h4>{configs.title}</h4><p>{configs.subtitle}</p></section>

        {readinessKpi ? <>
          <div className="kpi-score-explanation"><div><span>COM O SINAL</span><strong>{readinessKpi.withCount == null ? 'N/D' : formatNumber(readinessKpi.withCount)}</strong></div><div><span>SEM O SINAL</span><strong>{readinessKpi.withoutCount == null ? 'N/D' : formatNumber(readinessKpi.withoutCount)}</strong></div><div><span>COBERTURA</span><strong>{formatPct(readinessKpi.coveragePct)}</strong></div></div>
          <div className="readiness-quality-callout"><div><span>FONTE</span><strong>{readinessKpi.source || 'N/D'}</strong></div><div><span>PERÃODO/CAMPO</span><strong>{readinessKpi.period || readinessKpi.month || readinessKpi.columnIds?.join(', ') || 'N/D'}</strong></div><div><span>CLIENTES LISTADOS</span><strong>{readinessKpi.mapped === false ? 'N/D' : formatNumber(readinessKpiClients.length)}</strong></div></div>
          {readinessKpi.mapped === false ? <div className="investigation-callout"><span>QUALIDADE DA FONTE</span><p>{readinessKpi.message || 'A cobertura de trÃªs meses ainda nÃ£o estÃ¡ mapeada no Monday. O Nexus nÃ£o converte ausÃªncia de coluna em falso zero.'}</p></div> : <>
            <div className="kpi-investigation-section-title">CLIENTES COM O SINAL Â· {formatNumber(readinessKpiWithClients.length)}</div>
            <div className="kpi-client-grid">{readinessKpiWithClients.map(client => <div className="kpi-client-card" key={`with-${client}`}><strong>{client}</strong><div className="kpi-evidence-card-meta"><span>{panel.id === 'readiness-onboarding' ? 'Em fase de entrada' : panel.id === 'readiness-agenda' ? 'Evento correspondente na Agenda' : 'Campo/reuniÃ£o identificado'}</span></div></div>)}</div>
            <div className="kpi-investigation-section-title">CLIENTES SEM O SINAL Â· {formatNumber(readinessKpiWithoutClients.length)}</div>
            <div className="kpi-client-grid">{readinessKpiWithoutClients.slice(0, showAll ? readinessKpiWithoutClients.length : 5).map(client => <div className="kpi-client-card" key={`without-${client}`}><strong>{client}</strong><div className="kpi-evidence-card-meta"><span>{panel.id === 'readiness-onboarding' ? 'Fora da janela de entrada' : panel.id === 'readiness-agenda' ? 'Sem evento correspondente nos prÃ³ximos 30 dias' : 'Sem evidÃªncia no perÃ­odo/campo'}</span></div></div>)}</div>
            {readinessKpiWithoutClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${readinessKpiWithoutClients.length - 5})`}</button> : null}
          </>}
        </> : null}

        {panel.id === 'readiness' ? <>
           <div className="kpi-score-explanation"><div><span>CLIENTES OBSERVADOS</span><strong>{formatNumber(readinessDeduction?.observedCount ?? readinessObservedClients.length)}</strong></div><div><span>ENTRAM NO SCORE</span><strong>{readinessDeduction?.mode === 'source_gap' ? '1 fonte' : formatNumber(readinessDeduction?.penalizedCount ?? readinessClients.length)}</strong></div><div><span>PROTEGIDOS</span><strong>{formatNumber(readinessDeduction?.protectedCount || 0)}</strong></div><div><span>DESCONTO NO PLACAR</span><strong>-{formatNumber(readinessDeduction?.points || 0)} pts</strong></div></div>
           <div className="readiness-quality-callout"><div><span>QUALIDADE DA FONTE</span><strong>{readinessQualityLabel}</strong></div><div><span>CAMPO MONDAY</span><strong>{readinessQuality?.columnId || 'nÃ£o informado'}</strong></div><div><span>COBERTURA OBSERVADA</span><strong>{formatPct(readinessQuality?.coveragePct)} Â· {formatNumber(readinessQuality?.populatedClients)} preenchidos de {formatNumber(readinessQuality?.eligibleClients)}</strong></div></div>
           <div className="investigation-callout"><span>REGRA APLICADA</span><p>{readinessDeduction?.mode === 'source_gap' ? 'A cobertura estÃ¡ zerada para esta fonte. O Nexus aplica uma Ãºnica missÃ£o sistÃªmica, mesmo que todos os clientes apareÃ§am afetados, para nÃ£o retirar pontos repetidamente pelo mesmo problema estrutural.' : `${readinessDeduction?.observedCount ?? readinessObservedClients.length} clientes foram encontrados sem o campo; ${readinessDeduction?.penalizedCount ?? readinessClients.length} entram no score. ${readinessDeduction?.protectedCount || 0} ficam protegidos por ${readinessDeduction?.explanation || 'regra de nÃ£o duplicaÃ§Ã£o.'}`}</p></div>
           <div className="kpi-investigation-section-title">CLIENTES OBSERVADOS SEM O CAMPO Â· {readinessObservedClients.length}</div>
           <div className="kpi-client-grid">{visibleReadinessObservedClients.map(client => { const isPenalized = readinessClients.includes(client); const protectedClient = readinessProtectedClients.find(item => item.client === client); return <div className="kpi-client-card" key={`observed-${client}`}><strong>{client}</strong><div className="kpi-evidence-card-meta"><span>{readinessDeduction?.kind === 'planning' ? 'Planejamento nÃ£o identificado' : 'Dashboard/calendÃ¡rio nÃ£o preenchido ou desatualizado'}</span><b className="evidence-penalty-note">{isPenalized ? `ENTRA NO SCORE Â· -${formatNumber(readinessDeduction?.pointsPerItem || 0)} pts` : `PROTEGIDO Â· ${protectedClient?.reason || 'regra de nÃ£o duplicaÃ§Ã£o'}`}</b></div></div>; })}</div>
           {readinessObservedClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${readinessObservedClients.length - 5})`}</button> : null}
        </> : null}

        {panel.id === 'health' ? <>
          <div className="kpi-score-explanation"><div><span>SCORE BRUTO ATUAL</span><strong>{formatPoints(score)}</strong></div><div><span>PONTOS RECUPERÃVEIS</span><strong>{formatPoints(snapshot?.portfolioStability?.recoveryPointsAvailable || 0)}</strong></div></div>
          <div className="investigation-callout"><span>COMO O PLACAR FOI COMPOSTO</span><p>{scoreComposition(snapshot)}</p></div>
          <div className="kpi-factor-grid"><div><strong>-{formatNumber(delayedInternal * 2)} pts</strong><span>{formatNumber(delayedInternal)} itens de ProduÃ§Ã£o de ConteÃºdo Ã— -2 pts Â· prazo interno</span></div><div><strong>-{formatNumber(delayedPublication * 5)} pts</strong><span>{formatNumber(delayedPublication)} itens de ProduÃ§Ã£o de ConteÃºdo Ã— -5 pts Â· veiculaÃ§Ã£o</span></div><div><strong>-{formatNumber(stalled * 5)} pts</strong><span>{formatNumber(stalled)} clientes sem item em ProduÃ§Ã£o de ConteÃºdo e sem SolicitaÃ§Ã£o de Demanda Ã— -5 pts</span></div><div><strong>-{formatNumber(delayedDemands * 2)} pts</strong><span>{formatNumber(delayedDemands)} SolicitaÃ§Ãµes de Demandas vencidas Ã— -2 pts</span></div>{(readiness.scoreDeductions || []).map(deduction => <div key={deduction.id}><strong>-{formatNumber(deduction.points)} pts</strong><span>{deduction.mode === 'source_gap' ? `${formatNumber(deduction.observedCount ?? deduction.count)} observados Â· 1 penalizaÃ§Ã£o sistÃªmica` : `${formatNumber(deduction.observedCount ?? deduction.count)} observados Â· ${formatNumber(deduction.penalizedCount ?? deduction.count)} penalizados Â· ${formatNumber(deduction.protectedCount || 0)} protegidos`}</span></div>)}</div>
          <div className="source-relation-callout"><div className="source-relation-heading"><span>RELAÃ‡ÃƒO ENTRE FONTES</span><strong>{formatNumber(sourceRelation.counts?.overlapClients || 0)} clientes com itens nas duas fontes</strong></div><p>{sourceRelation.note}</p><div className="source-relation-grid"><div><strong>{formatNumber(sourceRelation.counts?.productionOpenClients || 0)}</strong><span>clientes com ProduÃ§Ã£o de ConteÃºdo aberta</span></div><div><strong>{formatNumber(sourceRelation.counts?.demandOpenClients || 0)}</strong><span>clientes com SolicitaÃ§Ãµes abertas</span></div><div><strong>{formatNumber(sourceRelation.counts?.productionOnlyClients || 0)}</strong><span>somente ProduÃ§Ã£o</span></div><div><strong>{formatNumber(sourceRelation.counts?.demandOnlyClients || 0)}</strong><span>somente SolicitaÃ§Ãµes</span></div></div>{sourceRelation.overlapDetails?.length ? <><div className="kpi-investigation-section-title">POSSÃVEL SOBREPOSIÃ‡ÃƒO Â· {sourceRelation.overlapDetails.length} CLIENTES</div><div className="source-relation-list">{sourceRelation.overlapDetails.slice(0, showAll ? sourceRelation.overlapDetails.length : 5).map(item => <div className="source-relation-item" key={item.client}><strong>{item.client}</strong><span>ProduÃ§Ã£o: {formatNumber(item.productionOpen)} abertos Â· {formatNumber(item.productionDelayed)} atrasados Â· Demandas: {formatNumber(item.demandOpen)} abertas Â· {formatNumber(item.demandDelayed)} vencidas</span></div>)}</div>{sourceRelation.overlapDetails.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${sourceRelation.overlapDetails.length - 5})`}</button> : null}</> : null}</div>
          <p className="investigation-footnote">Este proxy nÃ£o mede receita, satisfaÃ§Ã£o ou produtividade individual. Ele sinaliza que a pressÃ£o operacional ultrapassou o limite da escala atual.</p>
        </> : null}

        {panel.id === 'active' ? <>
          <div className="kpi-factor-grid"><div><strong>{formatNumber(quantitative.activeItems)}</strong><span>ITENS ATIVOS</span></div><div><strong>{formatPct(quantitative.activePct)}</strong><span>DA BASE HISTÃ“RICA</span></div><div><strong>{formatNumber(quantitative.completedItems)}</strong><span>CONCLUÃDOS FORA DO RECORTE</span></div></div>
          <div className="kpi-investigation-section-title">STATUS DO MONDAY Â· CLIQUE PARA INVESTIGAR</div><div className="kpi-status-grid">{statusRows.map(([status, count]) => { const color = statusColorFor(status, quantitative.statusColors); const selected = selectedStatus === status; return <button type="button" className={`kpi-status-grid-item${selected ? ' selected' : ''}`} key={status} aria-pressed={selected} onClick={() => setPanel({ ...panel, statusFilter: selected ? '' : status })}><span className="status-dot" style={{ backgroundColor: color, boxShadow: `0 0 7px ${color}` }} /><span>{status}</span><strong>{formatNumber(count)}</strong><small>{formatPct((count / (quantitative.activeItems || 1)) * 100)}</small><em>ABRIR â†—</em></button>; })}</div>
          {selectedStatus ? <>
            <div className="kpi-investigation-section-title">ITENS COM STATUS Â· {selectedStatus} Â· {statusItems.length}</div>
            <div className="kpi-status-source-note">Fonte: <strong>ProduÃ§Ã£o de ConteÃºdo Â· Monday.com</strong> Â· {statusItems.length} itens ativos com este status. Itens Finalizado, Publicado e Cancelado ficam fora do recorte.</div>
            <ul className="kpi-status-item-list">
              {visibleStatusItems.map((item, index) => { const color = statusColorFor(item.status, quantitative.statusColors); return <li className="kpi-status-item-card" key={item.id || `${item.name}-${index}`}><div className="kpi-status-item-head"><strong>{item.name}</strong><span className="monday-status-badge" style={{ color, borderColor: color }}>{item.status}</span></div><div className="kpi-status-item-meta"><span>{item.client || 'Sem cliente'}</span><span>{item.stage || 'Etapa nÃ£o informada'}</span><span className="people-field"><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="ResponsÃ¡vel" /></span></div><div className="kpi-status-item-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>VeiculaÃ§Ã£o: {formatDate(item.veiculacao)}</span></div><a className="investigation-evidence-link" href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer">Abrir no Monday â†—</a></li>; })}
            </ul>
            {statusItems.length === 0 ? <div className="investigation-callout"><span>Itens nÃ£o disponÃ­veis nesta leitura</span><p>O status foi recebido no agregado, mas os detalhes ainda nÃ£o chegaram no snapshot. Use Atualizar dados para reconsultar o Monday.</p></div> : null}
            {statusItems.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${statusItems.length - 5})`}</button> : null}
          </> : null}
          <div className="kpi-investigation-section-title">ETAPAS EXECUTIVAS</div><div className="kpi-status-grid">{stageRows.map(([stage, count]) => <div key={stage}><span className="status-dot" style={{ backgroundColor: 'var(--vybe-cyan)' }} /><span>{canonicalStage(stage)}</span><strong>{formatNumber(count)}</strong><small>{formatPct((count / (quantitative.activeItems || 1)) * 100)}</small></div>)}</div>
        </> : null}

        {panel.id === 'delays' ? evidenceList(visibleInternal, 'ITENS DE PRODUÃ‡ÃƒO DE CONTEÃšDO Â· PRAZO INTERNO', internalDelays.length, internalDelays) : null}
        {panel.id === 'publication' ? evidenceList(visiblePublication, 'ITENS DE PRODUÃ‡ÃƒO DE CONTEÃšDO Â· VEICULAÃ‡ÃƒO VENCIDA', publicationDelays.length, publicationDelays) : null}
        {panel.id === 'health' ? evidenceList(visibleDelays, 'EVIDÃŠNCIAS QUE PENALIZAM O SCORE', delays.length, delays) : null}

        {panel.id === 'exposure' ? <>
          <div className="kpi-investigation-section-title">Clientes expostos Â· {exposedClients.length}</div><div className="kpi-client-grid">{visibleClients.map(client => <div className="kpi-client-card" key={client.client}><div className="kpi-evidence-card-head"><strong>{client.client}</strong><span className={`risk-pct ${riskTone(client.riskPct)}`}>{formatPct(client.riskPct)}</span></div><div className="risk-bar-track"><span style={{ width: `${clampPct(client.riskPct)}%` }} /></div><div className="kpi-evidence-card-meta"><span>{client.delayedItems} atrasos / {client.openItems} abertos</span><span>{client.internalDelays} internos Â· {client.publicationDelays} veiculaÃ§Ã£o</span></div><button type="button" className="kpi-inline-action" onClick={() => { setPanel({ type: 'client', id: client.client, title: `EvidÃªncias: ${client.client}` }); }}>Abrir causa â†—</button></div>)}</div>{exposedClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `Ver mais (${exposedClients.length - 5})`}</button> : null}</> : null}

        {panel.id === 'execution' ? <>
          <div className="kpi-investigation-section-title">CLIENTES SEM EXECUÃ‡ÃƒO Â· {execution.stalled?.length || 0}</div><div className="kpi-client-grid">{(execution.stalled || []).map(client => <div className="kpi-client-card" key={client.client}><strong>{client.client}</strong><div className="kpi-evidence-card-meta"><span>{client.daysSinceEntry === null ? 'Tempo na carteira nÃ£o informado' : `${client.daysSinceEntry} dias na carteira`}</span><span>Sem conteÃºdo em produÃ§Ã£o</span><span>Sem demanda aberta</span></div><button type="button" className="kpi-inline-action" onClick={() => setPanel({ type: 'client', id: client.client, title: `VisÃ£o: ${client.client}` })}>ABRIR CONTEXTO â†—</button></div>)}</div><div className="investigation-callout"><span>ONBOARDING SEPARADO</span><p>{(execution.onboarding || []).length} cliente(s) ainda estÃ£o na janela de implantaÃ§Ã£o de {execution.onboardingWindowDays} dias e nÃ£o entram no indicador de cliente parado.</p></div></> : null}

        {!String(panel.id || '').startsWith('readiness') && panel.id !== 'health' && panel.id !== 'active' && panel.id !== 'delays' && panel.id !== 'publication' && panel.id !== 'exposure' && panel.id !== 'execution' ? evidenceList(visibleDelays, 'EVIDÃŠNCIAS', delays.length, delays) : null}
      </div>
    </aside>
  </div>;
}

// --- ESTAÃ‡Ã•ES DE TRABALHO ---

function JarvisCopilot({ message, nextCommand }) {
  return (
    <section className="jarvis-copilot" aria-live="polite">
      <div className="jarvis-copilot-presence">
        <div className="jarvis-mini-orb" aria-hidden="true"><Target size={21} /></div>
        <div><strong>JARVIS</strong><span>Ativo Â· guiando</span></div>
      </div>
      <div className="jarvis-copilot-speech">
        <div className="jarvis-copilot-label"><span /> JARVIS Â· agora</div>
        <p>{message.text}</p>
        <small>{message.hint}</small>
      </div>
      <div className="jarvis-copilot-next"><span>PrÃ³ximo comando</span><strong>{nextCommand}</strong></div>
    </section>
  );
}

function ExecutiveViewNav({ activeView, onChange, snapshot }) {
  const tabs = [
    { id: 'summary', label: 'Resumo executivo', detail: 'decisÃ£o e risco' },
    { id: 'portfolio', label: 'Carteira', detail: `${formatNumber(snapshot?.quantitative?.activeItems || 0)} itens ativos` },
    { id: 'demands', label: 'Demandas', detail: `${formatNumber(snapshot?.demandItems?.length || 0)} solicitaÃ§Ãµes` },
    { id: 'team', label: 'Time & performance', detail: 'capacidade observÃ¡vel' }
  ];
  return <nav className="executive-view-nav" aria-label="Contextos executivos">
    {tabs.map(tab => <button type="button" key={tab.id} className={`executive-view-tab ${activeView === tab.id ? 'active' : ''}`} aria-selected={activeView === tab.id} onClick={() => onChange(tab.id)}><strong>{tab.label}</strong><span>{tab.detail}</span></button>)}
  </nav>;
}

function ManagerStation({ snapshot, history, timeSeries, intelligence, onExit, onOpenAnalyst, onRefresh, refreshing, refreshError, onOpenZen }) {
  const [detailPanel, setDetailPanel] = useState(null);
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [showAllClients, setShowAllClients] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [activeView, setActiveView] = useState(() => new URLSearchParams(window.location.search).has('analytics') ? 'analytics' : 'summary');
  const [jarvisMessage, setJarvisMessage] = useState({
    text: 'Estou com vocÃª. A leitura estÃ¡ organizada e vou conduzir o prÃ³ximo ponto que merece decisÃ£o.',
    hint: 'Selecione qualquer evidÃªncia; eu explico por que ela importa.'
  });

  const delayDetails = snapshot.delayDetails || [];
  
  // ConcentraÃ§Ã£o de atrasos por responsÃ¡vel; nÃ£o Ã© ranking de produtividade.
  // Cruzando productivity top responsibles e filtrando apenas atrasos internos
  const internalDelays = delayDetails.filter(d => d.delayType?.includes('prazo interno'));
  const blameMap = {};
  internalDelays.forEach(d => {
    // `responsavel` vem do Monday como lista separada por vÃ­rgula.
    splitOwners(d.responsavel).forEach(name => {
      blameMap[name] ||= { count: 0, publication: 0, people: [], details: [] };
      const person = (d.responsavelPeople || []).find(candidate => candidate.name === name);
      if (person && !blameMap[name].people.some(candidate => candidate.id === person.id)) blameMap[name].people.push(person);
      blameMap[name].count += 1;
      blameMap[name].details.push(d);
      if (d.delayType?.includes('veiculaÃ§Ã£o')) blameMap[name].publication += 1;
    });
  });
  const topBlame = Object.entries(blameMap)
    .map(([name, values]) => {
      const maxDays = Math.max(...values.details.map(item => Number(item.daysOverdue) || 0), 0);
      return { id: name, name, people: values.people, ...values, maxDays, urgency: ownerUrgency(maxDays) };
    })
    .sort((a, b) => b.maxDays - a.maxDays || Number(b.publication || 0) - Number(a.publication || 0) || b.count - a.count);

  // Logic 2: Piores Clientes (maior % de itens atrasados sobre itens abertos)
  const clientRanking = snapshot.clientRanking || [];
  const worstClients = clientRanking
    .filter(c => (c.riskPct || 0) > 0)
    .sort((a, b) => (b.riskPct || 0) - (a.riskPct || 0));

  // Clientes ativos sem nada em execuÃ§Ã£o â€” sinal de previsibilidade da carteira.
  const execution = snapshot.portfolioExecution || {};
  const stalledClients = execution.stalled || [];
  const onboardingClients = execution.onboarding || [];
  const calendarSignals = snapshot.calendarSignals || {};
  const calendarRiskCount = calendarSignals.riskClientsWithoutMeeting?.length || 0;
  const nextCommand = stalledClients.length > 0
    ? 'ComeÃ§ar pelos clientes ativos sem execuÃ§Ã£o.'
    : internalDelays.length > 0
      ? 'Investigar a concentraÃ§Ã£o de atrasos antes de assumir mais produÃ§Ã£o.'
      : calendarRiskCount > 0
        ? 'Verificar clientes em risco sem reuniÃ£o futura.'
        : worstClients.length > 0
          ? 'Abrir as evidÃªncias dos clientes com maior exposiÃ§Ã£o.'
          : 'A carteira nÃ£o apresenta um comando crÃ­tico nesta leitura.';
  const initialJarvisMessage = stalledClients.length > 0
    ? { text: `Encontrei ${stalledClients.length} cliente(s) ativo(s) sem conteÃºdo em produÃ§Ã£o ou demanda aberta. Esse Ã© o primeiro ponto que eu investigaria com vocÃª.`, hint: 'O risco aqui Ã© de previsibilidade: vamos confirmar o contexto antes de concluir qualquer coisa.' }
    : internalDelays.length > 0
      ? { text: `A carteira tem ${internalDelays.length} atraso(s) interno(s) concentrado(s) em ${topBlame.length || 1} responsÃ¡vel(is). Vou separar causa de volume para orientar a decisÃ£o.`, hint: calendarRiskCount > 0 ? `TambÃ©m hÃ¡ ${calendarRiskCount} cliente(s) em risco sem reuniÃ£o futura.` : 'Selecione um responsÃ¡vel ou cliente e eu abro a leitura completa.' }
      : calendarRiskCount > 0
        ? { text: `Encontrei ${calendarRiskCount} cliente(s) com risco operacional e nenhuma reuniÃ£o futura identificada na agenda.`, hint: 'A reuniÃ£o certa pode transformar um risco silencioso em decisÃ£o de recuperaÃ§Ã£o.' }
        : worstClients.length > 0
          ? { text: `${worstClients[0].client} aparece com ${worstClients[0].riskPct}% de exposiÃ§Ã£o no recorte. Vou comeÃ§ar pela evidÃªncia antes de recomendar qualquer intervenÃ§Ã£o.`, hint: 'A decisÃ£o vem depois da causa; primeiro vamos entender o sinal.' }
          : { text: 'A leitura estÃ¡ organizada. NÃ£o encontrei um risco dominante, entÃ£o vou acompanhar os sinais que podem mudar a decisÃ£o.', hint: 'Selecione uma evidÃªncia para investigar qualquer variaÃ§Ã£o com contexto.' };
  const activeJarvisMessage = jarvisMessage || initialJarvisMessage;

  return (
    <div className="animate-fade" style={{ minHeight: '100vh' }}>
      <ExecutiveDashboardShell onOpenZen={onOpenZen}
        activeView={activeView}
        onChange={setActiveView}
        snapshot={snapshot}
        onExit={onExit}
        onOpenAnalyst={onOpenAnalyst}
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshError={refreshError}
      >
        <JarvisCopilot message={activeJarvisMessage} nextCommand={nextCommand} />

      {activeView === 'summary' ? <ExecutiveCommandCenter
        snapshot={snapshot}
        timeSeries={timeSeries}
        intelligence={intelligence}
        onOpenAnalyst={onOpenAnalyst}
        onOpenHistory={() => setActiveView('history')}
        onSelect={(id, readinessId) => {
          if (id.startsWith('owner:')) return setDetailPanel({ type: 'owner', id: id.replace(/^owner:/, ''), title: `Gargalos: ${id.replace(/^owner:/, '')}` });
          if (id.startsWith('client:')) return setDetailPanel({ type: 'client', id: id.replace(/^client:/, ''), title: `InvestigaÃ§Ã£o: ${id.replace(/^client:/, '')}` });
          if (id.startsWith('item:')) return setDetailPanel({ type: 'analytics', targetType: 'item', itemId: id.replace(/^item:/, ''), title: `Item alterado: ${id.replace(/^item:/, '')}` });
          setDetailPanel({ type: 'kpi', id, readinessId, title: id === 'readiness' ? `ProntidÃ£o: ${readinessId}` : `KPI: ${id}` });
        }}
      /> : null}

      {activeView === 'portfolio' ? <>
        <ReadinessKpiBand snapshot={snapshot} onSelect={(id) => setDetailPanel({ type: 'kpi', id, title: `KPI: ${id}` })} />
        <ExecutivePulseBars snapshot={snapshot} />
        <MissionBoard snapshot={snapshot} onSelect={(id, readinessId) => setDetailPanel({ type: 'kpi', id, readinessId, title: id === 'readiness' ? `ProntidÃ£o: ${readinessId}` : `KPI: ${id}` })} />
        <ExecutiveOperationsExplorer snapshot={snapshot} source="production" onOpenItem={(item) => setDetailPanel({ type: 'analytics', targetType: 'item', itemId: item.id, title: `Item: ${item.name}` })} onOpenClient={(client) => setDetailPanel({ type: 'entity', kind: 'client', id: client, title: client })} getItemUrl={item => mondayItemUrl(item.id)} />
        <ExecutiveSourceReconciliation snapshot={snapshot} onOpenClient={(client) => setDetailPanel({ type: 'entity', kind: 'client', id: client, title: client })} />
      </> : null}

      {activeView === 'demands' ? <>
        <ExecutiveDemandPanel snapshot={snapshot} onSelectClient={(client) => setDetailPanel({ type: 'entity', kind: 'client', id: client, title: client })} />
        <ExecutiveOperationsExplorer snapshot={snapshot} source="demands" onOpenItem={(item) => setDetailPanel({ type: 'analytics', targetType: 'item', itemId: item.id, title: `SolicitaÃ§Ã£o: ${item.name}` })} onOpenClient={(client) => setDetailPanel({ type: 'entity', kind: 'client', id: client, title: client })} getItemUrl={item => item.id ? `https://gestaovybes-team.monday.com/boards/8385559107/pulses/${item.id}` : null} />
      </> : null}
      {activeView === 'team' ? <ExecutivePerformancePanel snapshot={snapshot} onOpenOwner={(owner) => setDetailPanel({ type: 'entity', kind: 'owner', id: owner, title: owner })} onOpenStage={(stage) => setDetailPanel({ type: 'entity', kind: 'stage', id: stage, title: stage })} onOpenHistory={() => setActiveView('history')} /> : null}
      {activeView === 'history' ? <ExecutiveHistoryCenter
        snapshot={snapshot}
        history={history}
        timeSeries={timeSeries}
        intelligence={intelligence}
        onOpenAnalyst={onOpenAnalyst}
      /> : null}

      {activeView === 'analytics' ? <ExecutiveAnalyticsCenter
        snapshot={snapshot}
        history={history}
        timeSeries={timeSeries}
        onSelect={(selection) => {
          setDetailPanel({ ...selection, type: 'analytics', targetType: selection.type });
          setJarvisMessage({ text: `Abrindo ${selection.title || 'esta leitura'} com os dados observÃ¡veis disponÃ­veis.`, hint: 'O painel analÃ­tico mantÃ©m a evidÃªncia, a fonte e o link para investigaÃ§Ã£o.' });
        }}
        onOpenAnalyst={onOpenAnalyst}
        onOpenHistory={() => setActiveView('history')}
      /> : null}

      {activeView === 'portfolio' ? <div className="executive-visual-grid">
        <StatusComposition snapshot={snapshot} />
        <StageDistribution snapshot={snapshot} />
        <OwnerBars
          owners={topBlame}
          totalDelays={internalDelays.length}
          statusColors={snapshot?.quantitative?.statusColors}
          selectedOwnerId={selectedOwnerId}
          onSelect={(person) => {
            setSelectedOwnerId(person.id);
            setJarvisMessage({ text: `${person.name} estÃ¡ selecionado com ${person.count} atraso(s) associado(s). O hover mostra as cinco demandas prioritÃ¡rias; abra todas apenas pelo botÃ£o explÃ­cito.`, hint: 'SeleÃ§Ã£o fixada. A abertura completa fica no botÃ£o ABRIR ENTREGAS.' });
          }}
          onOpen={(person) => {
            setDetailPanel({ type: 'owner', id: person.id, title: `Gargalos: ${person.name}` });
            setJarvisMessage({ text: `Abrindo todas as ${person.count} entregas de ${person.name}. A investigaÃ§Ã£o vai separar causa, cliente, etapa e urgÃªncia.`, hint: 'O painel central reÃºne a lista completa e os links para o Monday.' });
          }}
        />
        <RiskBars
          clients={worstClients}
          showAll={showAllClients}
          onToggle={() => setShowAllClients(value => !value)}
          onSelect={(client) => {
            setDetailPanel({ type: 'client', id: client.client, title: `EvidÃªncias: ${client.client}` });
            setJarvisMessage({ text: `${client.client} tem ${client.riskPct}% de exposiÃ§Ã£o no recorte (${client.delayedItems} de ${client.openItems} itens). Vou abrir a evidÃªncia antes de sugerir qualquer decisÃ£o.`, hint: 'PrÃ³ximo: entender se o risco Ã© interno, de veiculaÃ§Ã£o ou de contexto.' });
          }}
        />
      </div> : null}

        <AnalyticsDrilldownDrawer panel={detailPanel} setPanel={setDetailPanel} snapshot={snapshot} />
        <DetailDrawer panel={detailPanel} setPanel={setDetailPanel} delayDetails={delayDetails} snapshot={snapshot} />
        <KpiInvestigationDrawer panel={detailPanel} setPanel={setDetailPanel} snapshot={snapshot} />
        <ExecutiveEntityProfileDrawer panel={detailPanel} setPanel={setDetailPanel} snapshot={snapshot} />
      </ExecutiveDashboardShell>
    </div>
  );
}


const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

function JarvisHome({ snapshot, onOpenJarvis, onOpenAnalyst }) {
  const stability = Number.isFinite(snapshot?.portfolioStability?.score) ? snapshot.portfolioStability.score : null;
  const overdue = snapshot?.quantitative?.overdueInternal ?? 0;
  const stalled = snapshot?.portfolioExecution?.stalled?.length ?? 0;
  const clientRisks = snapshot?.clientRanking?.filter(item => (item.delayedItems || 0) > 0).length ?? 0;
  const calendarRiskCount = snapshot?.calendarSignals?.riskClientsWithoutMeeting?.length ?? 0;
  const decisions = snapshot?.summary?.decisionsNeeded ?? 0;
  const firstPriority = stalled > 0
    ? `${stalled} cliente(s) ativo(s) estÃ£o sem conteÃºdo em produÃ§Ã£o ou demanda aberta.`
    : overdue > 0
      ? `${overdue} atraso(s) interno(s) pedem investigaÃ§Ã£o antes de adicionar mais pressÃ£o Ã  produÃ§Ã£o.`
      : calendarRiskCount > 0
        ? `${calendarRiskCount} cliente(s) em risco nÃ£o tÃªm reuniÃ£o futura identificada na agenda.`
        : clientRisks > 0
          ? `${clientRisks} cliente(s) apresentam sinais de previsibilidade que merecem acompanhamento.`
          : 'A carteira nÃ£o apresenta um sinal crÃ­tico dominante nesta leitura.';
  const priorityClass = stability === null ? 'attention' : stability < 50 ? 'critical' : stability < 75 ? 'attention' : 'stable';

  return (
    <div className="jarvis-clean-home splash-container animate-fade">
      <div className="jarvis-clean-top"><span><Target size={14} /> VYBE NEXUS</span><span>JARVIS Â· ONLINE</span></div>
      <main className="jarvis-clean-main" aria-live="polite">
        <section className="jarvis-clean-presence" aria-label="PresenÃ§a do JARVIS">
          <div className="jarvis-orb" aria-hidden="true">
            <div className="jarvis-orb-core"><Target size={34} /></div>
            <i className="jarvis-orb-ring ring-one" /><i className="jarvis-orb-ring ring-two" /><i className="jarvis-orb-ring ring-three" />
          </div>
          <div className="jarvis-presence-status"><span className="jarvis-live-dot" /> Falando com a lideranÃ§a</div>
          <div className="jarvis-voice-wave" aria-hidden="true">{[1,2,3,4,5,6,7,8].map(bar => <i key={bar} />)}</div>
        </section>

        <section className="jarvis-clean-conversation">
          <div className="jarvis-clean-kicker">JARVIS <span>Â·</span> leitura executiva</div>
          <h1>{getGreeting()}, lideranÃ§a.</h1>
          <p className="jarvis-clean-lead">JÃ¡ li a carteira. Encontrei um ponto para comeÃ§armos.</p>
          <div className={`jarvis-clean-insight ${priorityClass}`}>
            <span>AtenÃ§Ã£o agora</span>
            <strong>{firstPriority}</strong>
          </div>
          <p className="jarvis-clean-explanation">Vou mostrar a evidÃªncia e conduzir a prÃ³xima decisÃ£o. Nada serÃ¡ alterado no Monday.</p>
          <div className="jarvis-clean-question">Quer que eu conduza?</div>
          <div className="jarvis-clean-actions">
            <button type="button" className="jarvis-clean-primary" onClick={onOpenJarvis}><Target size={17} /> Continuar com o JARVIS</button>
            <button type="button" className="jarvis-clean-analyst" onClick={onOpenAnalyst}><Activity size={15} /> Explorar no Analista <span>investigaÃ§Ã£o profunda</span></button>
          </div>
          <div className="jarvis-clean-context"><span>{overdue} atrasos internos</span><i /> <span>{clientRisks} clientes expostos</span><i /> <span>{stalled > 0 ? stalled : decisions} prÃ³ximo(s) comando(s)</span></div>
          <div className="jarvis-clean-boundary"><Info size={13} /> JARVIS conduz. Analista investiga. Vybe Painel executa.</div>
        </section>
      </main>
    </div>
  );
}

function JarvisWakeScreen({ stage }) {
  const stages = [
    { label: 'Acordando o nÃºcleo', detail: 'Inicializando presenÃ§a executiva.' },
    { label: 'Lendo a carteira', detail: 'Conectando Monday.com, Vybe Painel e agenda.' },
    { label: 'Cruzando os sinais', detail: 'Separando ruÃ­do de decisÃ£o.' },
    { label: 'JARVIS online', detail: `${getGreeting()}, lideranÃ§a. Estou pronto.` }
  ];
  const current = stages[Math.min(stage, stages.length - 1)];
  const progress = `${Math.min(100, 18 + stage * 27)}%`;

  return (
    <div className="jarvis-wake-screen" aria-live="polite">
      <div className="jarvis-wake-grid" />
      <div className="jarvis-wake-brand"><Target size={15} /> Vybe Nexus <span>Â· leitura executiva</span></div>
      <main className="jarvis-wake-core">
        <div className="jarvis-wake-orb" aria-hidden="true">
          <div className="jarvis-wake-orb-core"><Target size={42} /></div>
          <i className="jarvis-wake-ring wake-ring-one" /><i className="jarvis-wake-ring wake-ring-two" /><i className="jarvis-wake-ring wake-ring-three" />
        </div>
        <div className="jarvis-wake-status"><span className="jarvis-live-dot" /> JARVIS {stage >= 3 ? 'online' : 'despertando'}</div>
        <div className="jarvis-wake-kicker">{current.label}</div>
        <h1>{stage >= 3 ? `${getGreeting()}, lideranÃ§a.` : 'Despertando.'}</h1>
        <p>{current.detail}</p>
        <div className="jarvis-wake-progress"><span style={{ width: progress }} /></div>
        <div className="jarvis-wake-log"><span className={stage >= 0 ? 'done' : ''}>NÃºcleo de presenÃ§a</span><span className={stage >= 1 ? 'done' : ''}>Fontes executivas</span><span className={stage >= 2 ? 'done' : ''}>Leitura de contexto</span></div>
      </main>
      <div className="jarvis-wake-footer">Uma lideranÃ§a Â· um comando Â· uma leitura</div>
    </div>
  );
}

// --- MAIN APP ---

class RuntimeErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[NEXUS_RUNTIME_ERROR]', error, info?.componentStack || '');
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error?.message || 'Falha inesperada na interface.';
    return (
      <div className="runtime-error-screen" role="alert">
        <div className="runtime-error-panel">
          <ShieldAlert size={42} color="var(--vybe-red)" aria-hidden="true" />
          <span className="runtime-error-kicker">Vybe Nexus Â· recuperaÃ§Ã£o</span>
          <h1>O JARVIS precisa reiniciar esta leitura</h1>
          <p>Uma interaÃ§Ã£o encontrou um erro inesperado. Os dados do Monday nÃ£o foram alterados.</p>
          <code>{message}</code>
          <button type="button" onClick={this.handleReload}>RECARREGAR LEITURA</button>
        </div>
      </div>
    );
  }
}

function App() {
  const [appMode, setAppMode] = useState('wake'); // wake -> manager by default; analyst is an explicit exit
  const [wakeStage, setWakeStage] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const mirrorVersionRef = useRef(0);
  const metricsRequestRef = useRef(null);
  const metricsRequestSequenceRef = useRef(0);
  const mirrorPollInFlightRef = useRef(false);

  const loadMetrics = async ({ manual = false, background = false } = {}) => {
    const currentRequest = metricsRequestRef.current;
    if (currentRequest) {
      if (manual && currentRequest.kind === 'background') currentRequest.controller.abort();
      else return;
    }
    const requestId = ++metricsRequestSequenceRef.current;
    const controller = new AbortController();
    metricsRequestRef.current = { controller, kind: manual ? 'manual' : background ? 'background' : 'initial' };
    if (manual || background) {
      setRefreshing(true);
      if (manual) setRefreshError('');
    } else {
      setLoading(true);
      setError('');
    }

    try {
      // A leitura normal preserva o cache curto da CDN para nÃ£o multiplicar
      // consultas ao Monday. A atualizaÃ§Ã£o manual usa uma chave de revalidaÃ§Ã£o
      // e recebe no-store no servidor para buscar o estado atual das fontes.
      const refreshQuery = manual || background ? `?refresh=1&t=${Date.now()}` : '';
      const metricsRes = await fetch(`/api/dashboard/metrics${refreshQuery}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal
      });
      const metricsData = await metricsRes.json().catch(() => ({}));

      if (!metricsRes.ok || !metricsData.success) {
        throw new Error(`Command Center: ${metricsData.error || 'nÃ£o foi possÃ­vel carregar as mÃ©tricas.'}`);
      }

      if (requestId !== metricsRequestSequenceRef.current) return;
      const nextSnapshot = metricsData.metrics.executiveSnapshot;
      const nextMirrorVersion = Number(metricsData.meta?.sync?.version || nextSnapshot?.sourceQuality?.sync?.version || 0);
      if (nextMirrorVersion > 0) mirrorVersionRef.current = nextMirrorVersion;
      setMetrics({ executiveSnapshot: nextSnapshot, history: metricsData.meta?.history || null, timeSeries: metricsData.meta?.timeSeries || null, intelligence: metricsData.meta?.intelligence || null });
    } catch (err) {
      if (err.name === 'AbortError') return;
      const message = err.message || 'Falha catastrÃ³fica de comunicaÃ§Ã£o com o Monday.com.';
      if (manual || background) setRefreshError(message);
      else setError(message);
    } finally {
      if (metricsRequestRef.current?.controller === controller) {
        metricsRequestRef.current = null;
        if (manual || background) setRefreshing(false);
        else setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    if (loading || !metrics) return undefined;
    const pollMirrorVersion = async () => {
      if (document.visibilityState === 'hidden' || mirrorPollInFlightRef.current) return;
      mirrorPollInFlightRef.current = true;
      try {
        const response = await fetch('/api/executive/operational-mirror?wait=0', { cache: 'no-store', headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Espelho operacional indisponÃ­vel.');
        const nextVersion = Number(payload.version || 0);
        const previousVersion = mirrorVersionRef.current;
        if (nextVersion > previousVersion) {
          mirrorVersionRef.current = nextVersion;
          await loadMetrics({ background: true });
        } else if (payload.sync?.state === 'unavailable' || payload.sync?.state === 'stale') {
          setRefreshError(payload.sync?.error || 'A confirmaÃ§Ã£o do espelho operacional estÃ¡ atrasada.');
        }
      } catch (pollError) {
        if (pollError.name !== 'AbortError') setRefreshError(pollError.message || 'NÃ£o foi possÃ­vel conferir o espelho operacional.');
      } finally {
        mirrorPollInFlightRef.current = false;
      }
    };
    void pollMirrorVersion();
    const timer = window.setInterval(pollMirrorVersion, 15000);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (loading || !metrics) return undefined;
    setWakeStage(0);
    const timers = [
      window.setTimeout(() => setWakeStage(1), 650),
      window.setTimeout(() => setWakeStage(2), 1300),
      window.setTimeout(() => setWakeStage(3), 1950),
      window.setTimeout(() => setAppMode('manager'), 2700)
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [loading, metrics]);

  if (loading) {
    return (
      <div className="vybe-os-grid">
        <div className="loading-wrapper">
          <Crosshair size={40} color="var(--vybe-orange)" className="animate-fade" style={{ marginBottom: '2rem', animation: 'pulseCore 2s infinite' }} />
          <div className="loading-text">ESTABELECENDO LINK COM MONDAY.COM</div>
          <div className="loading-bar"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vybe-os-grid runtime-error-screen">
        <div className="loading-wrapper runtime-error-panel">
          <ShieldAlert size={42} color="var(--vybe-red)" aria-hidden="true" />
          <h2>NÃ£o foi possÃ­vel atualizar a leitura</h2>
          <p>{error}</p>
          <button type="button" onClick={loadMetrics}>Tentar reconexÃ£o</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="vybe-os-grid"></div>

      {appMode === 'wake' && <JarvisWakeScreen stage={wakeStage} />}

      {appMode === 'manager' && <ManagerStation snapshot={metrics.executiveSnapshot} history={metrics.history} timeSeries={metrics.timeSeries} intelligence={metrics.intelligence} onExit={() => setAppMode('wake')} onOpenAnalyst={() => setAppMode('analyst')} onOpenZen={() => setAppMode('zen')} onRefresh={() => loadMetrics({ manual: true })} refreshing={refreshing} refreshError={refreshError} />}
      {appMode === 'zen' && (<Suspense fallback={<div className="loading-wrapper"><div className="loading-text">Carregando Zen Mode</div></div>}><ZenStation snapshot={metrics.executiveSnapshot} history={metrics.history} onExit={() => setAppMode('manager')} /></Suspense>)}      {appMode === 'analyst' && (
        <Suspense fallback={(
          <div className="loading-wrapper">
            <div className="loading-text">Carregando o modo Analista</div>
            <div className="loading-bar"></div>
          </div>
        )}>
          <AnalystStation snapshot={metrics.executiveSnapshot} history={metrics.history} onExit={() => setAppMode('manager')} />
        </Suspense>
      )}
    </>
  );
}

export default function NexusApp() {
  return (
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  );
}
