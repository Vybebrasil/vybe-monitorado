import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Target, Activity, ShieldAlert, Crosshair, X, Info } from 'lucide-react';
import { statusColorFor } from './data/status-colors.js';
import { PeopleAvatars } from './components/PeopleAvatars.jsx';

// Carregada sob demanda: só ela usa Recharts, que responde pela maior parte do bundle.
const AnalystStation = lazy(() => import('./stations/AnalystStation.jsx'));

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  // A data vem do Monday como dia puro (YYYY-MM-DD) e é lida como UTC:
  // sem timeZone: 'UTC' a formatação recua um dia em qualquer fuso a oeste.
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

// Cards, linhas e itens de lista são divs clicáveis: sem isto o painel só
// funciona no mouse. Devolve as props que tornam o elemento operável por teclado.
const clickable = (onActivate, label) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onActivate,
  onKeyDown: (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  }
});

const splitOwners = (value) => String(value || '')
  .split(',')
  .map(name => name.trim())
  .filter(Boolean);

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

const mondayItemUrl = (id) => id ? `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${id}` : null;

const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
const formatPct = (value) => value === null || value === undefined || Number.isNaN(Number(value)) ? 'N/D' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const clampPct = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const formatPoints = (value) => {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${formatNumber(numeric)} pts`;
};

const delayUrgency = (days) => {
  const value = Number(days) || 0;
  if (value >= 15) return { tone: 'catastrophic', label: 'CRÍTICO', description: 'Atraso crítico: exige intervenção executiva imediata.' };
  if (value >= 7) return { tone: 'critical', label: 'SEVERO', description: 'Atraso severo: risco elevado de quebra de previsibilidade.' };
  if (value >= 3) return { tone: 'high', label: 'ALTO', description: 'Atraso alto: precisa de causa e próximo marco.' };
  return { tone: 'attention', label: 'ATENÇÃO', description: 'Atraso recente: acompanhar antes que escale.' };
};

const buildMissions = (snapshot) => {
  const quantitative = snapshot?.quantitative || {};
  const execution = snapshot?.portfolioExecution || {};
  const delayedDemands = Number(snapshot?.summary?.delayedDemands) || 0;
  const readinessMissions = (snapshot?.portfolioReadiness?.scoreDeductions || []).map(deduction => ({
    id: deduction.id,
    kpiId: 'readiness',
    readinessId: deduction.id,
    title: deduction.kind === 'planning' ? (deduction.mode === 'source_gap' ? 'Preencher a fonte de planejamento' : 'Completar planejamentos da carteira') : (deduction.mode === 'source_gap' ? 'Preencher a fonte de calendário' : 'Completar calendários da carteira'),
    current: deduction.count,
    pointsPerItem: deduction.pointsPerItem,
    unit: deduction.mode === 'source_gap' ? 'clientes afetados' : 'clientes',
    accent: deduction.kind === 'planning' ? 'attention' : 'cyan',
    description: deduction.mode === 'source_gap' ? `${deduction.count} clientes sinalizam uma lacuna sistêmica; a missão recupera a fonte inteira sem cobrar o mesmo cliente duas vezes.` : `Cada cliente regularizado devolve ${deduction.pointsPerItem} pontos.`,
    recoverablePoints: deduction.points
  }));
  const missions = [
    { id: 'internal-delays', kpiId: 'delays', title: 'Destravar atrasos internos', current: Number(quantitative.overdueInternal) || 0, pointsPerItem: 2, unit: 'atrasos', accent: 'critical', description: 'Cada prazo interno recuperado devolve 2 pontos.' },
    { id: 'publication-risk', kpiId: 'publication', title: 'Salvar veiculações em risco', current: Number(quantitative.overduePublication) || 0, pointsPerItem: 5, unit: 'veiculações', accent: 'high', description: 'Cada veiculação recuperada devolve 5 pontos.' },
    { id: 'execution-gap', kpiId: 'execution', title: 'Reativar clientes sem execução', current: Number(execution.stalled?.length) || 0, pointsPerItem: 5, unit: 'clientes', accent: 'warning', description: 'Cada cliente reativado devolve 5 pontos.' },
    { id: 'overdue-demands', kpiId: 'health', title: 'Regularizar demandas vencidas', current: delayedDemands, pointsPerItem: 2, unit: 'demandas', accent: 'attention', description: 'Cada demanda vencida regularizada devolve 2 pontos.' },
    ...readinessMissions
  ];
  return missions.filter(mission => mission.current > 0).map(mission => ({
    ...mission,
    recoverablePoints: mission.recoverablePoints ?? mission.current * mission.pointsPerItem,
    progressPct: 0,
    status: 'MISSÃO ABERTA'
  }));
};

const riskTone = (risk) => Number(risk) >= 40 ? 'critical' : Number(risk) >= 20 ? 'warning' : 'stable';
const statusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('finalizado') || normalized.includes('publicado')) return 'complete';
  if (normalized.includes('aguardo') || normalized.includes('alteração') || normalized.includes('falta') || normalized.includes('info')) return 'waiting';
  if (normalized.includes('agendado') || normalized.includes('para agendar')) return 'scheduled';
  return 'active';
};

const canonicalStage = (stage) => {
  const normalized = String(stage || '').toLowerCase();
  if (normalized.includes('redação')) return 'Redação';
  if (normalized.includes('produção')) return 'Produção';
  if (normalized.includes('design') || normalized.includes('edição') || normalized.includes('criação')) return 'Criação';
  if (normalized.includes('gestão') || normalized.includes('publica') || normalized.includes('saída')) return 'Saídas';
  return stage || 'Não informado';
};

function Meter({ value, min = 0, max = 100, tone = 'cyan', label, showValue = true, displayValue }) {
  const range = Number(max) - Number(min);
  const ratio = range > 0 ? clampPct(((Number(value) - Number(min)) / range) * 100) : 0;
  return (
    <div className={`visual-meter ${tone}`} aria-label={label || `${formatPct(value)} do total`}>
      <span className="visual-meter-track"><span className="visual-meter-fill" style={{ width: `${ratio}%` }} /></span>
      {showValue ? <strong>{displayValue ?? formatPct(value)}</strong> : null}
    </div>
  );
}

function ExecutiveKpiBand({ snapshot, riskClients, onSelect }) {
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
  const healthRaw = 100 - delayedInternal * 2 - delayedPublication * 5 - stalledCount * 5 - delayedDemands * 2;
  const healthScore = Number.isFinite(Number(stability)) ? Number(stability) : healthRaw;
  const stabilityTone = healthScore < 0 ? 'catastrophic' : healthScore < 25 ? 'critical' : healthScore < 60 ? 'warning' : 'stable';
  const cards = [
    { id: 'health', label: 'SAÚDE EXECUTIVA', value: formatPoints(healthScore), detail: `${healthScore < 0 ? 'ABAIXO DA LINHA DE RECUPERAÇÃO' : snapshot?.portfolioStability?.label || 'sem leitura'} · score bruto`, progress: healthScore, min: -100, max: 100, tone: stabilityTone, title: 'Score bruto de pressão operacional. Pode ficar negativo; não é percentual de itens saudáveis nem indicador financeiro.', explanation: `Fórmula: 100 − (${delayedInternal}×2) − (${delayedPublication}×5) − (${stalledCount}×5) − (${delayedDemands}×2) = ${healthScore}. Cada fator retira pontos; cada missão recuperada devolve pontos.`, action: 'Abrir composição do score' },
    { id: 'active', label: 'ITENS ATIVOS', value: formatNumber(activeItems), detail: `${formatPct(quantitative.activePct)} da base histórica`, progress: quantitative.activePct, tone: 'cyan', title: 'Itens ativos no recorte atual do board Produção de Conteúdo.', explanation: `${formatNumber(activeItems)} ativos de ${formatNumber(activeBase)} itens lidos, excluindo Finalizado, Publicado e Cancelado do recorte ativo.`, action: 'Abrir composição da carteira' },
    { id: 'delays', label: 'ATRASOS INTERNOS', value: formatNumber(delayedInternal), detail: `${formatPct(quantitative.overdueInternalPctOfActive)} dos ativos · -${formatNumber(delayedInternal * 2)} pts`, progress: quantitative.overdueInternalPctOfActive, tone: 'critical', title: 'Itens ativos com prazo interno vencido.', explanation: `${formatNumber(delayedInternal)} evidências no Monday, distribuídas por cliente, responsável, etapa, status e dias de atraso. Cada uma retira 2 pontos do score.`, action: 'Abrir os itens atrasados' },
    { id: 'exposure', label: 'CLIENTES EXPOSTOS', value: formatNumber(riskClients), detail: eligibleClients ? `${formatNumber(riskClients)} de ${formatNumber(eligibleClients)} ativos` : 'denominador indisponível', progress: exposedPct, tone: 'warning', title: 'Clientes com pelo menos um atraso agregado no recorte.', explanation: `${formatNumber(riskClients)} de ${formatNumber(eligibleClients)} clientes ativos têm pelo menos um atraso interno ou de veiculação.`, action: 'Abrir clientes expostos' },
    { id: 'execution', label: 'SEM EXECUÇÃO', value: formatNumber(stalledCount), detail: `${formatPct(stalledPct)} da carteira ativa · -${formatNumber(stalledCount * 5)} pts`, progress: stalledPct, tone: 'critical', title: 'Clientes ativos sem conteúdo em produção e sem demanda aberta.', explanation: `${formatNumber(stalledCount)} clientes estão fora do fluxo de execução; onboarding é tratado separadamente. Cada um retira 5 pontos do score.`, action: 'Abrir clientes sem execução' },
    { id: 'publication', label: 'VEICULAÇÕES EM RISCO', value: formatNumber(delayedPublication), detail: `${formatPct(quantitative.overduePublicationPctOfActive)} dos ativos · -${formatNumber(delayedPublication * 5)} pts`, progress: quantitative.overduePublicationPctOfActive, tone: 'warning', title: 'Itens que ultrapassaram a data prevista de veiculação.', explanation: `${formatNumber(delayedPublication)} itens têm a veiculação vencida; cada item será mostrado com cliente, responsável, prazo e motivo. Cada um retira 5 pontos.`, action: 'Abrir veiculações em risco' }
  ];

  return (
    <section className="executive-kpi-band" aria-label="KPIs executivos da carteira">
      <div className="executive-kpi-header"><div><span className="executive-section-kicker">LEITURA EXECUTIVA</span><h2>O estado da carteira em números</h2></div><span className={`data-live-badge ${snapshot?.sourceQuality?.monday?.complete === true ? 'complete' : ''}`}>MONDAY · {snapshot?.sourceQuality?.monday?.complete === true ? 'LEITURA COMPLETA' : 'DADOS AO VIVO'}</span></div>
      <div className="executive-kpi-grid">
        {cards.map(card => (
          <article className={`executive-kpi-card ${card.tone}`} key={card.label} {...clickable(() => onSelect(card.id), `${card.action}: ${card.label}`)}>
            <span className="executive-kpi-label">{card.label}</span>
            <strong className="executive-kpi-value">{card.value}</strong>
            <span className="executive-kpi-detail">{card.detail}</span>
            <Meter value={card.progress} min={card.min ?? 0} max={card.max ?? 100} tone={card.tone} label={card.title} displayValue={card.id === 'health' ? formatPoints(healthScore) : undefined} />
            <span className="executive-kpi-click">CLIQUE PARA INVESTIGAR ↗</span>
            <div className="executive-kpi-tooltip"><strong>{card.title}</strong><span>{card.explanation}</span><small>{card.action}</small></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MissionBoard({ snapshot, onSelect }) {
  const missions = buildMissions(snapshot);
  const score = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score);
  const deductions = snapshot?.portfolioStability?.scoreDeductions || [];
  const recoverable = Number(snapshot?.portfolioStability?.recoveryPointsAvailable) || missions.reduce((sum, mission) => sum + mission.recoverablePoints, 0);
  if (!missions.length && !deductions.length) return null;
  const readinessIds = new Set(['planning-source-gap', 'missing-planning', 'dashboard-source-gap', 'missing-dashboard']);
  const operationalDeductions = deductions.filter(deduction => !readinessIds.has(deduction.id));
  const readinessDeductions = deductions.filter(deduction => readinessIds.has(deduction.id));
  const openDeduction = (deduction) => {
    const isReadiness = readinessIds.has(deduction.id);
    const id = isReadiness ? 'readiness' : deduction.id === 'overdue-demands' ? 'health' : deduction.id === 'execution-gap' ? 'execution' : deduction.id === 'publication-risk' ? 'publication' : 'delays';
    onSelect(id, isReadiness ? deduction.id : undefined);
  };
  const renderDeduction = deduction => (
    <button type="button" className="score-ledger-row" key={deduction.id} onClick={() => openDeduction(deduction)}>
      <span><strong>{deduction.label}</strong><small>{deduction.count} × {deduction.pointsPerItem} pts <i>·</i> {deduction.source}</small></span>
      <b>-{formatNumber(deduction.points)} pts</b>
    </button>
  );

  return (
    <section className="mission-board data-panel" aria-label="Missões da carteira e placar executivo">
      <div className="mission-board-header">
        <div className="mission-board-copy"><span className="executive-section-kicker">VYBE OS · MISSÕES DA CARTEIRA</span><h2>Recupere o placar da operação</h2><p>Cada missão nasce de um sinal real do Monday. Não é competição entre pessoas: é recuperação do sistema.</p><div className="mission-objective"><span>OBJETIVO DA LEITURA</span><strong>Resolver sinais comprovados e devolver pontos ao placar.</strong></div></div>
        <div className={`mission-score ${score < 0 ? 'negative' : ''}`}><span>PLACAR BRUTO</span><strong>{formatPoints(score)}</strong><small>{formatPoints(recoverable)} disponíveis</small><em>Meta de recuperação: 100 pts</em></div>
      </div>
      <div className="mission-layout">
        <div className="mission-list">
          {missions.map((mission, index) => (
            <button type="button" className={`mission-card ${mission.accent}`} key={mission.id} onClick={() => onSelect(mission.kpiId, mission.readinessId)} aria-label={`Abrir missão: ${mission.title}`}>
              <div className="mission-card-top"><span>MISSÃO {String(index + 1).padStart(2, '0')}</span><b>{mission.status}</b></div>
              <strong>{mission.title}</strong>
              <div className="mission-card-meta"><span>{mission.current} {mission.unit} restantes</span><b>{formatPoints(mission.recoverablePoints)}</b></div>
              <div className="mission-progress" aria-label="Progresso da missão"><i style={{ width: `${mission.progressPct}%` }} /></div>
              <small>{mission.description}</small>
              <em>ABRIR EVIDÊNCIAS ↗</em>
            </button>
          ))}
        </div>
        <div className="score-ledger">
          <div className="score-ledger-header"><div><span>PLACAR · ORIGEM DOS DESCONTOS</span><strong>O que está tirando pontos</strong></div><b>{deductions.length} fontes</b></div>
          <div className="score-ledger-group"><span className="score-ledger-group-title">EXECUÇÃO E ENTREGA</span>{operationalDeductions.map(renderDeduction)}</div>
          <div className="score-ledger-group readiness"><span className="score-ledger-group-title">PRONTIDÃO DA CARTEIRA</span>{readinessDeductions.map(renderDeduction)}</div>
        </div>
      </div>
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

function OwnerBars({ owners, totalDelays, onSelect }) {
  const visible = owners.slice(0, 5);
  const max = Math.max(...owners.map(item => item.count), 1);
  return (
    <section className="data-panel visual-panel owner-bars" aria-label="Concentração de atrasos por responsável">
      <div className="data-panel-title"><span>CONCENTRAÇÃO · RESPONSÁVEIS</span><span className="panel-subtitle">{formatNumber(totalDelays)} INTERNOS</span></div>
      <div className="visual-question">Onde os atrasos internos se concentram?</div>
      <div className="owner-bar-list">
        {visible.map(owner => (
          <div className="owner-bar-row" key={owner.id} {...clickable(() => onSelect(owner), `Investigar ${owner.name}`)}>
            <div className="owner-bar-heading"><PeopleAvatars people={owner.people} names={owner.name} label={`Responsável ${owner.name}`} size="md" /><span>{formatNumber(owner.count)} · {formatPct(totalDelays ? (owner.count / totalDelays) * 100 : null)}</span></div>
            <div className="owner-bar-track"><span style={{ width: `${(owner.count / max) * 100}%` }} /></div>
            <small>{owner.publication ? `${owner.publication} de veiculação` : 'somente prazo interno'} · investigar causa</small>
          </div>
        ))}
      </div>
      <p className="visual-footnote">Concentração de sinais, não medição de produtividade individual. O denominador é o total de atrasos internos encontrados.</p>
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
      {clients.length > 5 ? <button type="button" className="list-expand" onClick={onToggle}>{showAll ? 'VER MENOS' : `VER MAIS (${clients.length - 5})`}</button> : null}
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
  return {
    eyebrow: 'JARVIS · INVESTIGAÇÃO DE PREVISIBILIDADE',
    title: `${client} exige uma leitura de causa`,
    narrative: `${list.length} item(s) atrasado(s) foram encontrados para este cliente. A pergunta executiva é se o risco está no prazo interno, na veiculação ou em uma dependência que precisa ser destravada.`,
    why: `${internal.length} atraso(s) interno(s)${publication.length ? ` e ${publication.length} de veiculação` : ''}. ${stages.length ? `O fluxo atravessa ${stages.length} etapa(s), com maior concentração em “${dominantStage?.[0] || stages[0]}”.` : 'A etapa do fluxo não está preenchida.'}`,
    recommendation: 'Abrir os itens mais antigos, confirmar o próximo marco com a equipe e preparar a conversa executiva com o cliente se a data de veiculação estiver comprometida.',
    metrics: [
      { label: 'ITENS AFETADOS', value: list.length },
      { label: 'ATRASOS INTERNOS', value: internal.length },
      { label: 'VEICULAÇÕES', value: publication.length },
      { label: 'DIAS ACUMULADOS', value: totalDays }
    ],
    footer: 'O risco é uma leitura de previsibilidade baseada nos itens encontrados no Monday.'
  };
};

function InvestigationVisualSummary({ panel, list, delayDetails, snapshot }) {
  const internal = list.filter(item => item.delayType?.includes('prazo interno'));
  const publication = list.filter(item => item.delayType?.includes('veiculação'));
  const totalDays = list.reduce((sum, item) => sum + (Number(item.daysOverdue) || 0), 0);
  const clientRow = snapshot?.clientRanking?.find(row => row.client === panel.id);
  const ownerBase = delayDetails.filter(item => item.delayType?.includes('prazo interno')).length || list.length;
  const numerator = panel.type === 'owner' ? list.length : (clientRow?.delayedItems ?? list.length);
  const denominator = panel.type === 'owner' ? ownerBase : (clientRow?.openItems ?? null);
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
  useEffect(() => {
    if (!panel) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, setPanel]);

  if (!panel || panel.type === 'kpi') return null;

  let list = [];
  if (panel.type === 'owner') {
    list = delayDetails.filter(d => splitOwners(d.responsavel).includes(panel.id));
  } else if (panel.type === 'client') {
    list = delayDetails.filter(d => d.client === panel.id);
  }
  list = list.slice().sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  const investigation = buildInvestigation(panel, list);

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
              <div className="investigation-section-title">EVIDÊNCIAS · {list.length} ITEM(S)</div>
              <ul className="data-list investigation-evidence-list">
                {list.map((item, i) => {
                  const link = mondayItemUrl(item.id);
                  const urgency = delayUrgency(item.daysOverdue);
                  return (
                    <li key={item.id || i} className={`investigation-evidence-item urgency-${urgency.tone}`}>
                      <div className="investigation-evidence-top"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`} title={urgency.description}>{item.daysOverdue ? `ATRASO: ${item.daysOverdue}D · ${urgency.label}` : 'EM ANDAMENTO'}</span></div>
                      <div className="investigation-evidence-meta"><span>{item.client}</span><span>{item.stage || 'Etapa não informada'}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColorFor(item.status, snapshot?.quantitative?.statusColors), borderColor: statusColorFor(item.status, snapshot?.quantitative?.statusColors) }}>{item.status}</span> : null}<span>{item.delayType || 'Atraso não classificado'}</span></div>
                      <div className="investigation-evidence-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span><span className="people-field"><b>Resp.</b><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></span></div>
                      {item.editorDesigner && <div className="investigation-evidence-meta"><span className="people-field"><b>Editor/Designer</b><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span></div>}
                      {link ? <a className="investigation-evidence-link" href={link} target="_blank" rel="noreferrer">ABRIR NO MONDAY ↗</a> : null}
                    </li>
                  );
                })}
              </ul>
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
  const score = snapshot?.portfolioStability?.score;
  const delayedInternal = Number(quantitative.overdueInternal) || 0;
  const delayedPublication = Number(quantitative.overduePublication) || 0;
  const stalled = Number(execution.stalled?.length || 0);
  const delayedDemands = Number(summary.delayedDemands) || 0;
  const readiness = snapshot?.portfolioReadiness || {};
  const readinessDeduction = (readiness.scoreDeductions || []).find(deduction => deduction.id === panel.readinessId) || readiness.scoreDeductions?.[0];
  const readinessClients = readinessDeduction?.affectedClients || [];
  const visibleReadinessClients = showAll ? readinessClients : readinessClients.slice(0, 5);
  const readinessPoints = (readiness.scoreDeductions || []).reduce((total, deduction) => total + (Number(deduction.points) || 0), 0);
  const rawScore = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score) || 0;
  const readinessFormula = readinessPoints ? ` − (${readinessPoints} pts de prontidão)` : '';

  const configs = {
    health: { eyebrow: 'KPI · PLACAR EXECUTIVO', title: 'Qual é a pressão real sobre o placar?', subtitle: 'O score bruto pode ficar negativo. Ele mostra o quanto a operação está abaixo da linha de recuperação.', accent: 'critical' },
    active: { eyebrow: 'KPI · CARTEIRA ATIVA', title: 'O que compõe os 155 itens ativos?', subtitle: 'A leitura mostra a carteira por status e etapa, usando o recorte ativo do Monday.', accent: 'cyan' },
    delays: { eyebrow: 'KPI · EVIDÊNCIAS DE ATRASO', title: `${delayedInternal} atrasos internos encontrados`, subtitle: 'Cada item abaixo tem cliente, responsável, etapa, status, datas e link direto para o Monday.', accent: 'critical' },
    exposure: { eyebrow: 'KPI · RISCO DE PREVISIBILIDADE', title: `${exposedClients.length} clientes expostos`, subtitle: 'Um cliente entra aqui quando possui pelo menos um atraso interno ou de veiculação no recorte.', accent: 'warning' },
    execution: { eyebrow: 'KPI · GAP DE EXECUÇÃO', title: `${stalled} clientes sem execução`, subtitle: 'Clientes ativos sem conteúdo em produção e sem demanda aberta; onboarding é separado.', accent: 'critical' },
    publication: { eyebrow: 'KPI · ENTREGA PERCEBIDA', title: `${publicationDelays.length} veiculações em risco`, subtitle: 'São itens que ultrapassaram a data prevista de veiculação no Monday.', accent: 'warning' },
    readiness: { eyebrow: 'KPI · PRONTIDÃO EXECUTIVA', title: readinessDeduction?.label || 'Lacuna de prontidão', subtitle: 'A investigação mostra se o problema está na fonte inteira ou em clientes específicos, sem contar o mesmo cliente duas vezes.', accent: readinessDeduction?.kind === 'dashboard' ? 'cyan' : 'warning' }
  }[panel.id] || { eyebrow: 'KPI · INVESTIGAÇÃO', title: 'Detalhamento do KPI', subtitle: 'Leitura executiva baseada no snapshot atual.', accent: 'cyan' };

  const visibleDelays = showAll ? delays : delays.slice(0, 5);
  const visibleInternal = showAll ? internalDelays : internalDelays.slice(0, 5);
  const visiblePublication = showAll ? publicationDelays : publicationDelays.slice(0, 5);
  const visibleClients = showAll ? exposedClients : exposedClients.slice(0, 5);

  const evidenceList = (list, label, total = list.length) => (
    <>
      <div className="kpi-investigation-section-title">{label} · {total} ITEM(S)</div>
      <ul className="kpi-evidence-list">
        {list.map((item, index) => {
          const statusColor = statusColorFor(item.status, quantitative.statusColors);
          const urgency = delayUrgency(item.daysOverdue);
          return <li key={item.id || `${item.name}-${index}`} className={`kpi-evidence-card urgency-${urgency.tone}`}>
            <div className="kpi-evidence-card-head"><strong>{item.name}</strong><span className={`item-meta urgency-chip ${urgency.tone}`} title={urgency.description}>{item.daysOverdue ? `ATRASO: ${item.daysOverdue}D · ${urgency.label}` : 'EM ANDAMENTO'}</span></div>
            <div className="kpi-evidence-card-meta"><span>{item.client || 'Sem cliente'}</span><span className="people-field"><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></span><span>{item.stage || 'Etapa não informada'}</span>{item.status ? <span className="monday-status-badge" style={{ color: statusColor, borderColor: statusColor }}>{item.status}</span> : null}</div>
            <div className="kpi-evidence-card-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span><span>{item.delayType || 'Atraso não classificado'}</span>{item.editorDesigner ? <span className="people-field"><PeopleAvatars people={item.editorDesignerPeople} names={item.editorDesigner} label="Editor/Designer" /></span> : null}</div>
            <a className="investigation-evidence-link" href={mondayItemUrl(item.id)} target="_blank" rel="noreferrer">ABRIR NO MONDAY ↗</a>
          </li>;
        })}
      </ul>
      {total > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'VER MENOS' : `VER MAIS (${total - 5})`}</button> : null}
    </>
  );

  return <div className="drawer-overlay" onClick={() => setPanel(null)}>
    <aside className={`drawer investigation-drawer kpi-investigation-drawer ${configs.accent}`} onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><h3>{configs.title}</h3><p>INVESTIGAÇÃO DO KPI · SOMENTE LEITURA</p></div><button className="drawer-close" aria-label="Fechar investigação" onClick={() => setPanel(null)}><X size={32} /></button></div>
      <div className="drawer-content">
        <section className="investigation-hero"><span className="investigation-eyebrow">{configs.eyebrow}</span><h4>{configs.title}</h4><p>{configs.subtitle}</p></section>

        {panel.id === 'readiness' ? <>
          <div className="kpi-score-explanation"><div><span>CLIENTES SINALIZADOS</span><strong>{formatNumber(readinessDeduction?.count || readinessClients.length)}</strong></div><div><span>DESCONTO NO PLACAR</span><strong>-{formatNumber(readinessDeduction?.points || 0)} pts</strong></div></div>
          <div className="investigation-callout"><span>REGRA APLICADA</span><p>{readinessDeduction?.mode === 'source_gap' ? 'A cobertura está zerada para esta fonte. O Nexus aplica uma única missão sistêmica, mesmo que todos os clientes apareçam afetados, para não retirar pontos repetidamente pelo mesmo problema estrutural.' : 'A lacuna é parcial. O Nexus aplica pontos por cliente afetado, excluindo clientes sem execução e onboarding para evitar dupla penalização.'}</p></div>
          <div className="kpi-investigation-section-title">CLIENTES AFETADOS · {readinessClients.length}</div>
          <div className="kpi-client-grid">{visibleReadinessClients.map(client => <div className="kpi-client-card" key={client}><strong>{client}</strong><div className="kpi-evidence-card-meta"><span>{readinessDeduction?.kind === 'planning' ? 'Planejamento não identificado' : 'Dashboard/calendário não preenchido ou desatualizado'}</span></div></div>)}</div>
          {readinessClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'VER MENOS' : `VER MAIS (${readinessClients.length - 5})`}</button> : null}
        </> : null}

        {panel.id === 'health' ? <>
          <div className="kpi-score-explanation"><div><span>SCORE BRUTO ATUAL</span><strong>{formatPoints(score)}</strong></div><div><span>PONTOS RECUPERÁVEIS</span><strong>{formatPoints(snapshot?.portfolioStability?.recoveryPointsAvailable || 0)}</strong></div></div>
          <div className="investigation-callout"><span>COMO O PLACAR FOI COMPOSTO</span><p>100 − ({delayedInternal} atrasos internos × 2) − ({delayedPublication} veiculações vencidas × 5) − ({stalled} clientes sem execução × 5) − ({delayedDemands} demandas vencidas × 2){readinessFormula} = {rawScore} pts. O valor não é limitado a 0: quanto mais negativo, maior a missão de recuperação.</p></div>
          <div className="kpi-factor-grid"><div><strong>{delayedInternal}</strong><span>ATRASOS INTERNOS × 2</span></div><div><strong>{delayedPublication}</strong><span>VEICULAÇÕES × 5</span></div><div><strong>{stalled}</strong><span>SEM EXECUÇÃO × 5</span></div><div><strong>{delayedDemands}</strong><span>DEMANDAS VENCIDAS × 2</span></div>{(readiness.scoreDeductions || []).map(deduction => <div key={deduction.id}><strong>-{formatNumber(deduction.points)}</strong><span>{deduction.label.toUpperCase()}</span></div>)}</div>
          <p className="investigation-footnote">Este proxy não mede receita, satisfação ou produtividade individual. Ele sinaliza que a pressão operacional ultrapassou o limite da escala atual.</p>
        </> : null}

        {panel.id === 'active' ? <>
          <div className="kpi-factor-grid"><div><strong>{formatNumber(quantitative.activeItems)}</strong><span>ITENS ATIVOS</span></div><div><strong>{formatPct(quantitative.activePct)}</strong><span>DA BASE HISTÓRICA</span></div><div><strong>{formatNumber(quantitative.completedItems)}</strong><span>CONCLUÍDOS FORA DO RECORTE</span></div></div>
          <div className="kpi-investigation-section-title">STATUS DO MONDAY</div><div className="kpi-status-grid">{statusRows.map(([status, count]) => <div key={status}><span className="status-dot" style={{ backgroundColor: statusColorFor(status, quantitative.statusColors), boxShadow: `0 0 7px ${statusColorFor(status, quantitative.statusColors)}` }} /><span>{status}</span><strong>{formatNumber(count)}</strong><small>{formatPct((count / (quantitative.activeItems || 1)) * 100)}</small></div>)}</div>
          <div className="kpi-investigation-section-title">ETAPAS EXECUTIVAS</div><div className="kpi-status-grid">{stageRows.map(([stage, count]) => <div key={stage}><span className="status-dot" style={{ backgroundColor: 'var(--vybe-cyan)' }} /><span>{canonicalStage(stage)}</span><strong>{formatNumber(count)}</strong><small>{formatPct((count / (quantitative.activeItems || 1)) * 100)}</small></div>)}</div>
        </> : null}

        {panel.id === 'delays' ? evidenceList(visibleInternal, 'ATRASOS INTERNOS', internalDelays.length) : null}
        {panel.id === 'publication' ? evidenceList(visiblePublication, 'VEICULAÇÕES EM RISCO', publicationDelays.length) : null}
        {panel.id === 'health' ? evidenceList(visibleDelays, 'EVIDÊNCIAS QUE PENALIZAM O SCORE', delays.length) : null}

        {panel.id === 'exposure' ? <>
          <div className="kpi-investigation-section-title">CLIENTES EXPOSTOS · {exposedClients.length}</div><div className="kpi-client-grid">{visibleClients.map(client => <div className="kpi-client-card" key={client.client}><div className="kpi-evidence-card-head"><strong>{client.client}</strong><span className={`risk-pct ${riskTone(client.riskPct)}`}>{formatPct(client.riskPct)}</span></div><div className="risk-bar-track"><span style={{ width: `${clampPct(client.riskPct)}%` }} /></div><div className="kpi-evidence-card-meta"><span>{client.delayedItems} atrasos / {client.openItems} abertos</span><span>{client.internalDelays} internos · {client.publicationDelays} veiculação</span></div><button type="button" className="kpi-inline-action" onClick={() => { setPanel({ type: 'client', id: client.client, title: `Evidências: ${client.client}` }); }}>ABRIR CAUSA ↗</button></div>)}</div>{exposedClients.length > 5 ? <button type="button" className="list-expand" onClick={() => setShowAll(value => !value)}>{showAll ? 'VER MENOS' : `VER MAIS (${exposedClients.length - 5})`}</button> : null}</> : null}

        {panel.id === 'execution' ? <>
          <div className="kpi-investigation-section-title">CLIENTES SEM EXECUÇÃO · {execution.stalled?.length || 0}</div><div className="kpi-client-grid">{(execution.stalled || []).map(client => <div className="kpi-client-card" key={client.client}><strong>{client.client}</strong><div className="kpi-evidence-card-meta"><span>{client.daysSinceEntry === null ? 'Tempo na carteira não informado' : `${client.daysSinceEntry} dias na carteira`}</span><span>Sem conteúdo em produção</span><span>Sem demanda aberta</span></div><button type="button" className="kpi-inline-action" onClick={() => setPanel({ type: 'client', id: client.client, title: `Visão: ${client.client}` })}>ABRIR CONTEXTO ↗</button></div>)}</div><div className="investigation-callout"><span>ONBOARDING SEPARADO</span><p>{(execution.onboarding || []).length} cliente(s) ainda estão na janela de implantação de {execution.onboardingWindowDays} dias e não entram no indicador de cliente parado.</p></div></> : null}

        {panel.id !== 'health' && panel.id !== 'active' && panel.id !== 'delays' && panel.id !== 'publication' && panel.id !== 'exposure' && panel.id !== 'execution' ? evidenceList(visibleDelays, 'EVIDÊNCIAS') : null}
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
        <div><strong>JARVIS</strong><span>ATIVO · GUIANDO</span></div>
      </div>
      <div className="jarvis-copilot-speech">
        <div className="jarvis-copilot-label"><span /> JARVIS · AGORA</div>
        <p>{message.text}</p>
        <small>{message.hint}</small>
      </div>
      <div className="jarvis-copilot-next"><span>PRÓXIMO COMANDO</span><strong>{nextCommand}</strong></div>
    </section>
  );
}

function ManagerStation({ snapshot, onExit, onOpenAnalyst }) {
  const [detailPanel, setDetailPanel] = useState(null);
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [showAllClients, setShowAllClients] = useState(false);
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
      blameMap[name] ||= { count: 0, publication: 0, people: [] };
      const person = (d.responsavelPeople || []).find(candidate => candidate.name === name);
      if (person && !blameMap[name].people.some(candidate => candidate.id === person.id)) blameMap[name].people.push(person);
      blameMap[name].count += 1;
      if (d.delayType?.includes('veiculação')) blameMap[name].publication += 1;
    });
  });
  const topBlame = Object.entries(blameMap)
    .map(([name, values]) => ({ id: name, name, people: values.people, ...values }))
    .sort((a, b) => b.count - a.count);

  // Logic 2: Piores Clientes (maior % de itens atrasados sobre itens abertos)
  const clientRanking = snapshot.clientRanking || [];
  const worstClients = clientRanking
    .filter(c => (c.riskPct || 0) > 0)
    .sort((a, b) => (b.riskPct || 0) - (a.riskPct || 0));

  // Clientes ativos sem nada em execução — sinal de previsibilidade da carteira.
  const execution = snapshot.portfolioExecution || {};
  const stalledClients = execution.stalled || [];
  const onboardingClients = execution.onboarding || [];
  const nextCommand = stalledClients.length > 0
    ? 'Começar pelos clientes ativos sem execução.'
    : internalDelays.length > 0
      ? 'Investigar a concentração de atrasos antes de assumir mais produção.'
      : worstClients.length > 0
        ? 'Abrir as evidências dos clientes com maior exposição.'
        : 'A carteira não apresenta um comando crítico nesta leitura.';
  const initialJarvisMessage = stalledClients.length > 0
    ? { text: `Encontrei ${stalledClients.length} cliente(s) ativo(s) sem conteúdo em produção ou demanda aberta. Esse é o primeiro ponto que eu investigaria com você.`, hint: 'O risco aqui é de previsibilidade: vamos confirmar o contexto antes de concluir qualquer coisa.' }
    : internalDelays.length > 0
      ? { text: `A carteira tem ${internalDelays.length} atraso(s) interno(s) concentrado(s) em ${topBlame.length || 1} responsável(is). Vou separar causa de volume para orientar a decisão.`, hint: 'Selecione um responsável ou cliente e eu abro a leitura completa.' }
      : worstClients.length > 0
        ? { text: `${worstClients[0].client} aparece com ${worstClients[0].riskPct}% de exposição no recorte. Vou começar pela evidência antes de recomendar qualquer intervenção.`, hint: 'A decisão vem depois da causa; primeiro vamos entender o sinal.' }
        : { text: 'A leitura está organizada. Não encontrei um risco dominante, então vou acompanhar os sinais que podem mudar a decisão.', hint: 'Selecione uma evidência para investigar qualquer variação com contexto.' };
  const activeJarvisMessage = jarvisMessage || initialJarvisMessage;

  return (
    <div className="animate-fade" style={{ minHeight: '100vh' }}>
      <header className="app-header">
        <div className="app-header-title">
          <Target size={28} /> JARVIS / GUIA EXECUTIVO <span className="badge">GUIADO</span>
        </div>
        <div className="app-header-meta">
          <span>JARVIS ATIVO · RISCO, CAPACIDADE E DECISÃO</span>
          <button className="jarvis-exit-analyst" onClick={onOpenAnalyst}>SAIR DO JARVIS · ABRIR ANALISTA &rarr;</button>
        </div>
      </header>

      <JarvisCopilot message={activeJarvisMessage} nextCommand={nextCommand} />

      <ExecutiveKpiBand snapshot={snapshot} riskClients={worstClients.length} onSelect={(id) => setDetailPanel({ type: 'kpi', id, title: `KPI: ${id}` })} />
      <MissionBoard snapshot={snapshot} onSelect={(id, readinessId) => setDetailPanel({ type: 'kpi', id, readinessId, title: id === 'readiness' ? `Prontidão: ${readinessId}` : `KPI: ${id}` })} />

      <div className="executive-visual-grid">
        <StatusComposition snapshot={snapshot} />
        <StageDistribution snapshot={snapshot} />
        <OwnerBars
          owners={topBlame}
          totalDelays={internalDelays.length}
          onSelect={(person) => {
            setDetailPanel({ type: 'owner', id: person.id, title: `Gargalos: ${person.name}` });
            setJarvisMessage({ text: `Estou investigando ${person.count} atraso(s) associado(s) a ${person.name}. A evidência ajuda a separar causa de percepção.`, hint: 'Próximo: abrir os itens e entender onde o prazo se perdeu.' });
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
      </div>

      <div className="dashboard-grid">
        {/* COLUNA ESQUERDA - ALERTAS DIRETOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="data-panel animate-slide delay-1">
            <div className="data-panel-title">CONCENTRAÇÃO DE ATRASOS · EQUIPE</div>
            <ul className="data-list">
              {topBlame.length === 0 ? <li className="item-sub">Nenhum atraso interno mapeado.</li> : null}
              {topBlame.slice(0, showAllOwners ? topBlame.length : 5).map(person => (
                <li
                  key={person.id}
                  className="data-list-item"
                  {...clickable(
                    () => {
                      setDetailPanel({ type: 'owner', id: person.id, title: `Gargalos: ${person.name}` });
                      setJarvisMessage({ text: `Estou investigando ${person.count} atraso(s) associado(s) a ${person.name}. A evidência ajuda a separar causa de percepção.`, hint: 'Próximo: abrir os itens e entender onde o prazo se perdeu.' });
                    },
                    `Ver os ${person.count} atrasos de ${person.name}`
                  )}
                >
                  <div>
                    <div className="item-primary">{person.name}</div>
                    <div className="item-sub">Atrasos associados · investigar causa</div>
                  </div>
                  <div className="item-meta critical">{person.count} ATRASOS</div>
                </li>
              ))}
              {topBlame.length > 5 && <button type="button" className="list-expand" onClick={() => setShowAllOwners(value => !value)}>{showAllOwners ? 'VER MENOS' : `VER MAIS (${topBlame.length - 5})`}</button>}
            </ul>
          </div>

          <div className="data-panel animate-slide delay-2">
            <div className="data-panel-title">CLIENTES ATIVOS SEM EXECUÇÃO</div>
            <ul className="data-list">
              {stalledClients.length === 0 ? (
                <li className="item-sub">Toda a carteira ativa tem conteúdo ou demanda em andamento.</li>
              ) : null}
              {stalledClients.map(item => (
                <li
                  key={item.client}
                  className="data-list-item"
                  {...clickable(
                    () => {
                      setDetailPanel({ type: 'client', id: item.client, title: `Visão: ${item.client}` });
                      setJarvisMessage({ text: `${item.client} está ativo, mas sem conteúdo em produção ou demanda aberta. Esse é um sinal de previsibilidade, não uma acusação operacional.`, hint: 'Próximo: abrir a evidência e verificar a última movimentação.' });
                    },
                    `Ver os itens de ${item.client}`
                  )}
                >
                  <div>
                    <div className="item-primary">{item.client}</div>
                    <div className="item-sub">Sem conteúdo em produção e sem demanda aberta</div>
                  </div>
                  <div className="item-meta critical">
                    {item.daysSinceEntry === null ? 'PARADO' : `${item.daysSinceEntry}D NA CARTEIRA`}
                  </div>
                </li>
              ))}
              {onboardingClients.length > 0 ? (
                <li className="item-sub" style={{ marginTop: '1rem' }}>
                  {onboardingClients.map(c => c.client).join(', ')} — em implantação, dentro da janela de {execution.onboardingWindowDays} dias.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* COLUNA DIREITA - VISÃO DE CARTEIRA */}
        <div className="data-panel animate-slide delay-3">
          <div className="data-panel-title">CLIENTES EM RISCO DE PREVISIBILIDADE</div>
          <div className="vybe-table-wrapper">
            <table className="vybe-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Risco (atrasos / abertos)</th>
                  <th>Atrasos (Interno)</th>
                  <th>Atrasos (Veiculação)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {worstClients.slice(0, showAllClients ? worstClients.length : 5).map(c => (
                  <tr
                    key={c.client}
                    style={{ cursor: 'pointer' }}
                    {...clickable(
                      () => {
                        setDetailPanel({ type: 'client', id: c.client, title: `Evidências: ${c.client}` });
                        setJarvisMessage({ text: `${c.client} tem ${c.riskPct}% de exposição no recorte (${c.delayedItems} de ${c.openItems} itens). Vou abrir a evidência antes de sugerir qualquer decisão.`, hint: 'Próximo: entender se o risco é interno, de veiculação ou de contexto.' });
                      },
                      `Abrir evidências de ${c.client}`
                    )}
                  >
                    <td className="item-primary" style={{ color: 'var(--vybe-orange)' }}>{c.client}</td>
                    <td>
                      <span className={`badge ${c.riskPct >= 40 ? 'red' : c.riskPct >= 20 ? 'orange' : 'green'}`}>
                        {c.riskPct ?? 0}% ({c.delayedItems}/{c.openItems})
                      </span>
                    </td>
                    <td>{c.internalDelays} atraso(s)</td>
                    <td>{c.publicationDelays} veiculação</td>
                    <td>
                      <span className="item-meta">{c.riskPct >= 40 ? 'CRÍTICO' : 'ATENÇÃO'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {worstClients.length > 5 && <button type="button" className="list-expand table-expand" onClick={() => setShowAllClients(value => !value)}>{showAllClients ? 'VER MENOS' : `VER MAIS (${worstClients.length - 5})`}</button>}
        </div>
      </div>

      <DetailDrawer panel={detailPanel} setPanel={setDetailPanel} delayDetails={delayDetails} snapshot={snapshot} />
      <KpiInvestigationDrawer panel={detailPanel} setPanel={setDetailPanel} snapshot={snapshot} />
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
  const decisions = snapshot?.summary?.decisionsNeeded ?? 0;
  const firstPriority = stalled > 0
    ? `${stalled} cliente(s) ativo(s) estão sem conteúdo em produção ou demanda aberta.`
    : overdue > 0
      ? `${overdue} atraso(s) interno(s) pedem investigação antes de adicionar mais pressão à produção.`
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
          <div className="jarvis-presence-status"><span className="jarvis-live-dot" /> FALANDO COM A LIDERANÇA</div>
          <div className="jarvis-voice-wave" aria-hidden="true">{[1,2,3,4,5,6,7,8].map(bar => <i key={bar} />)}</div>
        </section>

        <section className="jarvis-clean-conversation">
          <div className="jarvis-clean-kicker">JARVIS <span>·</span> LEITURA EXECUTIVA</div>
          <h1>{getGreeting()}, liderança.</h1>
          <p className="jarvis-clean-lead">Já li a carteira. Encontrei um ponto para começarmos.</p>
          <div className={`jarvis-clean-insight ${priorityClass}`}>
            <span>ATENÇÃO AGORA</span>
            <strong>{firstPriority}</strong>
          </div>
          <p className="jarvis-clean-explanation">Vou mostrar a evidência e conduzir a próxima decisão. Nada será alterado no Monday.</p>
          <div className="jarvis-clean-question">Quer que eu conduza?</div>
          <div className="jarvis-clean-actions">
            <button type="button" className="jarvis-clean-primary" onClick={onOpenJarvis}><Target size={17} /> CONTINUAR COM O JARVIS</button>
            <button type="button" className="jarvis-clean-analyst" onClick={onOpenAnalyst}><Activity size={15} /> Explorar no Analista <span>investigação profunda</span></button>
          </div>
          <div className="jarvis-clean-context"><span>{overdue} atrasos internos</span><i /> <span>{clientRisks} clientes expostos</span><i /> <span>{stalled > 0 ? stalled : decisions} próximo(s) comando(s)</span></div>
          <div className="jarvis-clean-boundary"><Info size={13} /> JARVIS conduz. ANALISTA investiga. Vybe Painel executa.</div>
        </section>
      </main>
    </div>
  );
}

function JarvisWakeScreen({ stage }) {
  const stages = [
    { label: 'ACORDANDO O NÚCLEO', detail: 'Inicializando presença executiva.' },
    { label: 'LENDO A CARTEIRA', detail: 'Conectando Monday.com, Vybe Painel e agenda.' },
    { label: 'CRUZANDO OS SINAIS', detail: 'Separando ruído de decisão.' },
    { label: 'JARVIS ONLINE', detail: `${getGreeting()}, liderança. Estou pronto.` }
  ];
  const current = stages[Math.min(stage, stages.length - 1)];
  const progress = `${Math.min(100, 18 + stage * 27)}%`;

  return (
    <div className="jarvis-wake-screen" aria-live="polite">
      <div className="jarvis-wake-grid" />
      <div className="jarvis-wake-brand"><Target size={15} /> VYBE NEXUS <span>// BOOT SEQUENCE</span></div>
      <main className="jarvis-wake-core">
        <div className="jarvis-wake-orb" aria-hidden="true">
          <div className="jarvis-wake-orb-core"><Target size={42} /></div>
          <i className="jarvis-wake-ring wake-ring-one" /><i className="jarvis-wake-ring wake-ring-two" /><i className="jarvis-wake-ring wake-ring-three" />
        </div>
        <div className="jarvis-wake-status"><span className="jarvis-live-dot" /> JARVIS {stage >= 3 ? 'ONLINE' : 'DESPERTANDO'}</div>
        <div className="jarvis-wake-kicker">{current.label}</div>
        <h1>{stage >= 3 ? `${getGreeting()}, liderança.` : 'Despertando.'}</h1>
        <p>{current.detail}</p>
        <div className="jarvis-wake-progress"><span style={{ width: progress }} /></div>
        <div className="jarvis-wake-log"><span className={stage >= 0 ? 'done' : ''}>NÚCLEO DE PRESENÇA</span><span className={stage >= 1 ? 'done' : ''}>FONTES EXECUTIVAS</span><span className={stage >= 2 ? 'done' : ''}>LEITURA DE CONTEXTO</span></div>
      </main>
      <div className="jarvis-wake-footer">UMA LIDERANÇA · UM COMANDO · UMA LEITURA</div>
    </div>
  );
}

// --- MAIN APP ---

function App() {
  const [appMode, setAppMode] = useState('wake'); // wake -> manager by default; analyst is an explicit exit
  const [wakeStage, setWakeStage] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMetrics = async () => {
    setLoading(true);
    setError('');

    try {
      // A resposta é cacheável na CDN de propósito, para que o time inteiro
      // abrindo o painel não multiplique leituras no Monday. Mas o navegador
      // precisa sempre perguntar: quem abre a tela tem que ver o estado atual,
      // não uma cópia local de minutos atrás. Quem responde rápido é a CDN.
      const metricsRes = await fetch('/api/dashboard/metrics', { cache: 'no-store' });
      const metricsData = await metricsRes.json().catch(() => ({}));

      if (!metricsRes.ok || !metricsData.success) {
        throw new Error(`Command Center: ${metricsData.error || 'não foi possível carregar as métricas.'}`);
      }

      setMetrics({ executiveSnapshot: metricsData.metrics.executiveSnapshot });
    } catch (err) {
      setError(err.message || 'Falha catastrófica de comunicação com o Monday.com.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

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
      <div className="vybe-os-grid">
        <div className="loading-wrapper" style={{ textAlign: 'center' }}>
          <ShieldAlert size={60} color="var(--vybe-red)" style={{ marginBottom: '2rem' }} />
          <h2 style={{ fontFamily: 'var(--font-mono)', color: 'var(--vybe-red)', letterSpacing: '4px' }}>SINAL PERDIDO</h2>
          <p style={{ color: 'var(--vybe-text-muted)', margin: '1rem 0 2rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{error}</p>
          <button onClick={loadMetrics} style={{ background: 'transparent', border: '1px solid var(--vybe-red)', color: 'var(--vybe-red)', padding: '1rem 2rem', fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '2px' }}>TENTAR RECONEXÃO</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="vybe-os-grid"></div>

      {appMode === 'wake' && <JarvisWakeScreen stage={wakeStage} />}

      {appMode === 'manager' && <ManagerStation snapshot={metrics.executiveSnapshot} onExit={() => setAppMode('wake')} onOpenAnalyst={() => setAppMode('analyst')} />}
      {appMode === 'analyst' && (
        <Suspense fallback={(
          <div className="loading-wrapper">
            <div className="loading-text">CARREGANDO CONSOLE DO ANALISTA</div>
            <div className="loading-bar"></div>
          </div>
        )}>
          <AnalystStation snapshot={metrics.executiveSnapshot} onExit={() => setAppMode('manager')} />
        </Suspense>
      )}
    </>
  );
}

export default App;
