import React, { useState, useEffect, useRef } from 'react';
import { Activity, ServerCrash, Target, RefreshCw, AlertTriangle, Clock, ExternalLink, Info, CheckCircle2, Layers, Zap, Calendar, PlusCircle, AlertOctagon, ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell as BarCell, CartesianGrid, Legend } from 'recharts';

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
  const strategic = safeSnapshot.payload?.strategic || {};
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

  const clientDeliveryRisk = safeSnapshot.executiveRisks?.find(d => d.id === 'client-delivery-risk');
  const clientDelaysData = (clientDeliveryRisk?.affectedItems || [])
    .map(item => {
      const match = item.match(/(.+?)\s*\((\d+)\s+atrasos?\)/);
      if (match) return { name: match[1], delays: parseInt(match[2], 10) };
      return null;
    })
    .filter(Boolean);

  const volumeBreakdownData = Object.entries(quantitative.statusCounts || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const displayPct = value => value === null || value === undefined ? '—' : `${value}%`;
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showAllClientRisks, setShowAllClientRisks] = useState(false);
  const [detailPanel, setDetailPanel] = useState(null);
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
  
  // Se a estabilidade estiver baixa, o "Risco" que ganha a cor de alerta.
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
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: '#888' }}>Clique na barra para investigar</p>
        </div>
      );
    }
    return null;
  };
  const selectedDetails = detailPanel?.type === 'client'
    ? delayDetails.filter(item => item.client === detailPanel.client)
    : detailPanel?.type === 'delays' ? internalDelayDetails
    : detailPanel?.type === 'owner' ? delayDetails.filter(item => item.responsavel?.includes(detailPanel.owner) && item.delayType?.includes('prazo interno'))
    : detailPanel?.type === 'planning' ? (safeSnapshot.executiveRisks?.find(r => r.id === 'portfolio-planning-gap')?.affectedItems || []).map((client, i) => ({ id: `plan-${i}`, name: 'Falta planejamento estratégico', client, delayType: 'Risco de Prontidão' }))
    : [];
  const closeDetailPanel = () => setDetailPanel(null);

  // Fecha o drawer com tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && detailPanel) closeDetailPanel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailPanel]);

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
              <button type="button" className="executive-summary-card executive-interactive-card interactive-glow" style={{ gridColumn: 'span 1' }} onClick={() => setDetailPanel({ type: 'math', title: 'Auditoria de Estabilidade', subtitle: 'Fórmula de cálculo baseada em penalidades operacionais' })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--cy-neon-cyan)' }}>ESTABILIDADE DA CARTEIRA <Info size={11} /></span>
                    <strong style={{ color: stabilityColor }}>{stability.score ?? '—'}%</strong>
                    <small>CLIQUE P/ VER O CÁLCULO</small>
                  </div>
                  <div style={{ width: '100px', height: '100px', marginRight: '-10px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} innerRadius={35} outerRadius={48} dataKey="value" stroke="none" paddingAngle={0}>
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                        </Pie>
                        <RechartsTooltip content={customTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </button>
              <div className="executive-summary-card interactive-glow" title="Total de itens ativos encontrados no painel do Monday para esta carteira.">
                <span>VOLUME OPERACIONAL <Info size={11} /></span>
                <strong>{quantitative.activeItems ?? summary.openItems ?? 0}</strong>
                <small>{quantitative.completedItems ?? 0} concluídos · {displayPct(quantitative.activePct)} do recorte</small>
              </div>
              <button type="button" className="executive-summary-card executive-interactive-card interactive-glow" onClick={() => setDetailPanel({ type: 'delays', title: 'Atrasos internos', subtitle: 'Itens ativos com prazo interno vencido' })}>
                <span style={{ color: 'var(--cy-neon-yellow)' }}>ATRASOS (INT VS EXT)</span>
                <strong style={{ color: 'var(--cy-neon-yellow)' }}>{quantitative.overdueInternal ?? summary.delayedTeam ?? 0} <span style={{fontSize:'1.2rem', color: 'var(--cy-neon-magenta)'}}>vs {quantitative.overduePublication ?? summary.delayedClient ?? 0}</span></strong>
                <small>{displayPct(quantitative.overdueInternalPctOfActive)} da base · CLIQUE P/ INSPECIONAR</small>
              </button>
              <button type="button" className="executive-summary-card executive-interactive-card interactive-glow" onClick={() => setDetailPanel({ type: 'planning', title: 'Falta de Planejamento', subtitle: 'Clientes operando sem planejamento estratégico mapeado' })}>
                <span style={{ color: 'var(--cy-neon-magenta)' }}>PRONTIDÃO ESTRATÉGICA <Info size={11} /></span>
                <strong style={{ color: 'var(--cy-neon-magenta)' }}>{safeSnapshot.portfolioReadiness?.missingPlanning || 0}</strong>
                <small>CLIQUE PARA VER QUAIS CLIENTES</small>
              </button>
              <div className="executive-summary-card interactive-glow">
                <span>SAÚDE DA CARTEIRA</span>
                <strong style={{ color: 'var(--cy-neon-green)' }}>{clientRows.length > 0 ? clientRows.filter(c => c.delayedItems === 0).length : 0} <span style={{fontSize:'1.2rem', color: 'var(--cy-text-secondary)'}}>/ {clientRows.length || 0}</span></strong>
                <small>Clientes com zero risco de previsibilidade</small>
              </div>
            </div>

            {/* GRÁFICOS OPERACIONAIS */}
            <div className="executive-columns" style={{ marginTop: '1.25rem' }}>
              <div className="executive-block">
                <div className="executive-block-heading"><Activity size={16} /><span>GARGALOS DO TIME (CARGA X ATRASOS)</span></div>
                <div style={{ width: '100%', height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ownerDelaysData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="rgba(255,255,255,0.2)" fontSize={11} />
                      <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} width={100} tick={{fill: '#ccc'}} />
                      <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.04)'}} contentStyle={{ backgroundColor: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="delays" name="Atrasos" fill="var(--cy-neon-magenta)" radius={[0, 4, 4, 0]} barSize={16} onClick={(data) => setDetailPanel({ type: 'owner', owner: data.name, title: `Gargalos com ${data.name}`, subtitle: 'Itens com prazo interno vencido concentrados neste membro' })} style={{ cursor: 'pointer' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="executive-block">
                <div className="executive-block-heading"><Layers size={16} /><span>VOLUME POR ETAPA DE PRODUÇÃO</span></div>
                <div style={{ width: '100%', height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeBreakdownData} margin={{ top: 5, right: 10, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} angle={-35} textAnchor="end" height={60} interval={0} tick={{fill: '#aaa'}} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} />
                      <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.04)'}} contentStyle={{ backgroundColor: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Bar dataKey="value" name="Itens Ativos" fill="var(--cy-neon-cyan)" radius={[4, 4, 0, 0]} barSize={24} onClick={(data) => setDetailPanel({ type: 'stage', title: `Volume em: ${data.name}`, subtitle: 'Itens ativos nesta etapa (Agregado não exportado para drill-down no momento)' })} style={{ cursor: 'pointer' }}>
                        {volumeBreakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--cy-neon-cyan)' : 'rgba(0, 243, 255, 0.4)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="executive-columns" style={{ marginTop: '1.25rem' }}>
              <div className="executive-block">
                <div className="executive-block-heading"><AlertTriangle size={15} /><span>SINAIS QUE MERECEM DECISÃO</span></div>
                {risks.length > 0 ? risks.map(risk => (
                  <article className={`executive-risk ${risk.severity || 'medium'} ${risk.client ? 'executive-interactive-risk' : ''}`} key={risk.id} role={risk.client ? 'button' : undefined} tabIndex={risk.client ? 0 : undefined} title={risk.client ? `Clique para abrir os atrasos de ${risk.client}` : undefined} onClick={() => risk.client && setDetailPanel({ type: 'client', client: risk.client, title: risk.client, subtitle: 'Itens atrasados associados a este cliente' })} onKeyDown={event => risk.client && activateOnKeyboard(event, () => setDetailPanel({ type: 'client', client: risk.client, title: risk.client, subtitle: 'Itens atrasados associados a este cliente' }))}>
                    <div className="executive-risk-top"><span className="executive-risk-severity">{risk.severityLabel || risk.severity}</span><span>{risk.ownerRole}</span></div>
                    <strong>{risk.title}</strong>
                    <p>{risk.whyItMatters}</p>
                    <div className="executive-risk-action"><b>DECISÃO:</b> {risk.recommendedDecision}</div>
                    {risk.affectedItems && risk.affectedItems.length > 0 && (
                      <details className="executive-risk-details" onClick={e => e.stopPropagation()}>
                        <summary style={{ cursor: 'pointer', color: 'var(--cy-neon-yellow)', marginTop: '0.5rem', fontSize: '0.85rem' }}>Ver os {risk.affectedItems.length} sinais detalhados</summary>
                        <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.8rem', color: '#ccc' }}>
                          {risk.affectedItems.map((item, i) => <li key={i} style={{ marginBottom: '0.2rem' }}>{item}</li>)}
                        </ul>
                      </details>
                    )}
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
                    {decision.affectedItems && decision.affectedItems.length > 0 && (
                      <details className="executive-decision-details" onClick={e => e.stopPropagation()}>
                        <summary style={{ cursor: 'pointer', color: 'var(--cy-neon-purple)', marginTop: '0.5rem', fontSize: '0.85rem' }}>Ver clientes impactados ({decision.affectedItems.length})</summary>
                        <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.8rem', color: '#ccc' }}>
                          {decision.affectedItems.map((item, i) => <li key={i} style={{ marginBottom: '0.2rem' }}>{item}</li>)}
                        </ul>
                      </details>
                    )}
                  </article>
                )) : <div className="executive-empty">Nenhuma decisão pendente nesta lente.</div>}
              </div>
            </div>

            <div className="executive-metrics-panel" style={{ marginTop: '1.5rem' }}>
              <div className="executive-mini-heading"><AlertTriangle size={13} /> CLIENTES COM MAIOR EXPOSIÇÃO</div>
              <div className="executive-client-risk-list">{visibleClientRows.map(row => <button type="button" className="executive-client-risk-row executive-interactive-row" key={row.client} title={`Abrir detalhes dos atrasos de ${row.client}`} onClick={() => setDetailPanel({ type: 'client', client: row.client, title: row.client, subtitle: 'Itens atrasados associados a este cliente' })}><div><strong>{row.client}</strong><small>{row.openItems} abertos · {row.internalDelays} internos · {row.publicationDelays} veiculação</small></div><b>{row.delayedItems} <small>{displayPct(row.riskPct)}</small></b></button>)}</div>
              {clientRows.length > 5 && <button type="button" className="decision-see-more" onClick={() => setShowAllClientRisks(current => !current)}>{showAllClientRisks ? 'MOSTRAR MENOS' : `VER MAIS (${clientRows.length - 5})`}</button>}
            </div>
          </>
        )}

        {activeTab === 'bottlenecks' && (
          <>
            <div className="executive-productivity-panel" aria-label="Produtividade executiva" style={{ marginTop: 0 }}>
              <div className="executive-mini-heading"><Activity size={13} /> PRODUTIVIDADE EXECUTIVA <Info size={12} title="Leitura de fluxo e capacidade da carteira. Não é ranking individual de pessoas." /></div>
              <div className="executive-productivity-kpis">
                <div title="Percentual do recorte que já foi concluído no Monday."><strong>{displayPct(productivity.completionPct)}</strong><span>CONCLUÍDO NO RECORTE</span><small>{productivity.completedItems ?? 0} itens finalizados</small></div>
                <div title="Itens ativos prontos para agendamento ou já agendados."><strong>{productivity.readyToSchedule ?? 0}</strong><span>PRONTOS PARA SAÍDA</span><small>{displayPct(productivity.readyToSchedulePct)} dos ativos</small></div>
                <div className="executive-metric-critical" title="Itens ativos com atraso interno ou de veiculação."><strong>{productivity.delayedItems ?? quantitative.overdueInternal ?? 0}</strong><span>COM ATRASO</span><small>{displayPct(productivity.delayedPctOfActive ?? quantitative.overdueInternalPctOfActive)} dos ativos</small></div>
              </div>
              <div className="executive-productivity-columns">
                <div className="interactive-glow" style={{ padding: '1rem', background: 'var(--cy-surface)', border: '1px solid var(--cy-border)', borderRadius: '4px' }}>
                  <div className="executive-productivity-subheading" style={{ marginBottom: '1rem' }}>CARGA ATIVA POR ETAPA <Info size={11} title="Distribuição dos itens ativos por grupo do Monday." /></div>
                  <div style={{ width: '100%', height: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stageRows.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--cy-text-secondary)', fontSize: 10 }} width={120} />
                        <RechartsTooltip content={customTooltip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="count" fill="var(--cy-neon-cyan)" radius={[0, 4, 4, 0]} onClick={(data) => setDetailPanel({ type: 'stage', title: `Volume em: ${data.stage}`, subtitle: 'Itens ativos nesta etapa (Agregado não exportado para drill-down no momento)' })} style={{ cursor: 'pointer' }}>
                          {stageRows.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--cy-neon-purple)' : 'var(--cy-neon-cyan)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="interactive-glow" style={{ padding: '1rem', background: 'var(--cy-surface)', border: '1px solid var(--cy-border)', borderRadius: '4px' }}>
                  <div className="executive-productivity-subheading" style={{ marginBottom: '1rem' }}>CONCENTRAÇÃO DE ATRASOS <Info size={11} title="Responsáveis que aparecem nos itens atrasados. Não mede performance individual sem horas ou metas confiáveis." /></div>
                  <div style={{ width: '100%', height: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topResponsibles.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--cy-text-secondary)', fontSize: 10 }} width={120} />
                        <RechartsTooltip content={customTooltip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="delayedTotal" fill="var(--cy-neon-yellow)" radius={[0, 4, 4, 0]} onClick={(data) => setDetailPanel({ type: 'owner', owner: data.name, title: `Gargalos com ${data.name}`, subtitle: 'Itens com prazo interno vencido concentrados neste membro' })} style={{ cursor: 'pointer' }}>
                          {topResponsibles.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--cy-neon-magenta)' : 'var(--cy-neon-yellow)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="executive-metrics-panel" aria-label="Métricas quantitativas da carteira" style={{ marginTop: '1.5rem' }}>
              <div className="executive-metrics-heading"><Activity size={15} /><span>MÉTRICAS DE CARTEIRA (AUDITORIA OPERACIONAL)</span><small>{quantitative.totalItems || 0} itens no recorte lido</small></div>
              <div className="executive-metrics-grid">
                <div className="executive-metric-card" title="Percentual de itens ativos que possuem data de veiculação no recorte do Monday."><span>VEICULAÇÃO COM DATA <Info size={11} /></span><strong>{displayPct(quantitative.publicationDateCoveragePct)}</strong><small>{quantitative.itemsWithPublicationDate || 0} de {quantitative.totalItems || 0} itens</small></div>
                <div className="executive-metric-card" title="Qualidade do planejamento interno: itens ativos com prazo preenchido."><span>PRAZO INTERNO PREENCHIDO <Info size={11} /></span><strong>{displayPct(quantitative.internalDeadlineCoveragePct)}</strong><small>{quantitative.itemsWithInternalDeadline || 0} de {quantitative.totalItems || 0} itens</small></div>
                <div className="executive-metric-card" title="Itens com prazo interno ou data de veiculação nos próximos sete dias."><span>VENCIMENTO EM 7 DIAS <Info size={11} /></span><strong>{quantitative.dueWithin7Internal ?? 0}</strong><small>{quantitative.dueWithin7Publication ?? 0} com veiculação prevista</small></div>
                <div className="executive-metric-card" title="Percentual de itens ativos com prioridade classificada no Monday. Mede qualidade do dado, não produtividade individual."><span>PRIORIDADE CLASSIFICADA <Info size={11} /></span><strong>{displayPct(quantitative.priorityCoveragePct)}</strong><small>qualidade do dado executivo</small></div>
                <div className="executive-metric-card" title="Clientes ativos com planejamento estratégico identificado no board de Gestão de Clientes."><span>PLANEJAMENTO DA CARTEIRA <Info size={11} /></span><strong>{displayPct(readiness.planningCoveragePct)}</strong><small>{readiness.missingPlanning ?? 0} clientes sem planejamento · base de {readiness.eligibleClients ?? 0}</small></div>
                <div className="executive-metric-card" title="Clientes ativos com dashboard considerado atualizado na fonte operacional."><span>DASHBOARD ATUALIZADO <Info size={11} /></span><strong>{displayPct(readiness.dashboardCoveragePct)}</strong><small>{readiness.missingDashboard ?? 0} pendentes · base de {readiness.eligibleClients ?? 0}</small></div>
              </div>
              <div className="executive-metrics-columns" style={{ marginTop: '1.5rem' }}>
                <div>
                  <div className="executive-mini-heading"><Clock size={13} /> COMPOSIÇÃO DO RECORTE</div>
                  <div className="executive-status-list">{statusRows.slice(0, 5).map(([label, count]) => <button type="button" className="executive-status-row executive-interactive-row" key={label} title={`${label}: ${count} itens ativos no recorte`} onClick={() => setDetailPanel({ type: 'status', title: label, subtitle: 'Composição do recorte ativo' })}><span>{label}</span><b>{count}</b><i><em style={{ width: `${Math.min(100, ((count / (quantitative.totalItems || 1)) * 100))}%`, background: quantitative.statusColors?.[label] || 'var(--cy-neon-cyan)' }} /></i><small>{displayPct(Number(((count / (quantitative.totalItems || 1)) * 100).toFixed(1)))}</small></button>)}</div>
                </div>
                <div></div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'clients' && (
          <div className="executive-clients-tab" style={{ marginTop: 0 }}>
            <div className="executive-summary-grid" style={{ marginTop: 0 }}>
              <div className="executive-summary-card">
                <span>CLIENTES ATIVOS</span>
                <strong>{safeSnapshot.clientLogs?.length || 0}</strong>
                <small>Volume total da carteira lida</small>
              </div>
              <div className="executive-summary-card">
                <span>REUNIÕES FUTURAS</span>
                <strong>{(safeSnapshot.clientLogs || []).filter(c => c.futureMeetings?.length > 0).length}</strong>
                <small>Clientes com agenda marcarda</small>
              </div>
            </div>

            <div className="executive-metrics-panel" style={{ marginTop: '1.5rem' }}>
              <div className="executive-metrics-heading"><Target size={15} /><span>RELAÇÃO E CADÊNCIA</span></div>
              <div className="executive-clients-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(safeSnapshot.clientLogs || []).map(client => (
                  <button type="button" key={client.id || client.name} className="executive-status-row executive-interactive-row" style={{ gridTemplateColumns: 'minmax(150px, 1.5fr) minmax(100px, 1fr) minmax(80px, 1fr) minmax(150px, 1.5fr)', padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', color: 'inherit' }} onClick={() => setDetailPanel({ type: 'client-health', title: client.name, subtitle: 'Raio-X de Relacionamento', data: client })}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.8rem', display: 'block' }}>{client.name}</strong>
                      <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                        Health: {client.healthScore?.score || 0}% · {client.healthScore?.label || 'N/A'}
                      </small>
                    </div>
                    <div>
                      <span style={{ color: client.relationshipStatus === 'critical' ? 'var(--cy-neon-magenta)' : client.relationshipStatus === 'warning' ? 'var(--cy-neon-yellow)' : 'var(--cy-text-secondary)', fontSize: '0.7rem' }}>
                        {client.daysSinceLastMeeting === null ? 'Sem histórico' : `${client.daysSinceLastMeeting} dias atrás`}
                      </span>
                    </div>
                    <div>
                      <small style={{ fontSize: '0.7rem' }}>{client.meetingCount || 0} reunião(ões)</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <b style={{ color: client.operational?.nextAction?.includes('Agendar') || client.operational?.nextAction?.includes('Destravar') ? 'var(--cy-neon-magenta)' : 'var(--cy-neon-cyan)', fontSize: '0.65rem' }}>{client.operational?.nextAction || 'Manter cadência'}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="executive-disclaimer" style={{ marginTop: '1.5rem' }}><Info size={13} /> {stability.explanation || 'Os sinais são uma camada interpretativa sobre fontes operacionais e devem ser validados pela liderança.'} | Metodologia: {safeSnapshot.methodology?.note || 'Percentuais calculados sobre o recorte lido do Monday.'}</p>

      {/* DRAWER LATERAL */}
      {detailPanel && (
        <div className="executive-drawer-overlay" onClick={closeDetailPanel}>
          <aside className="executive-drawer slide-in-right" aria-label="Detalhes executivos selecionados" onClick={e => e.stopPropagation()}>
            <div className="executive-drawer-header">
              <div>
                <div className="executive-mini-heading"><Info size={13} /> EVIDÊNCIA SELECIONADA</div>
                <h3>{detailPanel.title}</h3>
                <p>{detailPanel.subtitle} · {selectedDetails.length} item(ns)</p>
              </div>
              <button type="button" className="executive-drawer-close" onClick={closeDetailPanel} aria-label="Fechar detalhes">&times;</button>
            </div>
            
            <div className="executive-drawer-content">
              {detailPanel.type === 'math' ? (
                <div style={{ color: '#fff', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <p style={{ marginBottom: '1rem' }}>A estabilidade da carteira começa em <strong>100%</strong>.</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span>Atrasos Internos ({quantitative.overdueInternal ?? summary.delayedTeam ?? 0}) <small style={{color:'var(--cy-text-secondary)'}}>x2 pts</small></span>
                      <strong style={{ color: 'var(--cy-neon-yellow)' }}>-{(quantitative.overdueInternal ?? summary.delayedTeam ?? 0) * 2} pts</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span>Atrasos Veiculação ({quantitative.overduePublication ?? summary.delayedClient ?? 0}) <small style={{color:'var(--cy-text-secondary)'}}>x5 pts</small></span>
                      <strong style={{ color: 'var(--cy-neon-magenta)' }}>-{(quantitative.overduePublication ?? summary.delayedClient ?? 0) * 5} pts</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span>Sem Planejamento ({safeSnapshot.portfolioReadiness?.missingPlanning || 0}) <small style={{color:'var(--cy-text-secondary)'}}>x1 pts</small></span>
                      <strong style={{ color: 'var(--cy-neon-purple)' }}>-{safeSnapshot.portfolioReadiness?.missingPlanning || 0} pts</strong>
                    </li>
                  </ul>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <span>SCORE FINAL</span>
                    <strong style={{ fontSize: '1.2rem', color: stabilityColor }}>{stability.score ?? 0}%</strong>
                  </div>
                  <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--cy-text-secondary)' }}>O score é ancorado em 0% (não fica negativo). {stability.explanation}</p>
                </div>
              ) : detailPanel.type === 'client-health' && detailPanel.data ? (
                <div style={{ color: '#fff', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1rem' }}>
                    <span style={{ display: 'block', color: 'var(--cy-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Diagnóstico do Monday</span>
                    <strong style={{ fontSize: '1.5rem', color: detailPanel.data.healthScore?.score > 70 ? 'var(--cy-neon-green)' : detailPanel.data.healthScore?.score > 40 ? 'var(--cy-neon-yellow)' : 'var(--cy-neon-magenta)' }}>{detailPanel.data.healthScore?.score}% ({detailPanel.data.healthScore?.label})</strong>
                  </div>
                  
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--cy-neon-cyan)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Fatores de Risco</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {detailPanel.data.healthScore?.penalties?.map((p, i) => (
                      <li key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--cy-neon-magenta)' }}>
                        <AlertTriangle size={12} style={{ marginRight: '0.5rem', display: 'inline-block' }} /> {p}
                      </li>
                    ))}
                    {(!detailPanel.data.healthScore?.penalties || detailPanel.data.healthScore?.penalties.length === 0) && (
                      <li style={{ color: 'var(--cy-neon-green)', padding: '0.5rem 0' }}><CheckCircle2 size={12} style={{ marginRight: '0.5rem', display: 'inline-block' }} /> Nenhum fator crítico detectado</li>
                    )}
                  </ul>

                  <h4 style={{ fontSize: '0.8rem', color: 'var(--cy-neon-cyan)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Ação Recomendada (Liderança)</h4>
                  <p style={{ padding: '0.8rem', borderLeft: '2px solid var(--cy-neon-cyan)', background: 'rgba(0,243,255,0.05)', color: '#ccc' }}>
                    {detailPanel.data.operational?.nextAction || 'Nenhuma ação executiva requerida no momento.'}
                  </p>
                </div>
              ) : selectedDetails.length > 0 ? (
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
                        {item.editorDesigner && <span>Criação: {item.editorDesigner}</span>}
                      </div>
                      {!item.id?.startsWith('plan-') && <a href={`https://gestaovybes-team.monday.com/boards/7829537690/pulses/${item.id}`} target="_blank" rel="noreferrer" className="executive-evidence-link"><ExternalLink size={12} /> Abrir item no Monday</a>}
                    </article>
                  ))}
                </div>
              ) : detailPanel.type === 'stage' ? (
                <div className="executive-empty">Agregados por etapa no Monday. A integração atual foca a extração de detalhes apenas nos gargalos (atrasos).</div>
              ) : (
                <div className="executive-empty">Nenhum detalhe de atraso disponível para esta seleção; o indicador continua agregado pela fonte.</div>
              )}
            </div>
          </aside>
        </div>
      )}
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
      // Faz as requisições sequencialmente para não sobrecarregar a API do Monday
      // com muitas conexões simultâneas (o que estava causando timeout).
      setScanText('Consultando métricas principais...');
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
