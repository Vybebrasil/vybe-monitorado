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

const mondayItemUrl = (id) => id ? `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${id}` : null;

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
                  return (
                    <li key={item.id || i} className="investigation-evidence-item">
                      <div className="investigation-evidence-top"><strong>{item.name}</strong><span className="item-meta critical">{item.daysOverdue ? `ATRASO: ${item.daysOverdue}D` : 'EM ANDAMENTO'}</span></div>
                      <div className="investigation-evidence-meta"><span>{item.client}</span><span>{item.stage || 'Etapa não informada'}</span><span>{item.delayType || 'Atraso não classificado'}</span></div>
                      <div className="investigation-evidence-meta"><span>Prazo: {formatDate(item.prazo)}</span><span>Veiculação: {formatDate(item.veiculacao)}</span><span>Resp.: {item.responsavel || 'N/D'}</span></div>
                      {item.editorDesigner && <div className="investigation-evidence-meta"><span>Editor/Designer: {item.editorDesigner}</span></div>}
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
