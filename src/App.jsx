import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Target, Activity, ShieldAlert, Crosshair, X } from 'lucide-react';

// Carregada sob demanda: só ela usa Recharts, que responde pela maior parte do bundle.
const AnalystStation = lazy(() => import('./stations/AnalystStation.jsx'));

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  // A data vem do Monday como dia puro (YYYY-MM-DD) e é lida como UTC:
  // sem timeZone: 'UTC' a formatação recua um dia em qualquer fuso a oeste.
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
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

const HudFooter = ({ snapshot }) => {
  const stability = snapshot?.portfolioStability?.score ?? 0;
  // O corte é do domínio (stable / attention / risk), não um número solto na UI.
  const stabilityStatus = snapshot?.portfolioStability?.status;
  const overdueInternal = snapshot?.quantitative?.overdueInternal ?? 0;
  const stalled = snapshot?.portfolioExecution?.stalled?.length ?? 0;

  return (
    <div className="hud-bar bottom">
      <div>SELECIONE UMA ESTAÇÃO PARA INICIAR</div>
      <div className="hud-telemetry">
        <div className={`telemetry-box ${stabilityStatus === 'risk' ? 'alert' : stabilityStatus === 'attention' ? 'warning' : ''}`}>
          <span className="telemetry-val">{stability}%</span>
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

const DetailDrawer = ({ panel, setPanel, delayDetails }) => {
  useEffect(() => {
    if (!panel) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, setPanel]);

  if (!panel) return null;

  let list = [];
  if (panel.type === 'owner') {
    list = delayDetails.filter(d => splitOwners(d.responsavel).includes(panel.id));
  } else if (panel.type === 'client') {
    list = delayDetails.filter(d => d.client === panel.id);
  }

  // Sort list by days overdue if available
  list = list.slice().sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));

  return (
    <div className="drawer-overlay" onClick={() => setPanel(null)}>
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>{panel.title}</h3>
            <p>DETALHAMENTO DE AUDITORIA</p>
          </div>
          <button className="drawer-close" onClick={() => setPanel(null)}><X size={32} /></button>
        </div>
        <div className="drawer-content">
          {list.length === 0 ? (
            <div style={{ color: 'var(--vybe-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>Nenhum item isolado encontrado.</div>
          ) : (
            <ul className="data-list">
              {list.map((item, i) => (
                <li key={i} className="data-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="item-primary">{item.name}</span>
                    <span className={`item-meta ${item.daysOverdue > 0 ? 'critical' : ''}`}>
                      {item.daysOverdue ? `ATRASO: ${item.daysOverdue}D` : 'EM ANDAMENTO'}
                    </span>
                  </div>
                  <div className="item-sub" style={{ marginTop: '0.8rem', display: 'flex', gap: '1rem', fontFamily: 'var(--font-mono)' }}>
                    <span>CLIENTE: {item.client}</span>
                    <span>PRAZO: {formatDate(item.prazo)}</span>
                    {item.responsavel && <span>RESP: {item.responsavel}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};


// --- ESTAÇÕES DE TRABALHO ---

function ManagerStation({ snapshot, onExit }) {
  const [detailPanel, setDetailPanel] = useState(null);

  const delayDetails = snapshot.delayDetails || [];
  
  // Logic 1: Top Ofensores (Equipe)
  // Cruzando productivity top responsibles e filtrando apenas atrasos internos
  const internalDelays = delayDetails.filter(d => d.delayType?.includes('prazo interno'));
  const blameMap = {};
  internalDelays.forEach(d => {
    // `responsavel` vem do Monday como lista separada por vírgula.
    splitOwners(d.responsavel).forEach(name => {
      blameMap[name] = (blameMap[name] || 0) + 1;
    });
  });
  const topBlame = Object.entries(blameMap)
    .map(([name, count]) => ({ id: name, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Logic 2: Piores Clientes (maior % de itens atrasados sobre itens abertos)
  const clientRanking = snapshot.clientRanking || [];
  const worstClients = clientRanking
    .filter(c => (c.riskPct || 0) > 0)
    .sort((a, b) => (b.riskPct || 0) - (a.riskPct || 0))
    .slice(0, 5);

  // Logic 3: Clientes ativos sem nada em execução — risco de churn silencioso.
  const execution = snapshot.portfolioExecution || {};
  const stalledClients = execution.stalled || [];
  const onboardingClients = execution.onboarding || [];

  return (
    <div className="animate-fade" style={{ minHeight: '100vh' }}>
      <header className="app-header">
        <div className="app-header-title">
          <Target size={28} /> MATRIZ EXECUTIVA <span className="badge">GESTOR</span>
        </div>
        <div className="app-header-meta">
          <span>ALVO: RISCO E CAPACIDADE</span>
          <button onClick={onExit}>&times; ENCERRAR SESSÃO</button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* COLUNA ESQUERDA - ALERTAS DIRETOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="data-panel animate-slide delay-1">
            <div className="data-panel-title">OFENSORES DE CAPACIDADE (EQUIPE)</div>
            <ul className="data-list">
              {topBlame.length === 0 ? <li className="item-sub">Nenhum atraso interno mapeado.</li> : null}
              {topBlame.map(person => (
                <li
                  key={person.id}
                  className="data-list-item"
                  {...clickable(
                    () => setDetailPanel({ type: 'owner', id: person.id, title: `Gargalos: ${person.name}` }),
                    `Ver os ${person.count} atrasos de ${person.name}`
                  )}
                >
                  <div>
                    <div className="item-primary">{person.name}</div>
                    <div className="item-sub">Represando fluxo operacional</div>
                  </div>
                  <div className="item-meta critical">{person.count} ATRASOS</div>
                </li>
              ))}
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
                    () => setDetailPanel({ type: 'client', id: item.client, title: `Visão: ${item.client}` }),
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
          <div className="data-panel-title">CONTAS EM RISCO CRÍTICO (CHURN ALERT)</div>
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
                {worstClients.map(c => (
                  <tr
                    key={c.client}
                    style={{ cursor: 'pointer' }}
                    {...clickable(
                      () => setDetailPanel({ type: 'client', id: c.client, title: `Dossiê: ${c.client}` }),
                      `Abrir dossiê de ${c.client}`
                    )}
                  >
                    <td className="item-primary" style={{ color: 'var(--vybe-orange)' }}>{c.client}</td>
                    <td>
                      <span className={`badge ${c.riskPct >= 40 ? 'red' : c.riskPct >= 20 ? 'orange' : 'green'}`}>
                        {c.riskPct ?? 0}% ({c.delayedItems}/{c.openItems})
                      </span>
                    </td>
                    <td>{c.internalDelays} gargalos</td>
                    <td>{c.publicationDelays} pendências</td>
                    <td>
                      <span className="item-meta">{c.riskPct >= 40 ? 'CRÍTICO' : 'ATENÇÃO'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DetailDrawer panel={detailPanel} setPanel={setDetailPanel} delayDetails={delayDetails} />
    </div>
  );
}


// --- MAIN APP ---

function App() {
  const [appMode, setAppMode] = useState(null); // null = splash, 'manager' = jarvis, 'analyst' = analyst
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

      {!appMode && (
        <div className="splash-container animate-fade">
          <HudHeader title="IDENTIFICAÇÃO DE ESTAÇÃO" subtitle="CENTRAL OPERACIONAL // PRONTA" />
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="splash-titles animate-slide delay-1">
              <h2>VYBE OS</h2>
              <h1>Qual estação você vai operar?</h1>
              <p>// LINK ESTÁVEL<br />Seu contexto ajusta a fila, os comandos e a inteligência que entra em cena.</p>
            </div>

            <div className="stations-layout animate-slide delay-2">
              <div className="station-card" {...clickable(() => setAppMode('manager'), 'Iniciar a estação Jarvis')}>
                <div className="card-header">
                  <span>01 / INTELIGÊNCIA EXECUTIVA</span>
                  <span style={{ color: 'var(--vybe-gold)' }}>&#9679; ONLINE</span>
                </div>
                <Target className="card-icon" />
                <h3>JARVIS</h3>
                <p>Toda a operação em uma linha de visão. Prioriza risco, capacidade e decisões da equipe.</p>
                
                <div className="card-tags">
                  <span className="tag">RISCO</span>
                  <span className="tag">CAPACIDADE</span>
                  <span className="tag">DECISÃO</span>
                </div>

                <div className="card-action">INICIAR JARVIS &rarr;</div>
              </div>

              <div className="core-link"></div>
              <div className="core-sphere">V</div>
              <div className="core-link"></div>

              <div className="station-card analyst" {...clickable(() => setAppMode('analyst'), 'Iniciar a estação Analista')}>
                <div className="card-header">
                  <span>02 / OPERAÇÃO DE DADOS</span>
                  <span style={{ color: 'var(--vybe-cyan)' }}>&#9679; ONLINE</span>
                </div>
                <Activity className="card-icon" />
                <h3>ANALISTA</h3>
                <p>Sua fila de execução completa, vazão do funil de produção e tabela crua de auditoria.</p>
                
                <div className="card-tags">
                  <span className="tag">FUNIL</span>
                  <span className="tag">PRAZOS</span>
                  <span className="tag">RAW DATA</span>
                </div>

                <div className="card-action">INICIAR ANALISTA &rarr;</div>
                <div className="card-cross-btm"></div>
              </div>
            </div>
          </div>

          <HudFooter snapshot={metrics.executiveSnapshot} />
        </div>
      )}

      {appMode === 'manager' && <ManagerStation snapshot={metrics.executiveSnapshot} onExit={() => setAppMode(null)} />}
      {appMode === 'analyst' && (
        <Suspense fallback={(
          <div className="loading-wrapper">
            <div className="loading-text">CARREGANDO CONSOLE DO ANALISTA</div>
            <div className="loading-bar"></div>
          </div>
        )}>
          <AnalystStation snapshot={metrics.executiveSnapshot} onExit={() => setAppMode(null)} />
        </Suspense>
      )}
    </>
  );
}

export default App;
