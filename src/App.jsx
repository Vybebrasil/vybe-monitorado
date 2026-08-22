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
import { ExecutiveDashboardShell } from './components/ExecutiveDashboardShell.jsx';
import { ExecutiveAnalyticsCenter } from './components/ExecutiveAnalyticsCenter.jsx';
import ExecutiveCommandCenter from './components/ExecutiveCommandCenter.jsx';
import { AnalyticsDrilldownDrawer } from './components/AnalyticsDrilldownDrawer.jsx';
import ExecutiveHistoryCenter from './components/ExecutiveHistoryCenter.jsx';

// Carregada sob demanda: só ela usa Recharts, que responde pela maior parte do bundle.
const AnalystStation = lazy(() => import('./stations/AnalystStation.jsx'));

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
  // O corte é do domínio (stable / attention / risk), não um número solto na UI.
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
          <span className="telemetry-label">SEM EXECUÇÃO</span>
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
    : 'horário indisponível';
  const boardLabels = [
    ['production', 'Produção de Conteúdo'],
    ['clients', 'Clientes'],
    ['demands', 'Solicitações de Demandas']
  ];
  const calendarSignals = snapshot?.calendarSignals;
  const calendarAvailable = calendarSignals?.quality?.status === 'ok';
  const derivedRecordCount = quality.records ?? snapshot?.quantitative?.activeItems ?? snapshot?.summary?.openItems ?? null;
  const recordLabel = quality.records === null || quality.records === undefined ? 'itens no recorte' : 'registros lidos';
  const displaySourceCount = value => Number.isFinite(Number(value)) && Number(value) > 0 ? formatNumber(value) : 'N/D';
  const displayBoard = (board, label) => {
    if (!board) return null;
    const status = board.complete ? 'OK' : board.derived ? 'metadado parcial' : 'incompleta';
    const pages = board.pages === null || board.pages === undefined ? 'páginas N/D' : `${formatNumber(board.pages)} pág.`;
    return <span key={label} className={board.complete ? 'source-board-ok' : 'source-board-warning'}><b>{label}</b> {displaySourceCount(board.count)} reg. · {pages} · {status}</span>;
  };

  const statusLabel = freshness === 'fallback'
    ? 'Leitura direta'
    : freshness === 'stale'
      ? 'Dados desatualizados'
      : complete
        ? 'Leitura completa'
        : 'Leitura parcial';
  const sourceLabel = quality.source || 'Monday.com';
  const syncLabel = sync?.version ? `versão ${sync.version}${sync.ageSeconds !== null && sync.ageSeconds !== undefined ? ` · ${sync.ageSeconds}s` : ''}` : null;
  const stableCycles = Number(sync?.versionMonitor?.pollsWithoutVersionChange) || 0;
  const monitorLabel = stableCycles >= 2 ? ` · estável há ${stableCycles} ciclos` : '';

  return (
    <div className={`source-freshness-strip ${complete ? 'complete' : 'partial'} ${freshness}`} aria-label="Qualidade e frescor das fontes">
      <div className="source-freshness-main">
        <span className="source-freshness-dot" />
        <strong>{statusLabel}</strong>
        <span>{sourceLabel} · capturado {capturedLabel}{syncLabel ? ` · ${syncLabel}` : ''}{monitorLabel}</span>
        <button type="button" className="manual-refresh-button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing} title="Buscar novamente os dados do Monday e da Agenda agora">
          <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Atualizando dados…' : freshness === 'stale' || freshness === 'fallback' ? 'Atualizar agora' : 'Atualizar dados'}
        </button>
        {refreshError ? <span className="manual-refresh-error" role="alert">Atualização falhou · {refreshError}</span> : null}
      </div>
      <div className="source-freshness-stats">
        <span><b>{displaySourceCount(derivedRecordCount)}</b> {recordLabel}</span>
        <span><b>{quality.pages === null || quality.pages === undefined ? 'N/D' : formatNumber(quality.pages)}</b> páginas confirmadas</span>
        {boardLabels.map(([key, label]) => displayBoard(boards[key], label))}
        {fieldCoverage && !fieldCoverage.complete ? <span className="source-board-warning"><b>Campos</b> faltando: {fieldCoverage.missing.join(', ')}</span> : null}
        {mixedConsistency ? <span className="source-board-warning" title={quality.consistency.note}><b>Coorte mista</b> Produção versionada · demais fontes diretas</span> : null}
        {calendarSignals ? <span className={calendarAvailable ? 'source-board-ok' : 'source-board-warning'}><b>Agenda</b> {calendarAvailable ? `${formatNumber(calendarSignals.next7Count)} em 7d · ${formatNumber(calendarSignals.riskClientsWithoutMeeting?.length)} riscos sem reunião` : 'indisponível'}</span> : null}
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
  const directionLabel = direction => direction === 'improving' ? 'melhorou' : direction === 'worsening' ? 'piorou' : 'estável';
  const directionClass = direction => direction === 'improving' ? 'improving' : direction === 'worsening' ? 'worsening' : 'stable';

  if (!available) {
    const firstRead = history?.status === 'no_baseline';
    return (
      <section className="snapshot-delta-band unavailable" aria-label="Evolução do placar">
        <div>
          <span className="snapshot-delta-kicker">O QUE MUDOU DESDE A ÚLTIMA LEITURA</span>
          <h3>{firstRead ? 'Primeira leitura persistida' : 'Sem comparação histórica'}</h3>
          <p>{history?.message || 'Configure o histórico executivo para acompanhar recuperação, piora e novos sinais.'}</p>
        </div>
        <span className="snapshot-delta-state">HISTÓRICO NÃO DISPONÍVEL</span>
      </section>
    );
  }

  const score = history.score || {};
  const changes = history.changes || [];
  return (
    <section className="snapshot-delta-band" aria-label="O que mudou desde a última leitura">
      <div className="snapshot-delta-lead">
        <span className="snapshot-delta-kicker">O QUE MUDOU DESDE A ÚLTIMA LEITURA</span>
        <h3>{score.delta > 0 ? 'A operação recuperou pressão' : score.delta < 0 ? 'A operação acumulou pressão' : 'A operação permaneceu estável'}</h3>
        <p>Comparação real entre snapshots persistidos; sem tendência artificial.</p>
      </div>
      <div className={`snapshot-delta-score ${directionClass(score.direction)}`}>
        <strong>{formatSigned(score.delta)} pts</strong>
        <span>{score.current ?? 'N/D'} pts atuais · {directionLabel(score.direction)}</span>
      </div>
      <div className="snapshot-delta-changes">
        {changes.slice(0, 6).map(change => (
          <div key={change.key} className={`snapshot-delta-item ${directionClass(change.direction)}`}>
            <strong>{change.label}</strong>
            <span>{change.previous} → {change.current}</span>
            <small>{formatSigned(change.delta)} · {directionLabel(change.direction)}</small>
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
    { id: 'health', label: 'SAÚDE EXECUTIVA', value: formatPoints(healthScore), detail: `${healthScore < 0 ? 'ABAIXO DA LINHA DE RECUPERAÇÃO' : snapshot?.portfolioStability?.label || 'sem leitura'} · score bruto`, progress: healthScore, min: -100, max: 100, tone: stabilityTone, title: 'Score bruto de pressão operacional. Pode ficar negativo; não é percentual de itens saudáveis nem indicador financeiro.', explanation: healthExplanation, action: 'Abrir composição do score' },
    { id: 'delays', label: 'ATRASOS INTERNOS', value: formatNumber(delayedInternal), detail: `${formatPct(quantitative.overdueInternalPctOfActive)} dos ativos · -${formatNumber(delayedInternal * 2)} pts`, progress: quantitative.overdueInternalPctOfActive, tone: 'critical', title: 'Itens ativos de Produção de Conteúdo com prazo interno vencido.', explanation: `${formatNumber(delayedInternal)} itens de Produção de Conteúdo no Monday, distribuídos por cliente, responsável, etapa, status e dias de atraso. Cada item retira 2 pontos.`, action: 'Abrir os atrasos de Produção de Conteúdo' },
    { id: 'exposure', label: 'CLIENTES EXPOSTOS', value: formatNumber(riskClients), detail: eligibleClients ? `${formatNumber(riskClients)} de ${formatNumber(eligibleClients)} ativos · ${formatPct(exposedPct)}` : 'denominador indisponível', progress: exposedPct, tone: 'warning', title: 'Clientes com pelo menos um atraso agregado no recorte.', explanation: `${formatNumber(riskClients)} de ${formatNumber(eligibleClients)} clientes ativos têm pelo menos um atraso interno ou de veiculação.`, action: 'Abrir clientes expostos' },
    { id: 'execution', label: 'SEM EXECUÇÃO', value: formatNumber(stalledCount), detail: `${formatPct(stalledPct)} da carteira · -${formatNumber(stalledCount * 5)} pts`, progress: stalledPct, tone: 'critical', title: 'Clientes ativos sem conteúdo em Produção de Conteúdo e sem solicitação aberta.', explanation: `${formatNumber(stalledCount)} clientes estão sem conteúdo em Produção de Conteúdo e sem demanda aberta; onboarding é tratado separadamente. Cada um retira 5 pontos.`, action: 'Abrir clientes sem execução' },
    { id: 'active', priority: 'supporting', label: 'ITENS ATIVOS', value: formatNumber(activeItems), detail: `${formatPct(quantitative.activePct)} da base histórica`, progress: quantitative.activePct, tone: 'cyan', title: 'Itens ativos no recorte atual do board Produção de Conteúdo.', explanation: `${formatNumber(activeItems)} ativos de ${formatNumber(activeBase)} itens lidos, excluindo Finalizado, Publicado e Cancelado do recorte ativo.`, action: 'Abrir composição da carteira' },
    { id: 'publication', priority: 'supporting', label: 'VEICULAÇÕES VENCIDAS', value: formatNumber(delayedPublication), detail: `${formatPct(quantitative.overduePublicationPctOfActive)} dos ativos · -${formatNumber(delayedPublication * 5)} pts`, progress: quantitative.overduePublicationPctOfActive, tone: 'warning', title: 'Itens de Produção de Conteúdo que ultrapassaram a data prevista de veiculação.', explanation: `${formatNumber(delayedPublication)} itens têm a veiculação vencida; cada item será mostrado com cliente, responsável, prazo e motivo. Cada um retira 5 pontos.`, action: 'Abrir veiculações vencidas' }
  ];
  const primaryCards = cards.filter(card => !card.priority);
  const supportCards = cards.filter(card => card.priority === 'supporting');
  const activeSignals = [delayedInternal, delayedPublication, stalledCount, delayedDemands].filter(value => value > 0).length;
  const renderCard = card => (
    <article className={`executive-kpi-card ${card.tone} ${card.priority || 'decision-primary'}`} key={card.id} {...clickable(() => onSelect(card.id), `${card.action}: ${card.label}`)}>
      <div className="executive-kpi-card-top"><span className="executive-kpi-label">{card.label}</span><span className="executive-kpi-card-action">INVESTIGAR ↗</span></div>
      <strong className="executive-kpi-value">{card.value}</strong>
      <span className="executive-kpi-detail">{card.detail}</span>
      <ExecutiveMeter value={card.progress} min={card.min ?? 0} max={card.max ?? 100} tone={card.tone} label={card.title} displayValue={card.id === 'health' ? formatPoints(healthScore) : undefined} />
      <div className="executive-kpi-tooltip"><strong>{card.title}</strong><span>{card.explanation}</span><small>{card.action}</small></div>
    </article>
  );

  return (
    <section className="executive-kpi-band" aria-label="KPIs executivos da carteira">
      <div className="executive-kpi-header"><div><span className="executive-section-kicker">DECIDA PELA CARTEIRA</span><h2>O que exige decisão agora?</h2><p className="executive-kpi-subtitle">Quatro sinais prioritários, dois indicadores de suporte e investigação em um clique.</p></div><div className="executive-kpi-context"><strong>{activeSignals}</strong><span>sinais críticos ativos</span><b>{formatPoints(healthScore)}</b><small>placar bruto</small></div></div>
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
  const categories = ['Redação', 'Produção', 'Criação', 'Saídas'].map(stage => {
    const matching = source.filter(row => canonicalStage(row.stage) === stage);
    const count = matching.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
    return { stage, count, pct: activeItems ? (count / activeItems) * 100 : 0 };
  });
  const max = Math.max(...categories.map(row => row.count), 1);

  return (
    <section className="data-panel visual-panel stage-distribution" aria-label="Distribuição de itens por etapa">
      <div className="data-panel-title"><span>FLUXO DA CARTEIRA · POR ETAPA</span><span className="panel-subtitle">{formatNumber(activeItems)} ATIVOS</span></div>
      <div className="visual-question">Onde o trabalho está concentrado?</div>
      <div className="stage-bars">
        {categories.map(row => (
          <div className="stage-bar-row" key={row.stage}>
            <div className="stage-bar-heading"><strong>{row.stage}</strong><span>{formatNumber(row.count)} · {formatPct(row.pct)}</span></div>
            <div className="stage-bar-track"><span style={{ width: `${(row.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="visual-footnote">Redação, Produção, Criação e Saídas seguem a divisão executiva do Nexus; os nomes operacionais do Monday são normalizados apenas para leitura.</p>
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
    <section className="data-panel visual-panel status-composition" aria-label="Composição da carteira por status">
      <div className="data-panel-title"><span>COMPOSIÇÃO · STATUS MONDAY</span><span className="panel-subtitle">{formatNumber(total)} ATIVOS</span></div>
      <div className="visual-question">Em que estado a carteira está?</div>
      <div className="status-stack" aria-label="Distribuição proporcional dos status">
        {visible.map(([status, count]) => <span key={status} className={`status-segment ${statusTone(status)}`} style={{ width: `${(Number(count) / total) * 100}%`, backgroundColor: statusColorFor(status, statusColors) }} title={`${status}: ${formatNumber(count)} itens`} />)}
      </div>
      <div className="status-legend">
        {visible.map(([status, count]) => <div key={status} className="status-legend-item"><span className={`status-dot ${statusTone(status)}`} style={{ backgroundColor: statusColorFor(status, statusColors), boxShadow: `0 0 7px ${statusColorFor(status, statusColors)}` }} /><span>{status}</span><strong>{formatNumber(count)} <small>{formatPct((Number(count) / total) * 100)}</small></strong></div>)}
      </div>
      {entries.length > visible.length ? <div className="visual-footnote">+ {entries.length - visible.length} status adicionais no recorte. A composição respeita os nomes existentes no Monday.</div> : null}
    </section>
  );
}

function ownerUrgency(daysOverdue) {
  const days = Number(daysOverdue) || 0;
  if (days >= 14) return { key: 'critical-max', label: 'Crítico máximo', short: `${days}D` };
  if (days >= 7) return { key: 'critical', label: 'Crítico', short: `${days}D` };
  if (days >= 3) return { key: 'high', label: 'Alto', short: `${days}D` };
  if (days >= 1) return { key: 'attention', label: 'Atenção', short: `${days}D` };
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
    <section className="data-panel visual-panel owner-bars" aria-label="Concentração de atrasos por responsável">
      <div className="data-panel-title"><span>CONCENTRAÇÃO · RESPONSÁVEIS</span><span className="panel-subtitle">{formatNumber(totalDelays)} INTERNOS</span></div>
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
                <div className="owner-bar-heading"><PeopleAvatars people={owner.people} names={owner.name} label={`Responsável ${owner.name}`} size="md" /><div className="owner-bar-person-summary"><span className="owner-bar-person-name">{owner.name}</span><strong>{formatNumber(owner.count)} atrasos</strong><span>{owner.publication ? `${owner.publication} veiculação` : 'sem veiculação'}</span><em className={`owner-urgency-chip ${owner.urgency.key}`}>{owner.urgency.short} · {owner.urgency.label}</em></div><span className="owner-bar-share">{formatPct(totalDelays ? (owner.count / totalDelays) * 100 : null)}</span></div>
                <div className={`owner-bar-track ${owner.urgency.key}`}><span style={{ width: `${(owner.count / max) * 100}%` }} /></div>
                <small className="owner-bar-instruction"><strong>Maior atraso: {owner.maxDays} dia(s)</strong> · {isSelected ? 'selecionado · abrir abaixo' : 'selecione para fixar'}</small>
              </button>
              <button type="button" className="owner-bar-open" onClick={() => onOpen(owner)} aria-label={`Abrir todas as entregas de ${owner.name}`}>ABRIR {formatNumber(owner.count)} ENTREGAS ↗</button>
              {showOwnerPreview ? <div className="owner-bar-hover" role="tooltip">
                <div className="owner-bar-hover-title">{hoverDetails.length < 5 ? `${hoverDetails.length} DEMANDAS EM RISCO` : '5 DEMANDAS MAIS URGENTES'} · {owner.name}</div>
                {hoverDetails.length ? hoverDetails.map((item, index) => { const urgency = ownerUrgency(item.daysOverdue); return <a className={`owner-bar-hover-item ${urgency.key}`} key={item.id || `${item.name}-${index}`} href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer" title="Abrir evidência no Monday"><strong>{item.name}</strong><span>{item.client || 'Sem cliente'} · {item.stage || 'Etapa não informada'}</span><small><b>{urgency.short} · {urgency.label}</b>{item.status ? ` · ${item.status}` : ''} <em>Abrir no Monday ↗</em></small></a>; }) : <span className="owner-bar-hover-empty">Nenhuma demanda detalhada disponível.</span>}
              </div> : null}
            </div>
          );
        })}
      </div>
      <p className="visual-footnote">Concentração de sinais, não medição de produtividade individual. O denominador é o total de atrasos internos encontrados. Clique no card para selecionar; use o botão para abrir todas as entregas.</p>
    </section>
  );
}

function RiskBars({ clients, showAll, onToggle, onSelect }) {
  const visible = clients.slice(0, showAll ? clients.length : 5);
  const max = Math.max(...clients.map(item => Number(item.riskPct) || 0), 1);
  return (
    <section className="data-panel visual-panel risk-bars" aria-label="Risco de previsibilidade por cliente">
      <div className="data-panel-title"><span>RISCO DE PREVISIBILIDADE · CLIENTES</span><span className="panel-subtitle">{formatNumber(clients.length)} EXPOSTOS</span></div>
      <div className="visual-question">Qual cliente exige decisão primeiro?</div>
      <div className="risk-bar-list">
        {visible.map(client => {
          const tone = riskTone(client.riskPct);
          return (
            <div className={`risk-bar-row ${tone}`} key={client.client} {...clickable(() => onSelect(client), `Abrir investigação de ${client.client}`)}>
              <div className="risk-bar-heading"><strong>{client.client}</strong><span className={`risk-pct ${tone}`}>{formatPct(client.riskPct)}</span></div>
              <div className="risk-bar-track"><span style={{ width: `${(Number(client.riskPct) / max) * 100}%` }} /></div>
              <div className="risk-bar-meta"><span>{formatNumber(client.delayedItems)} atrasos / {formatNumber(client.openItems)} abertos</span><span>{formatNumber(client.internalDelays)} internos · {formatNumber(client.publicationDelays)} veiculação</span></div>
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
  const publication = list.filter(item => item.delayType?.includes('veiculação'));
  const totalDays = list.reduce((total, item) => total + (Number(item.daysOverdue) || 0), 0);
  const clients = [...new Set(list.map(item => item.client).filter(Boolean))];
  const stages = [...new Set(list.map(item => item.stage).filter(Boolean))];
  const oldest = list.reduce((oldestItem, item) => (item.daysOverdue || 0) > (oldestItem?.daysOverdue || 0) ? item : oldestItem, null);
  const dominantStage = Object.entries(list.reduce((map, item) => {
    const stage = item.stage || 'Etapa não informada';
    map[stage] = (map[stage] || 0) + 1;
    return map;
  }, {})).sort((a, b) => b[1] - a[1])[0];

  if (panel?.type === 'owner') {
    return {
      eyebrow: 'JARVIS · INVESTIGAÇÃO DE CAPACIDADE',
      title: `${panel.id} concentra um gargalo de fluxo`,
      narrative: `${list.length} item(s) atrasado(s) associado(s) a esta pessoa, distribuído(s) em ${clients.length || 1} cliente(s). O padrão aponta para concentração de prazo, não para uma medição de produtividade individual.`,
      why: `${internal.length} atraso(s) de prazo interno${publication.length ? ` e ${publication.length} de veiculação` : ''}. ${dominantStage ? `A maior concentração aparece em “${dominantStage[0]}” (${dominantStage[1]} item(s)).` : 'A etapa do fluxo não está preenchida.'}`,
      recommendation: 'Investigar a causa do fluxo — dependência, aprovação, briefing ou distribuição — antes de atribuir mais carga ou cobrar velocidade.',
      metrics: [
        { label: 'ITENS AFETADOS', value: list.length },
        { label: 'CLIENTES', value: clients.length },
        { label: 'DIAS ACUMULADOS', value: totalDays },
        { label: 'MAIOR ATRASO', value: oldest ? `${oldest.daysOverdue}D` : 'N/D' }
      ],
      footer: 'A leitura identifica concentração de sinais; não classifica performance pessoal.'
    };
  }

  const client = panel?.id || 'este cliente';
  const delayed = list.filter(item => item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType);
  const onTime = list.length - delayed.length;
  return {
    eyebrow: 'JARVIS · INVESTIGAÇÃO DE PREVISIBILIDADE',
    title: `${client}: ${delayed.length} atrasados em ${list.length} itens abertos`,
    narrative: `${client} possui ${list.length} item(s) abertos no board Produção de Conteúdo. ${delayed.length} estão atrasados e ${onTime} ainda não venceram. A investigação separa os dois grupos para não confundir risco com volume de carteira.`,
    why: `${internal.length} atraso(s) de prazo interno${publication.length ? ` e ${publication.length} de veiculação` : ''}. ${stages.length ? `O fluxo atravessa ${stages.length} etapa(s), com maior concentração em “${dominantStage?.[0] || stages[0]}”.` : 'A etapa do fluxo não está preenchida.'}`,
    recommendation: delayed.length > 0 ? 'Abrir primeiro os itens atrasados, confirmar o próximo marco com a equipe e preparar a conversa executiva com o cliente se a data de veiculação estiver comprometida.' : 'Nenhum item está atrasado nesta leitura; acompanhar os próximos prazos sem tratar volume aberto como risco por si só.',
    metrics: [
      { label: 'ITENS ABERTOS', value: list.length },
      { label: 'ATRASADOS', value: delayed.length },
      { label: 'DENTRO DO PRAZO', value: onTime },
      { label: 'DIAS ACUMULADOS', value: totalDays }
    ],
    footer: 'O risco é uma leitura de previsibilidade baseada nos itens abertos encontrados no Monday; itens concluídos ficam fora.'
  };
};

function InvestigationVisualSummary({ panel, list, delayDetails, snapshot }) {
  const delayedList = panel.type === 'client' ? list.filter(item => item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType) : list;
  const internal = delayedList.filter(item => item.isDelayedPrazo || item.delayType?.includes('prazo interno'));
  const publication = delayedList.filter(item => item.isDelayedVeiculacao || item.delayType?.includes('veiculação'));
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
  const title = panel.type === 'owner' ? 'participação nos atrasos internos' : 'exposição dos itens abertos';

  return (
    <section className="investigation-visual-summary" aria-label="Resumo visual da investigação">
      <div className="investigation-visual-head"><div><span>LEITURA VISUAL</span><strong>{title}</strong></div><b>{formatPct(pct)}</b></div>
      <div className="investigation-visual-track"><span style={{ width: `${clampPct(pct)}%` }} /></div>
      <div className="investigation-breakdown">
        <div><strong>{formatNumber(numerator)}</strong><span>{panel.type === 'owner' ? 'SINAIS ASSOCIADOS' : 'ATRASOS'}</span></div>
        <div><strong>{denominator === null ? 'N/D' : formatNumber(denominator)}</strong><span>{panel.type === 'owner' ? 'ATRASOS INTERNOS' : 'ITENS ABERTOS'}</span></div>
        <div><strong>{formatNumber(internal.length)}</strong><span>INTERNOS</span></div>
        <div><strong>{formatNumber(publication.length)}</strong><span>VEICULAÇÕES</span></div>
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
      <div className="investigation-section-title">{label} · {items.length} ITEM(S)</div>
      <ul className="data-list investigation-evidence-list">
        {visibleItems.map((item, i) => {
          const link = mondayItemUrl(item.id);
          const delayed = Boolean(item.isDelayedPrazo || item.isDelayedVeiculacao || item.delayType);
          const urgency = delayed ? delayUrgency(item.daysOverdue) : { tone: 'stable', label: 'DENTRO DO PRAZO', description: 'O prazo ainda não foi ultrapassado nesta leitura.' };
          return (
            <li key={item.id || `${item.name}-${i}`} className={`investigation-evidence-item urgency-${urgency.tone}`}>
              <div className="investigation-evidence-top"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`} title={urgency.description}>{delayed ? `ATRASO: ${item.daysOverdue || 0}D · ${urgency.label}` : 'DENTRO DO PRAZO'}</span></div>
              <div className="investigation-evidence-meta"><span>{item.client}</span><span>{item.stage || 'Etapa não informada'}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColorFor(item.status, snapshot?.quantitative?.statusColors), borderColor: statusColorFor(item.status, snapshot?.quantitative?.statusColors) }}>{item.status}</span> : null}<span>{item.delayType || (delayed ? 'Atraso não classificado' : 'Item aberto dentro do prazo')}</span></div>
              <div className="investigation-evidence-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span><span className="people-field"><b>Resp.</b><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></span></div>
              {item.editorDesigner && <div className="investigation-evidence-meta"><span className="people-field"><b>Editor/Designer</b><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span></div>}
              {link ? <a className="investigation-evidence-link" href={link} target="_blank" rel="noreferrer">Abrir no Monday ↗</a> : null}
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
            <p>INVESTIGAÇÃO EXECUTIVA · SOMENTE LEITURA</p>
          </div>
          <button className="drawer-close" aria-label="Fechar investigação" onClick={() => setPanel(null)}><X size={32} /></button>
        </div>
        <div className="drawer-content">
          {list.length === 0 ? (
            <div className="investigation-empty"><strong>Sem evidência suficiente.</strong><span>O JARVIS não vai inventar uma causa quando o Monday não trouxe itens para este recorte.</span></div>
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
                <span>RECOMENDAÇÃO DO JARVIS</span>
                <p>{investigation.recommendation}</p>
              </section>
              <div className="client-investigation-total">{panel.type === 'client' ? `${delayedClientItems.length} atrasados · ${list.length} itens abertos no total` : `${list.length} evidências de atraso`}</div>
              {panel.type === 'client' ? <>
                {renderEvidenceGroup(delayedClientItems, 'ATRASADOS · PRODUÇÃO DE CONTEÚDO')}
                {renderEvidenceGroup(onTimeClientItems, 'ABERTOS DENTRO DO PRAZO', onTimeClientItems.length > 5)}
              </> : renderEvidenceGroup(list, 'EVIDÊNCIAS · ITENS ATRASADOS')}
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
  const publicationDelays = delays.filter(item => item.delayType?.includes('veiculação'));
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
  const sourceRelation = snapshot?.sourceRelation || { counts: {}, overlapDetails: [], note: 'Relacionamento entre fontes ainda não disponível.' };
  const readinessDeduction = (readiness.scoreDeductions || []).find(deduction => deduction.id === panel.readinessId) || readiness.scoreDeductions?.[0];
  const readinessQuality = readinessDeduction?.kind === 'planning' ? readiness.quality?.planning : readiness.quality?.dashboard;
  const readinessQualityLabel = readinessQuality?.classification === 'source-empty-or-unmapped'
    ? 'FONTE VAZIA OU POSSIVELMENTE NÃO MAPEADA'
    : readinessQuality?.classification === 'partial-coverage'
      ? 'COBERTURA PARCIAL'
      : readinessQuality?.classification === 'complete-coverage'
        ? 'COBERTURA COMPLETA'
        : 'QUALIDADE NÃO INFORMADA';
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
    health: { eyebrow: 'KPI · PLACAR EXECUTIVO', title: 'Qual é a pressão real sobre o placar?', subtitle: 'O score bruto pode ficar negativo. Ele mostra o quanto a operação está abaixo da linha de recuperação.', accent: 'critical' },
    active: { eyebrow: 'KPI · CARTEIRA ATIVA', title: `O que compõe os ${formatNumber(quantitative.activeItems || 0)} itens ativos?`, subtitle: 'Clique em qualquer status para abrir os itens exatos desse grupo no board Produção de Conteúdo.', accent: 'cyan' },
    delays: { eyebrow: 'KPI · PRODUÇÃO DE CONTEÚDO', title: `${delayedInternal} itens de Produção de Conteúdo com prazo interno vencido`, subtitle: 'Fonte: board Produção de Conteúdo · prazo usado: prazo interno. Cada item abaixo tem cliente, responsável, etapa, status, datas e link direto para o Monday.', accent: 'critical' },
    exposure: { eyebrow: 'KPI · RISCO DE PREVISIBILIDADE', title: `${exposedClients.length} clientes expostos`, subtitle: 'Um cliente entra aqui quando possui pelo menos um atraso interno ou de veiculação no recorte.', accent: 'warning' },
    execution: { eyebrow: 'KPI · GAP DE EXECUÇÃO', title: `${stalled} clientes sem execução`, subtitle: 'Clientes ativos sem item no board Produção de Conteúdo e sem Solicitação de Demanda aberta; onboarding é separado.', accent: 'critical' },
    publication: { eyebrow: 'KPI · PRODUÇÃO DE CONTEÚDO', title: `${publicationDelays.length} veiculações vencidas`, subtitle: 'Fonte: board Produção de Conteúdo · prazo usado: data de veiculação. São itens que ultrapassaram a data prevista no Monday.', accent: 'warning' },
    readiness: { eyebrow: 'KPI · PRONTIDÃO EXECUTIVA', title: readinessDeduction?.label || 'Lacuna de prontidão', subtitle: 'A investigação mostra se o problema está na fonte inteira ou em clientes específicos, sem contar o mesmo cliente duas vezes.', accent: readinessDeduction?.kind === 'dashboard' ? 'cyan' : 'warning' },
    'readiness-planning': { eyebrow: 'KPI · PLANEJAMENTO', title: 'Quais clientes têm ou não têm planejamento?', subtitle: 'Fonte: Monday.com · Gestão de Clientes · Planejamento.', accent: 'warning' },
    'readiness-meetings': { eyebrow: 'KPI · REUNIÕES · MONDAY', title: 'Quais clientes tiveram reunião no mês atual?', subtitle: 'Fonte: Monday.com · Reuniões · coluna data. A leitura usa o mês da captura atual.', accent: 'cyan' },
    'readiness-agenda': { eyebrow: 'KPI · AGENDA · GOOGLE CALENDAR', title: 'Quais clientes têm reunião na Agenda nos próximos 30 dias?', subtitle: 'Fonte: Google Calendar · iCal · evento correspondido pelo nome do cliente. Esta fonte é separada do board Reuniões do Monday.', accent: 'cyan' },
    'readiness-onboarding': { eyebrow: 'KPI · FASE DE ENTRADA', title: 'Quais clientes estão em fase de entrada?', subtitle: 'A fase de entrada usa a janela de implantação do Nexus e separa clientes novos do risco de inatividade.', accent: 'cyan' },
    'readiness-calendar': { eyebrow: 'KPI · CALENDÁRIO', title: 'Quais clientes têm três meses de calendário?', subtitle: readinessKpi?.mapped ? 'Fonte: três colunas mensais configuradas no Monday.' : 'A leitura fica N/D até que três IDs de colunas mensais sejam mapeados no Monday.', accent: readinessKpi?.mapped ? 'warning' : 'cyan' }
  }[panel.id] || { eyebrow: 'KPI · INVESTIGAÇÃO', title: 'Detalhamento do KPI', subtitle: 'Leitura executiva baseada no snapshot atual.', accent: 'cyan' };

  const visibleDelays = showAll ? delays : delays.slice(0, 5);
  const visibleInternal = showAll ? internalDelays : internalDelays.slice(0, 5);
  const visiblePublication = showAll ? publicationDelays : publicationDelays.slice(0, 5);
  const visibleClients = showAll ? exposedClients : exposedClients.slice(0, 5);

  const evidencePenalty = item => {
    const delayType = String(item.delayType || '').toLowerCase();
    const hasInternal = delayType.includes('prazo interno');
    const hasPublication = delayType.includes('veiculação');
    const labels = [hasInternal ? 'atraso interno' : null, hasPublication ? 'veiculação em risco' : null].filter(Boolean);
    const points = (hasInternal ? 2 : 0) + (hasPublication ? 5 : 0);
    return { points: points || 2, label: labels.join(' + ') || 'sinal operacional' };
  };

  const evidenceList = (list, label, total = list.length, allItems = list) => {
    const totalPenalty = allItems.reduce((sum, item) => sum + evidencePenalty(item).points, 0);
    const visiblePenalty = list.reduce((sum, item) => sum + evidencePenalty(item).points, 0);
    const isPartialList = list.length < allItems.length;
    return (
    <>
      <div className="kpi-investigation-section-title"><span>{label} · {total} ITEM(S)</span><strong>-{formatNumber(totalPenalty)} pts no total</strong></div>
      {isPartialList ? <div className="kpi-evidence-subtotal">Exibindo {formatNumber(list.length)} de {formatNumber(allItems.length)} itens · -{formatNumber(visiblePenalty)} pts visíveis</div> : null}
      <ul className="kpi-evidence-list">
        {list.map((item, index) => {
          const statusColor = statusColorFor(item.status, quantitative.statusColors);
          const urgency = delayUrgency(item.daysOverdue);
          const penalty = evidencePenalty(item);
          return <li key={item.id || `${item.name}-${index}`} className={`kpi-evidence-card urgency-${urgency.tone}`}>
            <div className="kpi-evidence-card-head"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`} title={urgency.description}>{item.daysOverdue ? `ATRASO: ${item.daysOverdue}D · ${urgency.label}` : 'EM ANDAMENTO'}</span><b className="evidence-penalty-chip">-{formatNumber(penalty.points)} pts · {penalty.label}</b></div>
            <div className="kpi-evidence-card-meta"><span>{item.client || 'Sem cliente'}</span><span className="people-field"><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></span><span>{item.stage || 'Etapa não informada'}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColor, borderColor: statusColor }}>{item.status}</span> : null}</div>
            <div className="kpi-evidence-card-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span><span>{item.delayType || 'Atraso não classificado'}</span>{item.editorDesigner ? <span className="people-field"><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span> : null}</div>
            <a className="investigation-evidence-link" href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer">Abrir no Monday ↗</a>
          </li>;
        })}
      </ul>
      {total > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${total - 5})`}</button> : null}
    </>
    );
  };

  return <div className="drawer-overlay" onClick={() => setPanel(null)}>
    <aside className={`drawer investigation-drawer kpi-investigation-drawer ${configs.accent}`} onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><h3>{configs.title}</h3><p>INVESTIGAÇÃO DO KPI · SOMENTE LEITURA</p></div><button className="drawer-close" aria-label="Fechar investigação" onClick={() => setPanel(null)}><X size={32} /></button></div>
      <div className="drawer-content">
        <section className="investigation-hero"><span className="investigation-eyebrow">{configs.eyebrow}</span><h4>{configs.title}</h4><p>{configs.subtitle}</p></section>

        {readinessKpi ? <>
          <div className="kpi-score-explanation"><div><span>COM O SINAL</span><strong>{readinessKpi.withCount == null ? 'N/D' : formatNumber(readinessKpi.withCount)}</strong></div><div><span>SEM O SINAL</span><strong>{readinessKpi.withoutCount == null ? 'N/D' : formatNumber(readinessKpi.withoutCount)}</strong></div><div><span>COBERTURA</span><strong>{formatPct(readinessKpi.coveragePct)}</strong></div></div>
          <div className="readiness-quality-callout"><div><span>FONTE</span><strong>{readinessKpi.source || 'N/D'}</strong></div><div><span>PERÍODO/CAMPO</span><strong>{readinessKpi.period || readinessKpi.month || readinessKpi.columnIds?.join(', ') || 'N/D'}</strong></div><div><span>CLIENTES LISTADOS</span><strong>{readinessKpi.mapped === false ? 'N/D' : formatNumber(readinessKpiClients.length)}</strong></div></div>
          {readinessKpi.mapped === false ? <div className="investigation-callout"><span>QUALIDADE DA FONTE</span><p>{readinessKpi.message || 'A cobertura de três meses ainda não está mapeada no Monday. O Nexus não converte ausência de coluna em falso zero.'}</p></div> : <>
            <div className="kpi-investigation-section-title">CLIENTES COM O SINAL · {formatNumber(readinessKpiWithClients.length)}</div>
            <div className="kpi-client-grid">{readinessKpiWithClients.map(client => <div className="kpi-client-card" key={`with-${client}`}><strong>{client}</strong><div className="kpi-evidence-card-meta"><span>{panel.id === 'readiness-onboarding' ? 'Em fase de entrada' : panel.id === 'readiness-agenda' ? 'Evento correspondente na Agenda' : 'Campo/reunião identificado'}</span></div></div>)}</div>
            <div className="kpi-investigation-section-title">CLIENTES SEM O SINAL · {formatNumber(readinessKpiWithoutClients.length)}</div>
            <div className="kpi-client-grid">{readinessKpiWithoutClients.slice(0, showAll ? readinessKpiWithoutClients.length : 5).map(client => <div className="kpi-client-card" key={`without-${client}`}><strong>{client}</strong><div className="kpi-evidence-card-meta"><span>{panel.id === 'readiness-onboarding' ? 'Fora da janela de entrada' : panel.id === 'readiness-agenda' ? 'Sem evento correspondente nos próximos 30 dias' : 'Sem evidência no período/campo'}</span></div></div>)}</div>
            {readinessKpiWithoutClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${readinessKpiWithoutClients.length - 5})`}</button> : null}
          </>}
        </> : null}

        {panel.id === 'readiness' ? <>
           <div className="kpi-score-explanation"><div><span>CLIENTES OBSERVADOS</span><strong>{formatNumber(readinessDeduction?.observedCount ?? readinessObservedClients.length)}</strong></div><div><span>ENTRAM NO SCORE</span><strong>{readinessDeduction?.mode === 'source_gap' ? '1 fonte' : formatNumber(readinessDeduction?.penalizedCount ?? readinessClients.length)}</strong></div><div><span>PROTEGIDOS</span><strong>{formatNumber(readinessDeduction?.protectedCount || 0)}</strong></div><div><span>DESCONTO NO PLACAR</span><strong>-{formatNumber(readinessDeduction?.points || 0)} pts</strong></div></div>
           <div className="readiness-quality-callout"><div><span>QUALIDADE DA FONTE</span><strong>{readinessQualityLabel}</strong></div><div><span>CAMPO MONDAY</span><strong>{readinessQuality?.columnId || 'não informado'}</strong></div><div><span>COBERTURA OBSERVADA</span><strong>{formatPct(readinessQuality?.coveragePct)} · {formatNumber(readinessQuality?.populatedClients)} preenchidos de {formatNumber(readinessQuality?.eligibleClients)}</strong></div></div>
           <div className="investigation-callout"><span>REGRA APLICADA</span><p>{readinessDeduction?.mode === 'source_gap' ? 'A cobertura está zerada para esta fonte. O Nexus aplica uma única missão sistêmica, mesmo que todos os clientes apareçam afetados, para não retirar pontos repetidamente pelo mesmo problema estrutural.' : `${readinessDeduction?.observedCount ?? readinessObservedClients.length} clientes foram encontrados sem o campo; ${readinessDeduction?.penalizedCount ?? readinessClients.length} entram no score. ${readinessDeduction?.protectedCount || 0} ficam protegidos por ${readinessDeduction?.explanation || 'regra de não duplicação.'}`}</p></div>
           <div className="kpi-investigation-section-title">CLIENTES OBSERVADOS SEM O CAMPO · {readinessObservedClients.length}</div>
           <div className="kpi-client-grid">{visibleReadinessObservedClients.map(client => { const isPenalized = readinessClients.includes(client); const protectedClient = readinessProtectedClients.find(item => item.client === client); return <div className="kpi-client-card" key={`observed-${client}`}><strong>{client}</strong><div className="kpi-evidence-card-meta"><span>{readinessDeduction?.kind === 'planning' ? 'Planejamento não identificado' : 'Dashboard/calendário não preenchido ou desatualizado'}</span><b className="evidence-penalty-note">{isPenalized ? `ENTRA NO SCORE · -${formatNumber(readinessDeduction?.pointsPerItem || 0)} pts` : `PROTEGIDO · ${protectedClient?.reason || 'regra de não duplicação'}`}</b></div></div>; })}</div>
           {readinessObservedClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${readinessObservedClients.length - 5})`}</button> : null}
        </> : null}

        {panel.id === 'health' ? <>
          <div className="kpi-score-explanation"><div><span>SCORE BRUTO ATUAL</span><strong>{formatPoints(score)}</strong></div><div><span>PONTOS RECUPERÁVEIS</span><strong>{formatPoints(snapshot?.portfolioStability?.recoveryPointsAvailable || 0)}</strong></div></div>
          <div className="investigation-callout"><span>COMO O PLACAR FOI COMPOSTO</span><p>{scoreComposition(snapshot)}</p></div>
          <div className="kpi-factor-grid"><div><strong>-{formatNumber(delayedInternal * 2)} pts</strong><span>{formatNumber(delayedInternal)} itens de Produção de Conteúdo × -2 pts · prazo interno</span></div><div><strong>-{formatNumber(delayedPublication * 5)} pts</strong><span>{formatNumber(delayedPublication)} itens de Produção de Conteúdo × -5 pts · veiculação</span></div><div><strong>-{formatNumber(stalled * 5)} pts</strong><span>{formatNumber(stalled)} clientes sem item em Produção de Conteúdo e sem Solicitação de Demanda × -5 pts</span></div><div><strong>-{formatNumber(delayedDemands * 2)} pts</strong><span>{formatNumber(delayedDemands)} Solicitações de Demandas vencidas × -2 pts</span></div>{(readiness.scoreDeductions || []).map(deduction => <div key={deduction.id}><strong>-{formatNumber(deduction.points)} pts</strong><span>{deduction.mode === 'source_gap' ? `${formatNumber(deduction.observedCount ?? deduction.count)} observados · 1 penalização sistêmica` : `${formatNumber(deduction.observedCount ?? deduction.count)} observados · ${formatNumber(deduction.penalizedCount ?? deduction.count)} penalizados · ${formatNumber(deduction.protectedCount || 0)} protegidos`}</span></div>)}</div>
          <div className="source-relation-callout"><div className="source-relation-heading"><span>RELAÇÃO ENTRE FONTES</span><strong>{formatNumber(sourceRelation.counts?.overlapClients || 0)} clientes com itens nas duas fontes</strong></div><p>{sourceRelation.note}</p><div className="source-relation-grid"><div><strong>{formatNumber(sourceRelation.counts?.productionOpenClients || 0)}</strong><span>clientes com Produção de Conteúdo aberta</span></div><div><strong>{formatNumber(sourceRelation.counts?.demandOpenClients || 0)}</strong><span>clientes com Solicitações abertas</span></div><div><strong>{formatNumber(sourceRelation.counts?.productionOnlyClients || 0)}</strong><span>somente Produção</span></div><div><strong>{formatNumber(sourceRelation.counts?.demandOnlyClients || 0)}</strong><span>somente Solicitações</span></div></div>{sourceRelation.overlapDetails?.length ? <><div className="kpi-investigation-section-title">POSSÍVEL SOBREPOSIÇÃO · {sourceRelation.overlapDetails.length} CLIENTES</div><div className="source-relation-list">{sourceRelation.overlapDetails.slice(0, showAll ? sourceRelation.overlapDetails.length : 5).map(item => <div className="source-relation-item" key={item.client}><strong>{item.client}</strong><span>Produção: {formatNumber(item.productionOpen)} abertos · {formatNumber(item.productionDelayed)} atrasados · Demandas: {formatNumber(item.demandOpen)} abertas · {formatNumber(item.demandDelayed)} vencidas</span></div>)}</div>{sourceRelation.overlapDetails.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${sourceRelation.overlapDetails.length - 5})`}</button> : null}</> : null}</div>
          <p className="investigation-footnote">Este proxy não mede receita, satisfação ou produtividade individual. Ele sinaliza que a pressão operacional ultrapassou o limite da escala atual.</p>
        </> : null}

        {panel.id === 'active' ? <>
          <div className="kpi-factor-grid"><div><strong>{formatNumber(quantitative.activeItems)}</strong><span>ITENS ATIVOS</span></div><div><strong>{formatPct(quantitative.activePct)}</strong><span>DA BASE HISTÓRICA</span></div><div><strong>{formatNumber(quantitative.completedItems)}</strong><span>CONCLUÍDOS FORA DO RECORTE</span></div></div>
          <div className="kpi-investigation-section-title">STATUS DO MONDAY · CLIQUE PARA INVESTIGAR</div><div className="kpi-status-grid">{statusRows.map(([status, count]) => { const color = statusColorFor(status, quantitative.statusColors); const selected = selectedStatus === status; return <button type="button" className={`kpi-status-grid-item${selected ? ' selected' : ''}`} key={status} aria-pressed={selected} onClick={() => setPanel({ ...panel, statusFilter: selected ? '' : status })}><span className="status-dot" style={{ backgroundColor: color, boxShadow: `0 0 7px ${color}` }} /><span>{status}</span><strong>{formatNumber(count)}</strong><small>{formatPct((count / (quantitative.activeItems || 1)) * 100)}</small><em>ABRIR ↗</em></button>; })}</div>
          {selectedStatus ? <>
            <div className="kpi-investigation-section-title">ITENS COM STATUS · {selectedStatus} · {statusItems.length}</div>
            <div className="kpi-status-source-note">Fonte: <strong>Produção de Conteúdo · Monday.com</strong> · {statusItems.length} itens ativos com este status. Itens Finalizado, Publicado e Cancelado ficam fora do recorte.</div>
            <ul className="kpi-status-item-list">
              {visibleStatusItems.map((item, index) => { const color = statusColorFor(item.status, quantitative.statusColors); return <li className="kpi-status-item-card" key={item.id || `${item.name}-${index}`}><div className="kpi-status-item-head"><strong>{item.name}</strong><span className="monday-status-badge" style={{ color, borderColor: color }}>{item.status}</span></div><div className="kpi-status-item-meta"><span>{item.client || 'Sem cliente'}</span><span>{item.stage || 'Etapa não informada'}</span><span className="people-field"><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></span></div><div className="kpi-status-item-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span></div><a className="investigation-evidence-link" href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer">Abrir no Monday ↗</a></li>; })}
            </ul>
            {statusItems.length === 0 ? <div className="investigation-callout"><span>Itens não disponíveis nesta leitura</span><p>O status foi recebido no agregado, mas os detalhes ainda não chegaram no snapshot. Use Atualizar dados para reconsultar o Monday.</p></div> : null}
            {statusItems.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `VER MAIS (${statusItems.length - 5})`}</button> : null}
          </> : null}
          <div className="kpi-investigation-section-title">ETAPAS EXECUTIVAS</div><div className="kpi-status-grid">{stageRows.map(([stage, count]) => <div key={stage}><span className="status-dot" style={{ backgroundColor: 'var(--vybe-cyan)' }} /><span>{canonicalStage(stage)}</span><strong>{formatNumber(count)}</strong><small>{formatPct((count / (quantitative.activeItems || 1)) * 100)}</small></div>)}</div>
        </> : null}

        {panel.id === 'delays' ? evidenceList(visibleInternal, 'ITENS DE PRODUÇÃO DE CONTEÚDO · PRAZO INTERNO', internalDelays.length, internalDelays) : null}
        {panel.id === 'publication' ? evidenceList(visiblePublication, 'ITENS DE PRODUÇÃO DE CONTEÚDO · VEICULAÇÃO VENCIDA', publicationDelays.length, publicationDelays) : null}
        {panel.id === 'health' ? evidenceList(visibleDelays, 'EVIDÊNCIAS QUE PENALIZAM O SCORE', delays.length, delays) : null}

        {panel.id === 'exposure' ? <>
          <div className="kpi-investigation-section-title">Clientes expostos · {exposedClients.length}</div><div className="kpi-client-grid">{visibleClients.map(client => <div className="kpi-client-card" key={client.client}><div className="kpi-evidence-card-head"><strong>{client.client}</strong><span className={`risk-pct ${riskTone(client.riskPct)}`}>{formatPct(client.riskPct)}</span></div><div className="risk-bar-track"><span style={{ width: `${clampPct(client.riskPct)}%` }} /></div><div className="kpi-evidence-card-meta"><span>{client.delayedItems} atrasos / {client.openItems} abertos</span><span>{client.internalDelays} internos · {client.publicationDelays} veiculação</span></div><button type="button" className="kpi-inline-action" onClick={() => { setPanel({ type: 'client', id: client.client, title: `Evidências: ${client.client}` }); }}>Abrir causa ↗</button></div>)}</div>{exposedClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'Ver menos' : `Ver mais (${exposedClients.length - 5})`}</button> : null}</> : null}

        {panel.id === 'execution' ? <>
          <div className="kpi-investigation-section-title">CLIENTES SEM EXECUÇÃO · {execution.stalled?.length || 0}</div><div className="kpi-client-grid">{(execution.stalled || []).map(client => <div className="kpi-client-card" key={client.client}><strong>{client.client}</strong><div className="kpi-evidence-card-meta"><span>{client.daysSinceEntry === null ? 'Tempo na carteira não informado' : `${client.daysSinceEntry} dias na carteira`}</span><span>Sem conteúdo em produção</span><span>Sem demanda aberta</span></div><button type="button" className="kpi-inline-action" onClick={() => setPanel({ type: 'client', id: client.client, title: `Visão: ${client.client}` })}>ABRIR CONTEXTO ↗</button></div>)}</div><div className="investigation-callout"><span>ONBOARDING SEPARADO</span><p>{(execution.onboarding || []).length} cliente(s) ainda estão na janela de implantação de {execution.onboardingWindowDays} dias e não entram no indicador de cliente parado.</p></div></> : null}

        {!String(panel.id || '').startsWith('readiness') && panel.id !== 'health' && panel.id !== 'active' && panel.id !== 'delays' && panel.id !== 'publication' && panel.id !== 'exposure' && panel.id !== 'execution' ? evidenceList(visibleDelays, 'EVIDÊNCIAS', delays.length, delays) : null}
      </div>
    </aside>
  </div>;
}

// --- ESTAÇÕES DE TRABALHO ---

function JarvisCopilot({ message, nextCommand }) {
  return (
    <section className="jarvis-copilot" aria-live="polite">
      <div className="jarvis-copilot-presence">
        <div className="jarvis-mini-orb" aria-hidden="true"><Target size={21} /></div>
        <div><strong>JARVIS</strong><span>Ativo · guiando</span></div>
      </div>
      <div className="jarvis-copilot-speech">
        <div className="jarvis-copilot-label"><span /> JARVIS · agora</div>
        <p>{message.text}</p>
        <small>{message.hint}</small>
      </div>
      <div className="jarvis-copilot-next"><span>Próximo comando</span><strong>{nextCommand}</strong></div>
    </section>
  );
}

function ExecutiveViewNav({ activeView, onChange, snapshot }) {
  const tabs = [
    { id: 'summary', label: 'Resumo executivo', detail: 'decisão e risco' },
    { id: 'portfolio', label: 'Carteira', detail: `${formatNumber(snapshot?.quantitative?.activeItems || 0)} itens ativos` },
    { id: 'demands', label: 'Demandas', detail: `${formatNumber(snapshot?.demandItems?.length || 0)} solicitações` },
    { id: 'team', label: 'Time & performance', detail: 'capacidade observável' }
  ];
  return <nav className="executive-view-nav" aria-label="Contextos executivos">
    {tabs.map(tab => <button type="button" key={tab.id} className={`executive-view-tab ${activeView === tab.id ? 'active' : ''}`} aria-selected={activeView === tab.id} onClick={() => onChange(tab.id)}><strong>{tab.label}</strong><span>{tab.detail}</span></button>)}
  </nav>;
}

function ManagerStation({ snapshot, history, timeSeries, intelligence, onExit, onOpenAnalyst, onRefresh, refreshing, refreshError }) {
  const [detailPanel, setDetailPanel] = useState(null);
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [showAllClients, setShowAllClients] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [activeView, setActiveView] = useState(() => new URLSearchParams(window.location.search).has('analytics') ? 'analytics' : 'summary');
  const [jarvisMessage, setJarvisMessage] = useState({
    text: 'Estou com você. A leitura está organizada e vou conduzir o próximo ponto que merece decisão.',
    hint: 'Selecione qualquer evidência; eu explico por que ela importa.'
  });

  const delayDetails = snapshot.delayDetails || [];
  
  // Concentração de atrasos por responsável; não é ranking de produtividade.
  // Cruzando productivity top responsibles e filtrando apenas atrasos internos
  const internalDelays = delayDetails.filter(d => d.delayType?.includes('prazo interno'));
  const blameMap = {};
  internalDelays.forEach(d => {
    // `responsavel` vem do Monday como lista separada por vírgula.
    splitOwners(d.responsavel).forEach(name => {
      blameMap[name] ||= { count: 0, publication: 0, people: [], details: [] };
      const person = (d.responsavelPeople || []).find(candidate => candidate.name === name);
      if (person && !blameMap[name].people.some(candidate => candidate.id === person.id)) blameMap[name].people.push(person);
      blameMap[name].count += 1;
      blameMap[name].details.push(d);
      if (d.delayType?.includes('veiculação')) blameMap[name].publication += 1;
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

  // Clientes ativos sem nada em execução — sinal de previsibilidade da carteira.
  const execution = snapshot.portfolioExecution || {};
  const stalledClients = execution.stalled || [];
  const onboardingClients = execution.onboarding || [];
  const calendarSignals = snapshot.calendarSignals || {};
  const calendarRiskCount = calendarSignals.riskClientsWithoutMeeting?.length || 0;
  const nextCommand = stalledClients.length > 0
    ? 'Começar pelos clientes ativos sem execução.'
    : internalDelays.length > 0
      ? 'Investigar a concentração de atrasos antes de assumir mais produção.'
      : calendarRiskCount > 0
        ? 'Verificar clientes em risco sem reunião futura.'
        : worstClients.length > 0
          ? 'Abrir as evidências dos clientes com maior exposição.'
          : 'A carteira não apresenta um comando crítico nesta leitura.';
  const initialJarvisMessage = stalledClients.length > 0
    ? { text: `Encontrei ${stalledClients.length} cliente(s) ativo(s) sem conteúdo em produção ou demanda aberta. Esse é o primeiro ponto que eu investigaria com você.`, hint: 'O risco aqui é de previsibilidade: vamos confirmar o contexto antes de concluir qualquer coisa.' }
    : internalDelays.length > 0
      ? { text: `A carteira tem ${internalDelays.length} atraso(s) interno(s) concentrado(s) em ${topBlame.length || 1} responsável(is). Vou separar causa de volume para orientar a decisão.`, hint: calendarRiskCount > 0 ? `Também há ${calendarRiskCount} cliente(s) em risco sem reunião futura.` : 'Selecione um responsável ou cliente e eu abro a leitura completa.' }
      : calendarRiskCount > 0
        ? { text: `Encontrei ${calendarRiskCount} cliente(s) com risco operacional e nenhuma reunião futura identificada na agenda.`, hint: 'A reunião certa pode transformar um risco silencioso em decisão de recuperação.' }
        : worstClients.length > 0
          ? { text: `${worstClients[0].client} aparece com ${worstClients[0].riskPct}% de exposição no recorte. Vou começar pela evidência antes de recomendar qualquer intervenção.`, hint: 'A decisão vem depois da causa; primeiro vamos entender o sinal.' }
          : { text: 'A leitura está organizada. Não encontrei um risco dominante, então vou acompanhar os sinais que podem mudar a decisão.', hint: 'Selecione uma evidência para investigar qualquer variação com contexto.' };
  const activeJarvisMessage = jarvisMessage || initialJarvisMessage;

  return (
    <div className="animate-fade" style={{ minHeight: '100vh' }}>
      <ExecutiveDashboardShell
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
          if (id.startsWith('client:')) return setDetailPanel({ type: 'client', id: id.replace(/^client:/, ''), title: `Investigação: ${id.replace(/^client:/, '')}` });
          if (id.startsWith('item:')) return setDetailPanel({ type: 'analytics', targetType: 'item', itemId: id.replace(/^item:/, ''), title: `Item alterado: ${id.replace(/^item:/, '')}` });
          setDetailPanel({ type: 'kpi', id, readinessId, title: id === 'readiness' ? `Prontidão: ${readinessId}` : `KPI: ${id}` });
        }}
      /> : null}

      {activeView === 'portfolio' ? <>
        <ReadinessKpiBand snapshot={snapshot} onSelect={(id) => setDetailPanel({ type: 'kpi', id, title: `KPI: ${id}` })} />
        <ExecutivePulseBars snapshot={snapshot} />
        <MissionBoard snapshot={snapshot} onSelect={(id, readinessId) => setDetailPanel({ type: 'kpi', id, readinessId, title: id === 'readiness' ? `Prontidão: ${readinessId}` : `KPI: ${id}` })} />
      </> : null}

      {activeView === 'demands' ? <ExecutiveDemandPanel snapshot={snapshot} onSelectClient={(client) => setDetailPanel({ type: 'client', id: client, title: `Visão: ${client}` })} /> : null}
      {activeView === 'team' ? <ExecutivePerformancePanel snapshot={snapshot} onOpenOwner={(owner) => setDetailPanel({ type: 'owner', id: owner, title: `Gargalos: ${owner}` })} onOpenHistory={() => setActiveView('history')} /> : null}
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
          setJarvisMessage({ text: `Abrindo ${selection.title || 'esta leitura'} com os dados observáveis disponíveis.`, hint: 'O painel analítico mantém a evidência, a fonte e o link para investigação.' });
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
            setJarvisMessage({ text: `${person.name} está selecionado com ${person.count} atraso(s) associado(s). O hover mostra as cinco demandas prioritárias; abra todas apenas pelo botão explícito.`, hint: 'Seleção fixada. A abertura completa fica no botão ABRIR ENTREGAS.' });
          }}
          onOpen={(person) => {
            setDetailPanel({ type: 'owner', id: person.id, title: `Gargalos: ${person.name}` });
            setJarvisMessage({ text: `Abrindo todas as ${person.count} entregas de ${person.name}. A investigação vai separar causa, cliente, etapa e urgência.`, hint: 'O painel central reúne a lista completa e os links para o Monday.' });
          }}
        />
        <RiskBars
          clients={worstClients}
          showAll={showAllClients}
          onToggle={() => setShowAllClients(value => !value)}
          onSelect={(client) => {
            setDetailPanel({ type: 'client', id: client.client, title: `Evidências: ${client.client}` });
            setJarvisMessage({ text: `${client.client} tem ${client.riskPct}% de exposição no recorte (${client.delayedItems} de ${client.openItems} itens). Vou abrir a evidência antes de sugerir qualquer decisão.`, hint: 'Próximo: entender se o risco é interno, de veiculação ou de contexto.' });
          }}
        />
      </div> : null}

        <AnalyticsDrilldownDrawer panel={detailPanel} setPanel={setDetailPanel} snapshot={snapshot} />
        <DetailDrawer panel={detailPanel} setPanel={setDetailPanel} delayDetails={delayDetails} snapshot={snapshot} />
        <KpiInvestigationDrawer panel={detailPanel} setPanel={setDetailPanel} snapshot={snapshot} />
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
    ? `${stalled} cliente(s) ativo(s) estão sem conteúdo em produção ou demanda aberta.`
    : overdue > 0
      ? `${overdue} atraso(s) interno(s) pedem investigação antes de adicionar mais pressão à produção.`
      : calendarRiskCount > 0
        ? `${calendarRiskCount} cliente(s) em risco não têm reunião futura identificada na agenda.`
        : clientRisks > 0
          ? `${clientRisks} cliente(s) apresentam sinais de previsibilidade que merecem acompanhamento.`
          : 'A carteira não apresenta um sinal crítico dominante nesta leitura.';
  const priorityClass = stability === null ? 'attention' : stability < 50 ? 'critical' : stability < 75 ? 'attention' : 'stable';

  return (
    <div className="jarvis-clean-home splash-container animate-fade">
      <div className="jarvis-clean-top"><span><Target size={14} /> VYBE NEXUS</span><span>JARVIS · ONLINE</span></div>
      <main className="jarvis-clean-main" aria-live="polite">
        <section className="jarvis-clean-presence" aria-label="Presença do JARVIS">
          <div className="jarvis-orb" aria-hidden="true">
            <div className="jarvis-orb-core"><Target size={34} /></div>
            <i className="jarvis-orb-ring ring-one" /><i className="jarvis-orb-ring ring-two" /><i className="jarvis-orb-ring ring-three" />
          </div>
          <div className="jarvis-presence-status"><span className="jarvis-live-dot" /> Falando com a liderança</div>
          <div className="jarvis-voice-wave" aria-hidden="true">{[1,2,3,4,5,6,7,8].map(bar => <i key={bar} />)}</div>
        </section>

        <section className="jarvis-clean-conversation">
          <div className="jarvis-clean-kicker">JARVIS <span>·</span> leitura executiva</div>
          <h1>{getGreeting()}, liderança.</h1>
          <p className="jarvis-clean-lead">Já li a carteira. Encontrei um ponto para começarmos.</p>
          <div className={`jarvis-clean-insight ${priorityClass}`}>
            <span>Atenção agora</span>
            <strong>{firstPriority}</strong>
          </div>
          <p className="jarvis-clean-explanation">Vou mostrar a evidência e conduzir a próxima decisão. Nada será alterado no Monday.</p>
          <div className="jarvis-clean-question">Quer que eu conduza?</div>
          <div className="jarvis-clean-actions">
            <button type="button" className="jarvis-clean-primary" onClick={onOpenJarvis}><Target size={17} /> Continuar com o JARVIS</button>
            <button type="button" className="jarvis-clean-analyst" onClick={onOpenAnalyst}><Activity size={15} /> Explorar no Analista <span>investigação profunda</span></button>
          </div>
          <div className="jarvis-clean-context"><span>{overdue} atrasos internos</span><i /> <span>{clientRisks} clientes expostos</span><i /> <span>{stalled > 0 ? stalled : decisions} próximo(s) comando(s)</span></div>
          <div className="jarvis-clean-boundary"><Info size={13} /> JARVIS conduz. Analista investiga. Vybe Painel executa.</div>
        </section>
      </main>
    </div>
  );
}

function JarvisWakeScreen({ stage }) {
  const stages = [
    { label: 'Acordando o núcleo', detail: 'Inicializando presença executiva.' },
    { label: 'Lendo a carteira', detail: 'Conectando Monday.com, Vybe Painel e agenda.' },
    { label: 'Cruzando os sinais', detail: 'Separando ruído de decisão.' },
    { label: 'JARVIS online', detail: `${getGreeting()}, liderança. Estou pronto.` }
  ];
  const current = stages[Math.min(stage, stages.length - 1)];
  const progress = `${Math.min(100, 18 + stage * 27)}%`;

  return (
    <div className="jarvis-wake-screen" aria-live="polite">
      <div className="jarvis-wake-grid" />
      <div className="jarvis-wake-brand"><Target size={15} /> Vybe Nexus <span>· leitura executiva</span></div>
      <main className="jarvis-wake-core">
        <div className="jarvis-wake-orb" aria-hidden="true">
          <div className="jarvis-wake-orb-core"><Target size={42} /></div>
          <i className="jarvis-wake-ring wake-ring-one" /><i className="jarvis-wake-ring wake-ring-two" /><i className="jarvis-wake-ring wake-ring-three" />
        </div>
        <div className="jarvis-wake-status"><span className="jarvis-live-dot" /> JARVIS {stage >= 3 ? 'online' : 'despertando'}</div>
        <div className="jarvis-wake-kicker">{current.label}</div>
        <h1>{stage >= 3 ? `${getGreeting()}, liderança.` : 'Despertando.'}</h1>
        <p>{current.detail}</p>
        <div className="jarvis-wake-progress"><span style={{ width: progress }} /></div>
        <div className="jarvis-wake-log"><span className={stage >= 0 ? 'done' : ''}>Núcleo de presença</span><span className={stage >= 1 ? 'done' : ''}>Fontes executivas</span><span className={stage >= 2 ? 'done' : ''}>Leitura de contexto</span></div>
      </main>
      <div className="jarvis-wake-footer">Uma liderança · um comando · uma leitura</div>
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
          <span className="runtime-error-kicker">Vybe Nexus · recuperação</span>
          <h1>O JARVIS precisa reiniciar esta leitura</h1>
          <p>Uma interação encontrou um erro inesperado. Os dados do Monday não foram alterados.</p>
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
      // A leitura normal preserva o cache curto da CDN para não multiplicar
      // consultas ao Monday. A atualização manual usa uma chave de revalidação
      // e recebe no-store no servidor para buscar o estado atual das fontes.
      const refreshQuery = manual || background ? `?refresh=1&t=${Date.now()}` : '';
      const metricsRes = await fetch(`/api/dashboard/metrics${refreshQuery}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal
      });
      const metricsData = await metricsRes.json().catch(() => ({}));

      if (!metricsRes.ok || !metricsData.success) {
        throw new Error(`Command Center: ${metricsData.error || 'não foi possível carregar as métricas.'}`);
      }

      if (requestId !== metricsRequestSequenceRef.current) return;
      const nextSnapshot = metricsData.metrics.executiveSnapshot;
      const nextMirrorVersion = Number(metricsData.meta?.sync?.version || nextSnapshot?.sourceQuality?.sync?.version || 0);
      if (nextMirrorVersion > 0) mirrorVersionRef.current = nextMirrorVersion;
      setMetrics({ executiveSnapshot: nextSnapshot, history: metricsData.meta?.history || null, timeSeries: metricsData.meta?.timeSeries || null, intelligence: metricsData.meta?.intelligence || null });
    } catch (err) {
      if (err.name === 'AbortError') return;
      const message = err.message || 'Falha catastrófica de comunicação com o Monday.com.';
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
        if (!response.ok) throw new Error(payload.message || 'Espelho operacional indisponível.');
        const nextVersion = Number(payload.version || 0);
        const previousVersion = mirrorVersionRef.current;
        if (nextVersion > previousVersion) {
          mirrorVersionRef.current = nextVersion;
          await loadMetrics({ background: true });
        } else if (payload.sync?.state === 'unavailable' || payload.sync?.state === 'stale') {
          setRefreshError(payload.sync?.error || 'A confirmação do espelho operacional está atrasada.');
        }
      } catch (pollError) {
        if (pollError.name !== 'AbortError') setRefreshError(pollError.message || 'Não foi possível conferir o espelho operacional.');
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
          <h2>Não foi possível atualizar a leitura</h2>
          <p>{error}</p>
          <button type="button" onClick={loadMetrics}>Tentar reconexão</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="vybe-os-grid"></div>

      {appMode === 'wake' && <JarvisWakeScreen stage={wakeStage} />}

      {appMode === 'manager' && <ManagerStation snapshot={metrics.executiveSnapshot} history={metrics.history} timeSeries={metrics.timeSeries} intelligence={metrics.intelligence} onExit={() => setAppMode('wake')} onOpenAnalyst={() => setAppMode('analyst')} onRefresh={() => loadMetrics({ manual: true })} refreshing={refreshing} refreshError={refreshError} />}
      {appMode === 'analyst' && (
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
