import React, { useState, useEffect } from 'react';
import { Activity, ServerCrash, Target, RefreshCw, AlertTriangle, Clock, ExternalLink, Info, CheckCircle2 } from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};


const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const PLACEHOLDER_MARKERS = [
  'um texto curto e direto relatando',
  'parágrafo forte, visão estratégica baseada',
  'nome do problema (baseado nos dados reais)',
  'fato comprovado que prova o problema',
  'por que isso é um problema?',
  'o que ganhamos ao resolver',
  'passo prático 1',
  'auditoria pendente',
  'análise ainda não validada'
];

const isPlaceholderText = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_MARKERS.some(marker => normalized.includes(marker));
};

const hasPendingAudit = (client) => {
  const intelligence = client?.businessIntelligence || {};
  const issueValues = (client?.channels || []).flatMap(channel =>
    (channel.issues || []).flatMap(issue => Object.values(issue))
  );
  return [intelligence.igStats, client?.cmoDirective, ...issueValues].some(isPlaceholderText);
};

const getValidAuditChannels = (client) => (client?.channels || [])
  .map(channel => ({
    ...channel,
    issues: (channel.issues || []).filter(issue => !Object.values(issue).some(isPlaceholderText))
  }))
  .filter(channel => channel.issues.length > 0);

const activateOnKeyboard = (event, callback) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
};



function SyncOverlay({ text }) {
  return (
    <div className="sync-overlay" role="status" aria-live="polite">
      <RefreshCw size={56} className="spin" style={{ marginBottom: '1.5rem', color: 'var(--cy-neon-purple)' }} />
      <div className="sync-kicker">LIVE DATA PIPELINE</div>
      <h1>SYNC</h1>
      <h2>SINCRONIZAÇÃO MONDAY.COM</h2>
      <p>{text || 'Consultando dados atuais...'}</p>
      <div className="sync-progress" aria-hidden="true"><span /></div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <ServerCrash size={34} color="var(--cy-neon-magenta)" />
      <div>
        <h2>FALHA NA SINCRONIZAÇÃO</h2>
        <p>{message || 'Não foi possível carregar os dados agora.'}</p>
      </div>
      <button type="button" className="retry-btn" onClick={onRetry}>
        <RefreshCw size={14} /> TENTAR NOVAMENTE
      </button>
    </div>
  );
}


function ExecutiveCockpit({ snapshot }) {
  const safeSnapshot = snapshot || {};
  const summary = safeSnapshot.summary || {};
  const snapshotSourceStatus = safeSnapshot.sourceStatus || (safeSnapshot.generatedAt || safeSnapshot.capturedAt ? 'live' : 'stale');
  const snapshotTimestamp = safeSnapshot.generatedAt || safeSnapshot.capturedAt;
  const stability = safeSnapshot.portfolioStability || {};
  const activeLens = safeSnapshot.executiveLens || {
    title: 'PAINEL EXECUTIVO',
    question: 'Qual decisão executiva precisa ser tomada agora?',
    focus: ['Previsibilidade da carteira', 'Risco de entrega e relacionamento', 'Capacidade e prontidão estratégica']
  };
  const risks = (safeSnapshot.executiveRisks || []).slice(0, 5);
  const decisions = (safeSnapshot.decisionsNeeded || []).slice(0, 3);
  const stabilityColor = stability.status === 'stable' ? 'var(--cy-neon-green)' : stability.status === 'attention' ? 'var(--cy-neon-yellow)' : 'var(--cy-neon-magenta)';
  const quantitative = safeSnapshot.quantitative || {};
  const readiness = safeSnapshot.portfolioReadiness || {};
  const clientRows = safeSnapshot.clientRanking || [];
  const statusRows = Object.entries(quantitative.statusCounts || {}).sort((a, b) => b[1] - a[1]);
  const displayPct = value => value === null || value === undefined ? '—' : `${value}%`;
  const [showAllClientRisks, setShowAllClientRisks] = useState(false);
  const visibleClientRows = showAllClientRisks ? clientRows : clientRows.slice(0, 5);

  return (
    <section className="executive-cockpit card" aria-labelledby="executive-cockpit-title">
      <div className="executive-cockpit-header">
        <div>
          <div className="executive-kicker"><Target size={15} /> COMMAND LAYER · LIDERANÇA EXECUTIVA</div>
          <h2 id="executive-cockpit-title">COCKPIT DE COMANDO E DECISÃO</h2>
          <p>{activeLens.question}</p>
        </div>

      </div>

      <div className="executive-lens-context">
        <strong>{activeLens.title}</strong>
        <span>{activeLens.focus.join(' · ')}</span>
      </div>

      <div className="executive-summary-grid">
        <div className="executive-summary-card stability" style={{ '--signal-color': stabilityColor }}>
          <span>ESTABILIDADE · PROXY</span>
          <strong>{stability.score ?? '—'}%</strong>
          <small>{stability.label || 'Aguardando dados'}</small>
        </div>
        <div className="executive-summary-card">
          <span>ITENS ATIVOS</span>
          <strong>{quantitative.activeItems ?? summary.openItems ?? 0}</strong>
          <small>{quantitative.completedItems ?? 0} concluídos · {displayPct(quantitative.activePct)} do recorte</small>
        </div>
        <div className="executive-summary-card">
          <span>ATRASOS INTERNOS</span>
          <strong>{quantitative.overdueInternal ?? summary.delayedTeam ?? 0}</strong>
          <small>{displayPct(quantitative.overdueInternalPctOfActive)} dos itens ativos com prazo vencido</small>
        </div>
        <div className="executive-summary-card">
          <span>FONTE · {snapshotSourceStatus === 'live' ? 'LIVE' : 'STALE'}</span>
          <strong className="executive-source">{safeSnapshot.source || 'Monday.com'}</strong>
          <small>Atualizado {formatDateTime(snapshotTimestamp)}</small>
        </div>
      </div>

      <div className="executive-metrics-panel" aria-label="Métricas quantitativas da carteira">
        <div className="executive-metrics-heading"><Activity size={15} /><span>MÉTRICAS DE CARTEIRA</span><small>{quantitative.totalItems || 0} itens no recorte lido</small></div>
        <div className="executive-metrics-grid">
          <div className="executive-metric-card"><span>VEICULAÇÃO COM DATA</span><strong>{displayPct(quantitative.publicationDateCoveragePct)}</strong><small>{quantitative.itemsWithPublicationDate || 0} itens com data de publicação</small></div>
          <div className="executive-metric-card"><span>PRAZO INTERNO PREENCHIDO</span><strong>{displayPct(quantitative.internalDeadlineCoveragePct)}</strong><small>{quantitative.itemsWithInternalDeadline || 0} itens com prazo interno</small></div>
          <div className="executive-metric-card"><span>VENCIMENTO EM 7 DIAS</span><strong>{quantitative.dueWithin7Internal ?? 0}</strong><small>{quantitative.dueWithin7Publication ?? 0} com veiculação prevista</small></div>
          <div className="executive-metric-card"><span>PRIORIDADE CLASSIFICADA</span><strong>{displayPct(quantitative.priorityCoveragePct)}</strong><small>qualidade do dado executivo</small></div>
          <div className="executive-metric-card"><span>PLANEJAMENTO DA CARTEIRA</span><strong>{displayPct(readiness.planningCoveragePct)}</strong><small>{readiness.missingPlanning ?? 0} clientes sem planejamento · base de {readiness.eligibleClients ?? 0}</small></div>
          <div className="executive-metric-card"><span>DASHBOARD ATUALIZADO</span><strong>{displayPct(readiness.dashboardCoveragePct)}</strong><small>{readiness.missingDashboard ?? 0} pendentes · base de {readiness.eligibleClients ?? 0}</small></div>
        </div>
        <div className="executive-metrics-columns">
          <div>
            <div className="executive-mini-heading"><Clock size={13} /> COMPOSIÇÃO DO RECORTE</div>
            <div className="executive-status-list">{statusRows.slice(0, 5).map(([label, count]) => <div className="executive-status-row" key={label}><span>{label}</span><b>{count}</b><i><em style={{ width: `${Math.min(100, ((count / (quantitative.totalItems || 1)) * 100))}%`, background: quantitative.statusColors?.[label] || 'var(--cy-neon-cyan)' }} /></i><small>{displayPct(Number(((count / (quantitative.totalItems || 1)) * 100).toFixed(1)))}</small></div>)}</div>
          </div>
          <div>
            <div className="executive-mini-heading"><AlertTriangle size={13} /> CLIENTES COM MAIOR EXPOSIÇÃO</div>
            <div className="executive-client-risk-list">{visibleClientRows.map(row => <div className="executive-client-risk-row" key={row.client}><div><strong>{row.client}</strong><small>{row.openItems} abertos · {row.internalDelays} internos · {row.publicationDelays} veiculação</small></div><b>{row.delayedItems} <small>{displayPct(row.riskPct)}</small></b></div>)}</div>
            {clientRows.length > 5 && <button type="button" className="decision-see-more" onClick={() => setShowAllClientRisks(current => !current)}>{showAllClientRisks ? 'MOSTRAR MENOS' : `VER MAIS (${clientRows.length - 5})`}</button>}
          </div>
        </div>
        <small className="executive-methodology"><Info size={12} /> {safeSnapshot.methodology?.note || 'Percentuais são calculados sobre o recorte lido do Monday e não substituem indicadores financeiros ou de satisfação.'}</small>
      </div>

      <div className="executive-columns">
        <div className="executive-block">
          <div className="executive-block-heading"><AlertTriangle size={15} /><span>SINAIS QUE MERECEM DECISÃO</span></div>
          {risks.length > 0 ? risks.map(risk => (
            <article className={`executive-risk ${risk.severity || 'medium'}`} key={risk.id}>
              <div className="executive-risk-top"><span className="executive-risk-severity">{risk.severityLabel || risk.severity}</span><span>{risk.ownerRole}</span></div>
              <strong>{risk.title}</strong>
              <p>{risk.whyItMatters}</p>
              <div className="executive-risk-action"><b>DECISÃO:</b> {risk.recommendedDecision}</div>
              {risk.evidence?.[0]?.url && <a href={risk.evidence[0].url} target="_blank" rel="noreferrer" className="executive-evidence-link"><ExternalLink size={12} /> Ver evidência operacional</a>}
            </article>
          )) : <div className="executive-empty">Nenhum sinal executivo nesta lente.</div>}
        </div>

        <div className="executive-block decisions">
          <div className="executive-block-heading"><CheckCircle2 size={15} /><span>AGENDA DE LIDERANÇA</span></div>
          {decisions.length > 0 ? decisions.map(decision => (
            <article className="executive-decision" key={decision.id}>
              <span className="executive-decision-priority">{decision.priority || 'ATENÇÃO'}</span>
              <strong>{decision.title}</strong>
              <p>{decision.context}</p>
              <small>Responsável executivo: {decision.ownerRole}</small>
            </article>
          )) : <div className="executive-empty">Nenhuma decisão pendente nesta lente.</div>}
        </div>
      </div>

      <p className="executive-disclaimer"><Info size={13} /> {stability.explanation || 'Os sinais são uma camada interpretativa sobre fontes operacionais e devem ser validados pela liderança.'}</p>
    </section>
  );
}

function CommandCenter() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanText, setScanText] = useState("Consultando dados atuais do Monday.com...");
  const [meta, setMeta] = useState(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError('');
    setScanText('Consultando dados atuais do Monday.com...');

    try {
      const response = await fetch('/api/dashboard/metrics');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(`Command Center: ${data.error || 'não foi possível carregar as métricas do Monday.com.'}`);
      }
      setMetrics(data.metrics);
      setMeta(data.meta || null);
      setScanText('Sincronização concluída.');
    } catch (err) {
      setError(err.message || 'Erro de conexão com a API do Command Center.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);



  if (loading) return <SyncOverlay text={scanText} />;

  if (error) return <ErrorState message={error} onRetry={loadMetrics} />;

  return (
    <div className="container" style={{ padding: '2rem' }}>
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>VYBE <span className="glitch-text" style={{color: 'var(--cy-neon-purple)'}}>NEXUS</span></h1>
          <p style={{fontFamily: 'var(--font-mono)', marginTop: '0.5rem', color: 'var(--cy-text-secondary)'}}>
            COCKPIT DE COMANDO E DECISÃO - LIDERANÇA EXECUTIVA
          </p>
        </div>
        <div className="header-meta">
          <span className="header-badge" style={{borderColor: 'var(--cy-neon-purple)', color: 'var(--cy-neon-purple)'}}>COMMAND_LAYER</span>
          <span className="sync-meta" aria-live="polite">{meta?.source || 'Monday.com'} · {meta?.generatedAt ? `ATUALIZADO ${formatDateTime(meta.generatedAt)}` : 'ATUALIZAÇÃO RECENTE'}</span>
        </div>
      </header>

      <ExecutiveCockpit snapshot={metrics.executiveSnapshot} />
    </div>
  );
}

function App() {
  return (
    <div className="app-shell" style={{ minHeight: '100vh', backgroundColor: 'var(--cy-bg)' }}>
      <main className="app-main" style={{ minHeight: '100vh', overflowY: 'auto' }}>
        <CommandCenter />
      </main>
    </div>
  );
}

export default App;
