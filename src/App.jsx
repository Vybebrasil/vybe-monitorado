import React, { useState, useEffect } from 'react';
import { ShieldAlert, Cpu, Activity, Clock, Layers, AlertTriangle, Target, CheckCircle2, RefreshCw, ExternalLink, Info, Power, TerminalSquare, PieChart as PieChartIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Cell, PieChart, Pie } from 'recharts';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
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

const activateOnKeyboard = (event, callback) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
};

function ExecutiveCockpit({ metrics, detailPanel, setDetailPanel, externalDetailPanel, forceRenderDrawer }) {
  const safeSnapshot = metrics || {};
  const summary = safeSnapshot.summary || {};
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

  const capacityDecision = safeSnapshot.decisionsNeeded?.find(d => d.id === 'decision-capacity');
  const ownerDelaysData = (capacityDecision?.affectedItems || [])
    .map(item => {
      const match = item.match(/(.+?)\s*\((\d+)\s+atrasos?\)/);
      if (match) return { name: match[1], delays: parseInt(match[2], 10) };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.delays - a.delays);

  const volumeBreakdownData = Object.entries(quantitative.statusCounts || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const displayPct = value => value === null || value === undefined ? '—' : `${value}%`;
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showAllClientRisks, setShowAllClientRisks] = useState(false);
  const delayDetails = safeSnapshot.delayDetails || [];
  const productivity = safeSnapshot.productivity || {};
  const internalDelayDetails = delayDetails.filter(item => item.delayType?.includes('prazo interno'));
  const stageRows = productivity.byStage || [];
  const topResponsibles = productivity.topResponsibles || [];
  const visibleClientRows = showAllClientRisks ? clientRows : clientRows.slice(0, 5);

  const chartData = [
    { name: 'Saudável', value: stability.score || 0 },
    { name: 'Em Risco', value: 100 - (stability.score || 0) }
  ];
  
  const isHealthy = (stability.score || 0) > 70;
  const chartColors = [
    isHealthy ? 'var(--cy-neon-green)' : 'rgba(255,255,255,0.05)',
    !isHealthy ? stabilityColor : 'rgba(255,255,255,0.05)'
  ];

  const customTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(10,10,10,0.9)', border: '1px solid #333', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.8rem', color: '#fff', backdropFilter: 'blur(10px)' }}>
          <p style={{ margin: 0 }}>{payload[0].payload.name || payload[0].payload.stage || payload[0].payload.label}</p>
          <p style={{ margin: 0, fontWeight: 'bold', color: payload[0].fill || 'var(--cy-neon-cyan)' }}>{payload[0].value} itens</p>
        </div>
      );
    }
    return null;
  };

  const activePanel = forceRenderDrawer ? externalDetailPanel : detailPanel;
  const selectedDetails = activePanel?.type === 'client'
    ? delayDetails.filter(item => item.client === activePanel.client)
    : activePanel?.type === 'delays' ? internalDelayDetails
    : activePanel?.type === 'owner' ? delayDetails.filter(item => item.responsavel?.includes(activePanel.owner) && item.delayType?.includes('prazo interno'))
    : activePanel?.type === 'planning' ? (safeSnapshot.executiveRisks?.find(r => r.id === 'portfolio-planning-gap')?.affectedItems || []).map((client, i) => ({ id: `plan-${i}`, name: 'Falta planejamento estratégico', client, delayType: 'Risco de Prontidão' }))
    : [];

  if (forceRenderDrawer) {
    return (
      <div className="executive-detail-list">
        {selectedDetails.map(item => (
          <article className="executive-detail-item" key={`${item.id}-${item.delayType}`}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.client} {item.stage ? `· ${item.stage}` : ''} {item.status ? `· ${item.status}` : ''}</span>
            </div>
            <div className="executive-detail-meta">
              <span className="badge-alert">{item.delayType}</span>
              {item.daysOverdue !== undefined && <span>{item.daysOverdue} dia(s) de atraso</span>}
              {item.prazo && <span>Prazo: {formatDate(item.prazo)}</span>}
              {item.responsavel && <span>Responsável: {item.responsavel}</span>}
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <section className="executive-cockpit card" aria-labelledby="executive-cockpit-title">
      <div className="executive-cockpit-header">
        <div>
          <div className="executive-kicker"><Target size={15} /> COMMAND LAYER · LIDERANÇA EXECUTIVA</div>
          <h2 id="executive-cockpit-title">COCKPIT DE COMANDO E DECISÃO</h2>
          <p>{activeLens.question}</p>
        </div>
      </div>

      <div className="executive-tabs-container">
        <button type="button" className={`executive-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <AlertTriangle size={14} /> Comando Executivo
        </button>
        <button type="button" className={`executive-tab ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>
          <Target size={14} /> Clientes & Relacionamento
        </button>
        <button type="button" className={`executive-tab ${activeTab === 'bottlenecks' ? 'active' : ''}`} onClick={() => setActiveTab('bottlenecks')}>
          <RefreshCw size={14} /> Operação & Auditoria
        </button>
      </div>

      <div className="executive-tab-content fade-in">
        {activeTab === 'overview' && (
          <>
            <div className="executive-summary-grid">
              <button type="button" className="executive-summary-card executive-interactive-card interactive-glow" onClick={() => setDetailPanel({ type: 'math', title: 'Auditoria de Estabilidade' })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--cy-neon-cyan)' }}>ESTABILIDADE DA CARTEIRA</span>
                    <strong style={{ color: stabilityColor }}>{stability.score ?? '—'}%</strong>
                  </div>
                  <div style={{ width: '100px', height: '100px', marginRight: '-10px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} innerRadius={35} outerRadius={48} dataKey="value" stroke="none">
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </button>
              <div className="executive-summary-card interactive-glow">
                <span>VOLUME OPERACIONAL</span>
                <strong>{quantitative.activeItems ?? summary.openItems ?? 0}</strong>
              </div>
              <button type="button" className="executive-summary-card executive-interactive-card interactive-glow" onClick={() => setDetailPanel({ type: 'delays', title: 'Atrasos internos' })}>
                <span style={{ color: 'var(--cy-neon-yellow)' }}>ATRASOS (INT VS EXT)</span>
                <strong style={{ color: 'var(--cy-neon-yellow)' }}>{quantitative.overdueInternal ?? summary.delayedTeam ?? 0} <span style={{fontSize:'1.2rem', color: 'var(--cy-neon-magenta)'}}>vs {quantitative.overduePublication ?? summary.delayedClient ?? 0}</span></strong>
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function JarvisInterface({ metrics, setDetailPanel }) {
  const safeSnapshot = metrics || {};
  const stability = safeSnapshot.portfolioStability || {};
  const quantitative = safeSnapshot.quantitative || {};
  const summary = safeSnapshot.summary || {};
  const readiness = safeSnapshot.portfolioReadiness || {};

  const delayedTotal = quantitative.overdueInternal ?? summary.delayedTeam ?? 0;
  const missingPlans = readiness.missingPlanning ?? 0;
  const pendingMeetings = (safeSnapshot.clientLogs || []).filter(c => c.healthScore?.score < 60).length;

  return (
    <div className="jarvis-container fade-in">
      <h1 className="jarvis-greeting">Status da Carteira</h1>
      <p className="jarvis-status">
        Estabilidade: <strong style={{ color: stability.score > 70 ? 'var(--cy-neon-green)' : 'var(--cy-neon-cyan)' }}>{stability.score ?? 0}%</strong>.
        Identifiquei <strong>{delayedTotal} gargalos</strong> e <strong>{missingPlans} planejamentos</strong> ausentes.
      </p>

      <div className="jarvis-actions">
        {delayedTotal > 0 && (
          <div className="jarvis-action-card critical" onClick={() => setDetailPanel({ type: 'delays', title: 'Atrasos de Produção', subtitle: 'Tarefas que venceram o prazo' })}>
            <h3>{delayedTotal} Gargalos Internos</h3>
            <button className="jarvis-action-btn">Neutralizar Atrasos</button>
          </div>
        )}
        <div className="jarvis-action-card" onClick={() => setDetailPanel({ type: 'math', title: 'Auditoria de Estabilidade' })}>
          <h3>Auditoria ({stability.score ?? 0}%)</h3>
          <button className="jarvis-action-btn">Abrir Inspeção</button>
        </div>
      </div>
    </div>
  );
}

function CommandCenter() {
  const [appMode, setAppMode] = useState(null); // null = splash, 'jarvis' = jarvis, 'analyst' = analyst
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanText, setScanText] = useState("Acessando servidores do Monday.com...");
  const [meta, setMeta] = useState(null);
  const [detailPanel, setDetailPanel] = useState(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError('');
    setScanText('Acessando servidores do Monday.com...');

    try {
      const metricsRes = await fetch('/api/dashboard/metrics');
      const metricsData = await metricsRes.json().catch(() => ({}));

      if (!metricsRes.ok || !metricsData.success) {
        throw new Error(`Command Center: ${metricsData.error || 'não foi possível carregar as métricas do Monday.com.'}`);
      }

      setScanText('Cruzando dados de clientes e reuniões...');
      const logsRes = await fetch('/api/dashboard/clients-logs');
      const logsData = await logsRes.json().catch(() => ({}));

      const combinedSnapshot = {
        ...metricsData.metrics.executiveSnapshot,
        clientLogs: logsData.success ? logsData.logs : []
      };

      setMetrics({ executiveSnapshot: combinedSnapshot });
      setMeta(metricsData.meta || null);
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

  if (loading) {
    return (
      <div className="loading-state fade-in" role="status" aria-label="Sincronizando dados">
        <Cpu className="pulse" size={32} color="var(--cy-neon-purple)" />
        <p className="loading-text" aria-live="polite">{scanText}</p>
        <div className="sync-progress"><span /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state fade-in" role="alert">
        <ShieldAlert size={40} color="var(--cy-neon-magenta)" />
        <div>
          <h2>CRITICAL: SINAL PERDIDO</h2>
          <p>{error}</p>
          <button type="button" onClick={loadMetrics} className="decision-see-more" style={{ marginTop: '1rem', border: '1px solid var(--cy-neon-magenta)', color: 'var(--cy-neon-magenta)' }}>TENTAR RECONEXÃO</button>
        </div>
      </div>
    );
  }

  // Splash Screen
  if (!appMode) {
    return (
      <div className="splash-screen fade-in">
        <div className="splash-title">
          <h1>NEXUS</h1>
          <p>Selecione a interface operacional</p>
        </div>

        <div className="splash-cards-container">
          <div className="mode-card jarvis" onClick={() => setAppMode('jarvis')}>
            <TerminalSquare className="mode-icon" />
            <h2>MODO JARVIS</h2>
            <p>Assistente C-Level. Uma interface gamificada em laranja e preto que converte milhares de dados em um briefing executivo claro. O foco é na ação imediata e resolução de gargalos, sem distrações analíticas.</p>
          </div>
          
          <div className="mode-card analyst" onClick={() => setAppMode('analyst')}>
            <PieChartIcon className="mode-icon" />
            <h2>MODO ANALISTA</h2>
            <p>A clássica Sala de Máquinas. Interface ciano e preta voltada para auditoria profunda, contendo funis operacionais, gráficos de barra e distribuição percentual detalhada de toda a carteira.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container fade-in ${appMode === 'jarvis' ? 'theme-jarvis' : 'theme-analyst'}`} style={{ minHeight: '100vh', padding: '1rem', background: 'var(--cy-bg)' }}>
      {/* HEADER DE MODO */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '0 1rem', borderBottom: '1px solid var(--cy-border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--cy-neon-cyan)' }}>
          <Activity size={18} />
          <strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: '2px', fontSize: '1rem' }}>VYBE NEXUS</strong>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" onClick={() => setAppMode('jarvis')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: appMode === 'jarvis' ? '#ff6600' : 'var(--cy-text-secondary)', fontWeight: appMode === 'jarvis' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TerminalSquare size={14} /> JARVIS
          </button>
          <button type="button" onClick={() => setAppMode('analyst')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: appMode === 'analyst' ? '#00f3ff' : 'var(--cy-text-secondary)', fontWeight: appMode === 'analyst' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChartIcon size={14} /> ANALISTA
          </button>
          <div style={{ width: '1px', background: 'var(--cy-border)', margin: '0 0.5rem' }}></div>
          <button type="button" onClick={() => setAppMode(null)} title="Sair" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--cy-text-secondary)' }}>
            <Power size={14} />
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      {appMode === 'jarvis' ? (
        <JarvisInterface metrics={metrics.executiveSnapshot} setDetailPanel={setDetailPanel} />
      ) : (
        <ExecutiveCockpit metrics={metrics.executiveSnapshot} detailPanel={detailPanel} setDetailPanel={setDetailPanel} />
      )}

      {/* DRAWER LATERAL (COMPARTILHADO PARA O JARVIS TAMBÉM) */}
      {detailPanel && appMode === 'jarvis' && (
        <div className="executive-drawer-overlay" onClick={() => setDetailPanel(null)}>
          <aside className="executive-drawer slide-in-right" aria-label="Detalhes executivos" onClick={e => e.stopPropagation()}>
            <div className="executive-drawer-header">
              <div>
                <div className="executive-mini-heading"><Info size={13} /> {detailPanel.title}</div>
                <p>{detailPanel.subtitle}</p>
              </div>
              <button type="button" className="executive-drawer-close" onClick={() => setDetailPanel(null)}>&times;</button>
            </div>
            
            <div className="executive-drawer-content">
              <ExecutiveCockpit metrics={metrics.executiveSnapshot} externalDetailPanel={detailPanel} forceRenderDrawer={true} setDetailPanel={setDetailPanel} />
            </div>
          </aside>
        </div>
      )}

      <footer className="footer-meta" style={{ marginTop: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--cy-text-secondary)', fontSize: '0.7rem' }}>
          CONFIDENCIAL: Liderança Vybe | {meta?.generatedAt ? new Date(meta.generatedAt).toLocaleString('pt-BR') : 'Tempo Real'}
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <div className="app-shell" style={{ minHeight: '100vh', backgroundColor: 'var(--cy-bg)' }}>
      <main className="app-main" style={{ minHeight: '100vh' }}>
        <CommandCenter />
      </main>
    </div>
  );
}

export default App;
