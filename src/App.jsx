import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Target, Activity, ShieldAlert, Crosshair, X, Info } from 'lucide-react';

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
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [showAllClients, setShowAllClients] = useState(false);

  const delayDetails = snapshot.delayDetails || [];
  
  // Concentração de atrasos por responsável; não é ranking de produtividade.
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

  return (
    <div className="animate-fade" style={{ minHeight: '100vh' }}>
      <header className="app-header">
        <div className="app-header-title">
          <Target size={28} /> JARVIS / GUIA EXECUTIVO <span className="badge">GUIADO</span>
        </div>
        <div className="app-header-meta">
          <span>PASSO 1 · RISCO, CAPACIDADE E DECISÃO</span>
          <button onClick={onExit}>&larr; VOLTAR AO INÍCIO</button>
        </div>
      </header>

      <div className="jarvis-command-strip"><span>PRÓXIMO COMANDO</span><strong>{nextCommand}</strong><small>Selecione uma linha para abrir evidências; nada nesta estação altera o Monday.</small></div>

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
                    () => setDetailPanel({ type: 'owner', id: person.id, title: `Gargalos: ${person.name}` }),
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
                      () => setDetailPanel({ type: 'client', id: c.client, title: `Evidências: ${c.client}` }),
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

      <DetailDrawer panel={detailPanel} setPanel={setDetailPanel} delayDetails={delayDetails} />
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
  const stabilityLabel = snapshot?.portfolioStability?.label || (stability === null ? 'SEM SCORE' : 'LEITURA EXECUTIVA');
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
  const guidedSteps = [
    { number: '01', title: 'Estado da carteira', text: `${stability === null ? 'N/D' : `${stability}%`} de estabilidade operacional · ${stabilityLabel.toLowerCase()}` },
    { number: '02', title: 'O que mudou', text: `${overdue} atraso(s) interno(s), ${clientRisks} cliente(s) exposto(s) e ${decisions} decisão(ões) sugerida(s).` },
    { number: '03', title: 'Próximo comando', text: stalled > 0 ? 'Investigar clientes sem sinal de execução.' : overdue > 0 ? 'Abrir a concentração de atrasos e decidir a resposta.' : 'Entrar no Analista para investigar a carteira.' }
  ];

  return (
    <div className="jarvis-home splash-container animate-fade">
      <HudHeader title="JARVIS / LIDERANÇA EXECUTIVA" subtitle="LINK ESTÁVEL // MONDAY.COM AO VIVO" />
      <main className="jarvis-home-main">
        <div className="jarvis-eyebrow"><Target size={15} /> COMANDO EXECUTIVO UNIFICADO <span>CMO / COO · UMA LIDERANÇA</span></div>
        <h2>{getGreeting()}, liderança.</h2>
        <h1>O que merece sua atenção agora?</h1>
        <p className="jarvis-intro">Eu organizei a leitura da carteira para você. Primeiro mostramos o sinal mais importante; depois abrimos a evidência e a decisão recomendada.</p>
        <section className={`jarvis-priority-card ${priorityClass}`}>
          <div className="jarvis-priority-top"><span>PRIORIDADE SUGERIDA</span><strong>{stabilityLabel}</strong></div>
          <h3>{firstPriority}</h3>
          <p>Não é uma ordem automática nem altera o Monday. É a sequência mais útil para iniciar a conversa executiva.</p>
        </section>
        <div className="jarvis-actions">
          <button type="button" className="jarvis-primary-action" onClick={onOpenJarvis}><Target size={18} /> ENTRAR NO JARVIS <span>GUIAR-ME</span></button>
          <button type="button" className="jarvis-secondary-action" onClick={onOpenAnalyst}><Activity size={18} /> ABRIR ANALISTA <span>INVESTIGAR POR CONTA PRÓPRIA</span></button>
        </div>
        <section className="jarvis-guided-steps" aria-label="Roteiro de leitura do Jarvis">
          {guidedSteps.map(step => <div className="jarvis-guided-step" key={step.number}><span>{step.number}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></div>)}
        </section>
        <div className="jarvis-mode-note"><Info size={13} /> O JARVIS conduz. O ANALISTA investiga. Nenhum dos dois altera status, cria demanda ou substitui o Vybe Painel.</div>
      </main>
      <HudFooter snapshot={snapshot} contextLabel="JARVIS / GUIA EXECUTIVO" />
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

      {!appMode && <JarvisHome snapshot={metrics.executiveSnapshot} onOpenJarvis={() => setAppMode('manager')} onOpenAnalyst={() => setAppMode('analyst')} />}

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
