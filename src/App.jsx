import React, { useState, useEffect } from 'react';
import { Activity, ServerCrash, Target, RefreshCw, AlertTriangle, Clock, ExternalLink, Info, CheckCircle2 } from 'lucide-react';

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
  const clientRows = safeSnapshot.clientRanking || [];
  const statusRows = Object.entries(quantitative.statusCounts || {}).sort((a, b) => b[1] - a[1]);
  const displayPct = value => value === null || value === undefined ? '—' : `${value}%`;
  const [showAllClientRisks, setShowAllClientRisks] = useState(false);
  const [detailPanel, setDetailPanel] = useState(null);
  const delayDetails = safeSnapshot.delayDetails || [];
  const productivity = safeSnapshot.productivity || {};
  const internalDelayDetails = delayDetails.filter(item => item.delayType?.includes('prazo interno'));
  const stageRows = productivity.byStage || [];
  const topResponsibles = productivity.topResponsibles || [];
  const visibleClientRows = showAllClientRisks ? clientRows : clientRows.slice(0, 5);
  const selectedDetails = detailPanel?.type === 'client'
    ? delayDetails.filter(item => item.client === detailPanel.client)
    : detailPanel?.type === 'delays' ? internalDelayDetails : [];
  const closeDetailPanel = () => setDetailPanel(null);

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
        <button type="button" className="executive-summary-card executive-interactive-card" title="Clique para abrir os itens com prazo interno vencido" onClick={() => setDetailPanel({ type: 'delays', title: 'Atrasos internos', subtitle: 'Itens ativos com prazo interno vencido' })}>
          <span>ATRASOS INTERNOS <Info size={11} /></span>
          <strong>{quantitative.overdueInternal ?? summary.delayedTeam ?? 0}</strong>
          <small>{displayPct(quantitative.overdueInternalPctOfActive)} dos itens ativos com prazo vencido · abrir detalhes</small>
        </button>
        <div className="executive-summary-card">
          <span>FONTE · {snapshotSourceStatus === 'live' ? 'LIVE' : 'STALE'}</span>
          <strong className="executive-source">{safeSnapshot.source || 'Monday.com'}</strong>
          <small>Atualizado {formatDateTime(snapshotTimestamp)}</small>
        </div>
      </div>

      <div className="executive-metrics-panel" aria-label="Métricas quantitativas da carteira">
        <div className="executive-metrics-heading"><Activity size={15} /><span>MÉTRICAS DE CARTEIRA</span><small>{quantitative.totalItems || 0} itens no recorte lido</small></div>
        <div className="executive-metrics-grid">
          <div className="executive-metric-card" title="Percentual de itens ativos que possuem data de veiculação no recorte do Monday."><span>VEICULAÇÃO COM DATA <Info size={11} /></span><strong>{displayPct(quantitative.publicationDateCoveragePct)}</strong><small>{quantitative.itemsWithPublicationDate || 0} de {quantitative.totalItems || 0} itens</small></div>
          <div className="executive-metric-card" title="Qualidade do planejamento interno: itens ativos com prazo preenchido."><span>PRAZO INTERNO PREENCHIDO <Info size={11} /></span><strong>{displayPct(quantitative.internalDeadlineCoveragePct)}</strong><small>{quantitative.itemsWithInternalDeadline || 0} de {quantitative.totalItems || 0} itens</small></div>
          <div className="executive-metric-card" title="Itens com prazo interno ou data de veiculação nos próximos sete dias."><span>VENCIMENTO EM 7 DIAS <Info size={11} /></span><strong>{quantitative.dueWithin7Internal ?? 0}</strong><small>{quantitative.dueWithin7Publication ?? 0} com veiculação prevista</small></div>
          <div className="executive-metric-card" title="Percentual de itens ativos com prioridade classificada no Monday. Mede qualidade do dado, não produtividade individual."><span>PRIORIDADE CLASSIFICADA <Info size={11} /></span><strong>{displayPct(quantitative.priorityCoveragePct)}</strong><small>qualidade do dado executivo</small></div>
          <div className="executive-metric-card" title="Clientes ativos com planejamento estratégico identificado no board de Gestão de Clientes."><span>PLANEJAMENTO DA CARTEIRA <Info size={11} /></span><strong>{displayPct(readiness.planningCoveragePct)}</strong><small>{readiness.missingPlanning ?? 0} clientes sem planejamento · base de {readiness.eligibleClients ?? 0}</small></div>
          <div className="executive-metric-card" title="Clientes ativos com dashboard considerado atualizado na fonte operacional."><span>DASHBOARD ATUALIZADO <Info size={11} /></span><strong>{displayPct(readiness.dashboardCoveragePct)}</strong><small>{readiness.missingDashboard ?? 0} pendentes · base de {readiness.eligibleClients ?? 0}</small></div>
        </div>
        <div className="executive-productivity-panel" aria-label="Produtividade executiva">
          <div className="executive-mini-heading"><Activity size={13} /> PRODUTIVIDADE EXECUTIVA <Info size={12} title="Leitura de fluxo e capacidade da carteira. Não é ranking individual de pessoas." /></div>
          <div className="executive-productivity-kpis">
            <div title="Percentual do recorte que já foi concluído no Monday."><strong>{displayPct(productivity.completionPct)}</strong><span>CONCLUÍDO NO RECORTE</span><small>{productivity.completedItems ?? 0} itens finalizados</small></div>
            <div title="Itens ativos prontos para agendamento ou já agendados."><strong>{productivity.readyToSchedule ?? 0}</strong><span>PRONTOS PARA SAÍDA</span><small>{displayPct(productivity.readyToSchedulePct)} dos ativos</small></div>
            <div title="Itens ativos com atraso interno ou de veiculação."><strong>{productivity.delayedItems ?? quantitative.overdueInternal ?? 0}</strong><span>COM ATRASO</span><small>{displayPct(productivity.delayedPctOfActive ?? quantitative.overdueInternalPctOfActive)} dos ativos</small></div>
          </div>
          <div className="executive-productivity-columns">
            <div>
              <div className="executive-productivity-subheading">CARGA ATIVA POR ETAPA <Info size={11} title="Distribuição dos itens ativos por grupo do Monday." /></div>
              <div className="executive-stage-list">{stageRows.slice(0, 5).map(row => <div className="executive-stage-row" key={row.stage} title={`${row.stage}: ${row.count} itens ativos (${displayPct(row.pctOfActive)})`}><span>{row.stage}</span><b>{row.count}</b><i><em style={{ width: `${Math.min(100, row.pctOfActive || 0)}%` }} /></i><small>{displayPct(row.pctOfActive)}</small></div>)}</div>
            </div>
            <div>
              <div className="executive-productivity-subheading">CONCENTRAÇÃO DE ATRASOS <Info size={11} title="Responsáveis que aparecem nos itens atrasados. Não mede performance individual sem horas ou metas confiáveis." /></div>
              <div className="executive-responsible-list">{topResponsibles.slice(0, 4).map(row => <div className="executive-responsible-row" key={row.name} title={`${row.name}: ${row.delayedTotal} atraso(s) associado(s)`}><strong>{row.name}</strong><span>{row.delayedTotal} atraso(s)</span></div>)}</div>
            </div>
          </div>
          <small className="executive-productivity-note"><Info size={12} /> Produtividade aqui significa fluxo, prontidão e concentração de carga. O Monday não fornece horas trabalhadas, metas individuais ou capacidade contratada suficiente para medir produtividade pessoal.</small>
        </div>
        <div className="executive-metrics-columns">
          <div>
            <div className="executive-mini-heading"><Clock size={13} /> COMPOSIÇÃO DO RECORTE</div>
            <div className="executive-status-list">{statusRows.slice(0, 5).map(([label, count]) => <button type="button" className="executive-status-row executive-interactive-row" key={label} title={`${label}: ${count} itens ativos no recorte`} onClick={() => setDetailPanel({ type: 'status', title: label, subtitle: 'Composição do recorte ativo' })}><span>{label}</span><b>{count}</b><i><em style={{ width: `${Math.min(100, ((count / (quantitative.totalItems || 1)) * 100))}%`, background: quantitative.statusColors?.[label] || 'var(--cy-neon-cyan)' }} /></i><small>{displayPct(Number(((count / (quantitative.totalItems || 1)) * 100).toFixed(1)))}</small></button>)}</div>
          </div>
          <div>
            <div className="executive-mini-heading"><AlertTriangle size={13} /> CLIENTES COM MAIOR EXPOSIÇÃO</div>
            <div className="executive-client-risk-list">{visibleClientRows.map(row => <button type="button" className="executive-client-risk-row executive-interactive-row" key={row.client} title={`Abrir detalhes dos atrasos de ${row.client}`} onClick={() => setDetailPanel({ type: 'client', client: row.client, title: row.client, subtitle: 'Itens atrasados associados a este cliente' })}><div><strong>{row.client}</strong><small>{row.openItems} abertos · {row.internalDelays} internos · {row.publicationDelays} veiculação</small></div><b>{row.delayedItems} <small>{displayPct(row.riskPct)}</small></b></button>)}</div>
            {clientRows.length > 5 && <button type="button" className="decision-see-more" onClick={() => setShowAllClientRisks(current => !current)}>{showAllClientRisks ? 'MOSTRAR MENOS' : `VER MAIS (${clientRows.length - 5})`}</button>}
          </div>
        </div>
        <small className="executive-methodology"><Info size={12} /> {safeSnapshot.methodology?.note || 'Percentuais são calculados sobre o recorte lido do Monday e não substituem indicadores financeiros ou de satisfação.'}</small>
      </div>

      <div className="executive-columns">
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

      {detailPanel && (
        <section className="executive-detail-panel" aria-label="Detalhes executivos selecionados">
          <div className="executive-detail-header">
            <div><div className="executive-mini-heading"><Info size={13} /> EVIDÊNCIA SELECIONADA</div><h3>{detailPanel.title}</h3><p>{detailPanel.subtitle} · {selectedDetails.length} item(ns)</p></div>
            <button type="button" className="executive-detail-close" onClick={closeDetailPanel} aria-label="Fechar detalhes">FECHAR</button>
          </div>
          {selectedDetails.length > 0 ? <div className="executive-detail-list">{selectedDetails.map(item => <article className="executive-detail-item" key={`${item.id}-${item.delayType}`}><div><strong>{item.name}</strong><span>{item.client} · {item.stage} · {item.status}</span></div><div className="executive-detail-meta"><span>{item.delayType}</span><span>{item.daysOverdue} dia(s) de atraso</span><span>Prazo: {formatDate(item.prazo)}</span>{item.responsavel && <span>Responsável: {item.responsavel}</span>}{item.editorDesigner && <span>Criação: {item.editorDesigner}</span>}</div><a href={`https://gestaovybes-team.monday.com/boards/7829537690/pulses/${item.id}`} target="_blank" rel="noreferrer" className="executive-evidence-link"><ExternalLink size={12} /> Abrir item no Monday</a></article>)}</div> : <div className="executive-empty">Nenhum detalhe de atraso disponível para esta seleção; o indicador continua agregado pela fonte.</div>}
        </section>
      )}

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
