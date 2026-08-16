import React, { useState, useEffect } from 'react';
import { clients } from './data/clients';
import { ShieldAlert, Activity, GitCommit, ServerCrash, Terminal, Layers, Crosshair, ArrowLeft, BarChart2, ChevronDown, ChevronUp, Search, Target, MapPin, Globe, Star, Database, RefreshCw, LayoutDashboard, AlertTriangle, Clock, ActivitySquare, ExternalLink, Info, Filter, ListChecks, ChevronRight, X, CheckCircle2, History, GitBranch } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

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


const attentionTypeLabels = { content: 'CONTEÚDO', demand: 'DEMANDA', setup: 'SETUP' };
const attentionPriorityLabels = { critical: 'CRÍTICO', warning: 'ATENÇÃO' };

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

function DemandItem({ demand }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li style={{ padding: '0.5rem 8px 0.5rem 0', borderBottom: '1px solid #222', fontSize: '0.85rem' }}>
      <div 
        role="button" tabIndex={0} aria-expanded={isOpen}
        onKeyDown={(event) => activateOnKeyboard(event, () => setIsOpen(!isOpen))}
        onClick={() => setIsOpen(!isOpen)} 
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--cy-neon-cyan)', marginBottom: '0.2rem' }}>{demand.cliente}</div>
          {isOpen ? <ChevronUp size={14} color="var(--cy-text-secondary)"/> : <ChevronDown size={14} color="var(--cy-text-secondary)"/>}
        </div>
        <div style={{ color: '#fff', marginBottom: '0.2rem' }}>{demand.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cy-text-secondary)', fontSize: '0.75rem' }}>
          <span>Status: <span style={{color: 'var(--cy-neon-yellow)'}}>{demand.status}</span></span>
          <span>Prazo: {formatDate(demand.prazo)}</span>
        </div>
      </div>
      
      {isOpen && (
        <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: 'rgba(0, 243, 255, 0.05)', borderLeft: '2px solid var(--cy-neon-cyan)', borderRadius: '0 4px 4px 0' }}>
          <div style={{ marginBottom: '0.4rem', color: '#ccc' }}><strong>Quadro/Grupo:</strong> {demand.quadro}</div>
          <div style={{ marginTop: '0.8rem' }}>
            <a href={`https://gestaovybes-team.monday.com/boards/8385559107/pulses/${demand.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--cy-neon-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
              <ExternalLink size={14} /> Abrir no Monday
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

function ClientPostsRow({ row, sortMode }) {
  const [isOpen, setIsOpen] = useState(false);

  const sortedDetails = [...(row.details || [])].sort((a, b) => {
    if (sortMode === 'veic') return new Date(a.veiculacao || '2099-12-31') - new Date(b.veiculacao || '2099-12-31');
    return new Date(a.prazo || '2099-12-31') - new Date(b.prazo || '2099-12-31');
  });

  // Check if there's any delay to highlight the row
  const hasDelayedPrazo = row.delayedPrazo > 0;
  const hasDelayedVeic = row.delayedVeiculacao > 0;

  return (
    <React.Fragment>
      <tr role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={(event) => activateOnKeyboard(event, () => setIsOpen(!isOpen))} onClick={() => setIsOpen(!isOpen)} style={{ borderBottom: '1px solid #222', cursor: 'pointer' }}>
        <td style={{ padding: '0.5rem 0', color: hasDelayedVeic ? 'var(--cy-neon-magenta)' : (hasDelayedPrazo ? 'var(--cy-neon-yellow)' : '#fff'), display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isOpen ? <ChevronUp size={14} color="var(--cy-text-secondary)"/> : <ChevronDown size={14} color="var(--cy-text-secondary)"/>}
          {row.name}
        </td>
        <td style={{ padding: '0.5rem 0', textAlign: 'center' }}>{row.open}</td>
        <td style={{ padding: '0.5rem 0', textAlign: 'center', color: hasDelayedPrazo ? 'var(--cy-neon-yellow)' : '#fff', fontWeight: hasDelayedPrazo ? 'bold' : 'normal' }}>{row.delayedPrazo}</td>
        <td style={{ padding: '0.5rem 0', textAlign: 'center', color: hasDelayedVeic ? 'var(--cy-neon-magenta)' : '#fff', fontWeight: hasDelayedVeic ? 'bold' : 'normal' }}>{row.delayedVeiculacao}</td>
      </tr>
      {isOpen && row.details && row.details.length > 0 && (
        <tr>
          <td colSpan="4" style={{ padding: 0 }}>
            <div style={{ padding: '0.8rem', background: 'rgba(255, 234, 0, 0.05)', borderLeft: '2px solid var(--cy-neon-yellow)', marginBottom: '0.5rem' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sortedDetails.map((post, idx) => {
                  let colorName = '#fff';
                  if (post.isDelayedVeiculacao) colorName = 'var(--cy-neon-magenta)';
                  else if (post.isDelayedPrazo) colorName = 'var(--cy-neon-yellow)';

                  return (
                    <li key={idx} style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
                      <div style={{ color: colorName, fontWeight: 'bold', marginBottom: '0.2rem' }}>
                        {post.name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cy-text-secondary)', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                        <span>Quadro: {post.quadro}</span>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <span style={{ color: post.isDelayedPrazo ? 'var(--cy-neon-yellow)' : 'inherit' }}>Prazo: {formatDate(post.prazo)}</span>
                          <span style={{ color: post.isDelayedVeiculacao ? 'var(--cy-neon-magenta)' : 'inherit' }}>Veic.: {formatDate(post.veiculacao)}</span>
                        </div>
                      </div>
                    <div>
                      <a href={`https://gestaovybes-team.monday.com/boards/7829537690/pulses/${post.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--cy-neon-yellow)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                        <ExternalLink size={12} /> Abrir Post
                      </a>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

function ExecutiveCockpit({ snapshot }) {
  const [lens, setLens] = useState('cmo');
  const safeSnapshot = snapshot || {};
  const summary = safeSnapshot.summary || {};
  const snapshotSourceStatus = safeSnapshot.sourceStatus || (safeSnapshot.generatedAt || safeSnapshot.capturedAt ? 'live' : 'stale');
  const snapshotTimestamp = safeSnapshot.generatedAt || safeSnapshot.capturedAt;
  const stability = safeSnapshot.portfolioStability || {};
  const activeLens = safeSnapshot.lenses?.[lens] || {
    title: lens === 'cmo' ? 'LENTE CMO' : 'LENTE COO',
    question: 'Qual decisão executiva precisa ser tomada?',
    focus: []
  };
  const risks = (safeSnapshot.executiveRisks || []).filter(risk => lens === 'cmo' ? risk.ownerRole !== 'COO' : risk.ownerRole !== 'CMO').slice(0, 5);
  const decisions = (safeSnapshot.decisionsNeeded || []).filter(decision => lens === 'cmo' ? decision.ownerRole !== 'COO' : decision.ownerRole !== 'CMO').slice(0, 3);
  const stabilityColor = stability.status === 'stable' ? 'var(--cy-neon-green)' : stability.status === 'attention' ? 'var(--cy-neon-yellow)' : 'var(--cy-neon-magenta)';

  return (
    <section className="executive-cockpit card" aria-labelledby="executive-cockpit-title">
      <div className="executive-cockpit-header">
        <div>
          <div className="executive-kicker"><Target size={15} /> COMMAND LAYER · CMO / COO</div>
          <h2 id="executive-cockpit-title">COCKPIT DE COMANDO E DECISÃO</h2>
          <p>{activeLens.question}</p>
        </div>
        <div className="executive-lens-switch" role="group" aria-label="Escolher lente executiva">
          {['cmo', 'coo'].map(option => (
            <button key={option} type="button" className={lens === option ? 'active' : ''} onClick={() => setLens(option)}>
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="executive-lens-context">
        <strong>{activeLens.title}</strong>
        <span>{activeLens.focus.join(' · ')}</span>
      </div>

      <div className="executive-summary-grid">
        <div className="executive-summary-card stability" style={{ '--signal-color': stabilityColor }}>
          <span>ESTABILIDADE OPERACIONAL · PROXY</span>
          <strong>{stability.score ?? '—'}%</strong>
          <small>{stability.label || 'Aguardando dados'}</small>
        </div>
        <div className="executive-summary-card">
          <span>RISCOS EXECUTIVOS</span>
          <strong>{summary.executiveRisks ?? 0}</strong>
          <small>agrupados por causa e cliente</small>
        </div>
        <div className="executive-summary-card">
          <span>DECISÕES NECESSÁRIAS</span>
          <strong>{summary.decisionsNeeded ?? 0}</strong>
          <small>sem alterar status de produção</small>
        </div>
        <div className="executive-summary-card">
          <span>FONTE</span>
          <strong className="executive-source">{snapshotSourceStatus === 'live' ? 'LIVE' : 'STALE'}</strong>
          <small>{safeSnapshot.source || 'Monday.com'} · {formatDateTime(snapshotTimestamp)}</small>
        </div>
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

const decisionStatusLabels = {
  decision_needed: 'DECISÃO NECESSÁRIA',
  directive_defined: 'DIRETRIZ DEFINIDA',
  impact_tracking: 'MONITORANDO IMPACTO',
  normalized: 'NORMALIZADA',
  dismissed: 'DESCARTADA'
};

function HealthScoreCard({ healthScore }) {
  if (!healthScore) return null;
  const color = healthScore.status === 'healthy' ? 'var(--cy-neon-green)' : healthScore.status === 'attention' ? 'var(--cy-neon-yellow)' : 'var(--cy-neon-magenta)';
  return (
    <div className="health-score-card" style={{ '--health-color': color }}>
      <div className="health-score-header"><span>CLIENT HEALTH · V2</span><strong>{healthScore.score}%</strong></div>
      <div className="health-score-label">{healthScore.label}</div>
      <div className="health-score-meta"><span>CONFIANÇA: <b>{healthScore.confidence || 'partial'}</b></span><span>TENDÊNCIA: <b>{healthScore.trend || 'not_available'}</b></span></div>
      <div className="health-factor-grid">
        {(healthScore.factors || []).map(factor => (
          <div key={factor.key} title={factor.reason}>
            <span>{factor.label}</span>
            <b>{factor.score}</b>
          </div>
        ))}
      </div>
      <small>{healthScore.explanation}</small>
    </div>
  );
}

function DecisionRegistry() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', context: '', ownerRole: 'CMO/COO', priority: 'medium', clientId: '', directive: '', checkpointAt: '' });

  const loadDecisions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/executive/decisions');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Registro aguardando datastore configurado para escrita técnica.');
      setDecisions(data.decisions || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Registro de decisões indisponível.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDecisions(); }, []);

  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const handleCreate = async event => {
    event.preventDefault();
    if (saving || !form.title.trim() || !form.context.trim()) return;
    setSaving(true);
    try {
      const response = await fetch('/api/executive/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível registrar a decisão.');
      setDecisions(current => [data.decision, ...current]);
      setForm({ title: '', context: '', ownerRole: 'CMO/COO', priority: 'medium', clientId: '', directive: '', checkpointAt: '' });
      setShowForm(false);
      setError('');
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a decisão.');
    } finally {
      setSaving(false);
    }
  };

  const activeDecisions = decisions.filter(decision => !['normalized', 'dismissed'].includes(decision.status));
  const now = Date.now();
  const atRiskDecisions = activeDecisions.filter(decision => !decision.checkpointAt || new Date(decision.checkpointAt).getTime() < now);

  const handleStatusChange = async (decision, status) => {
    try {
      const response = await fetch(`/api/executive/decisions/${decision.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: `Status atualizado pela liderança no Cockpit: ${decisionStatusLabels[status]}.` })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a decisão.');
      setDecisions(current => current.map(item => item.id === decision.id ? data.decision : item));
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar a decisão.');
    }
  };

  return (
    <section className="decision-registry card" aria-labelledby="decision-registry-title">
      <div className="decision-registry-header">
        <div>
          <div className="executive-kicker"><ListChecks size={15} /> DECISION REGISTRY · NEXUS</div>
          <h2 id="decision-registry-title">REGISTRO DE DECISÕES EXECUTIVAS</h2>
          <p>Registre diretrizes e checkpoints sem alterar status ou itens de produção no Monday.</p>
        </div>
        <button type="button" className="decision-add-btn" onClick={() => setShowForm(current => !current)}>{showForm ? 'FECHAR' : '+ REGISTRAR DECISÃO'}</button>
      </div>

      {showForm && (
        <form className="decision-form" onSubmit={handleCreate}>
          <input value={form.title} onChange={event => updateField('title', event.target.value)} placeholder="Título da decisão executiva" aria-label="Título da decisão" required />
          <textarea value={form.context} onChange={event => updateField('context', event.target.value)} placeholder="Contexto e evidência que motivaram a decisão" aria-label="Contexto da decisão" required />
          <div className="decision-form-grid">
            <input value={form.clientId} onChange={event => updateField('clientId', event.target.value)} placeholder="Cliente relacionado (opcional)" aria-label="Cliente relacionado" />
            <select value={form.ownerRole} onChange={event => updateField('ownerRole', event.target.value)} aria-label="Responsável executivo"><option>CMO/COO</option><option>CMO</option><option>COO</option><option>Liderança</option></select>
            <select value={form.priority} onChange={event => updateField('priority', event.target.value)} aria-label="Prioridade"><option value="critical">Crítica</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select>
            <input type="date" value={form.checkpointAt} onChange={event => updateField('checkpointAt', event.target.value)} aria-label="Data do checkpoint" />
          </div>
          <textarea value={form.directive} onChange={event => updateField('directive', event.target.value)} placeholder="Diretriz definida ou próxima decisão (opcional)" aria-label="Diretriz da decisão" />
          <div className="decision-form-actions"><button type="button" className="decision-cancel-btn" onClick={() => setShowForm(false)}>CANCELAR</button><button type="submit" className="decision-submit-btn" disabled={saving}>{saving ? 'SALVANDO...' : 'SALVAR NO NEXUS'}</button></div>
        </form>
      )}

      {error && <div className="decision-registry-notice"><Info size={14} /> {error}</div>}
      {!loading && decisions.length > 0 && <div className={`decision-risk-summary ${atRiskDecisions.length > 0 ? 'has-risk' : ''}`}><strong>{atRiskDecisions.length}</strong><span>decisões em risco</span><small>{atRiskDecisions.length > 0 ? 'checkpoint vencido ou ausente' : 'nenhum checkpoint crítico detectado'}</small></div>}
      {loading ? <div className="decision-registry-empty">Carregando decisões executivas...</div> : decisions.length === 0 ? <div className="decision-registry-empty">Nenhuma decisão registrada. Use esta área para formalizar diretrizes, não para acompanhar tarefas.</div> : (
        <div className="decision-list">
          {decisions.slice(0, showAll ? decisions.length : 5).map(decision => (
            <article className="decision-record" key={decision.id}>
              <div className="decision-record-top"><span className={`decision-priority ${decision.priority}`}>{decision.priority?.toUpperCase()}</span><select value={decision.status} onChange={event => handleStatusChange(decision, event.target.value)} aria-label={`Status da decisão ${decision.title}`}>{Object.entries(decisionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <strong>{decision.title}</strong>
              <p>{decision.context}</p>
              <div className="decision-record-meta"><span>{decision.ownerRole}</span>{decision.clientId && <span>{decision.clientId}</span>}{decision.checkpointAt && <span>Checkpoint: {formatDate(decision.checkpointAt)}</span>}<span><Clock size={11} /> {decision.history?.length || 1} eventos</span></div>
            </article>
          ))}
          {decisions.length > 5 && <button type="button" className="decision-see-more" onClick={() => setShowAll(current => !current)}>{showAll ? 'MOSTRAR MENOS' : `VER MAIS (${decisions.length - 5})`}</button>}
        </div>
      )}
    </section>
  );
}

function ExecutiveHistory() {
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/executive/snapshots?limit=90')
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Histórico executivo ainda não configurado.');
        setTrend(data.trend || null);
      })
      .catch(err => setError(err.message || 'Histórico executivo indisponível.'))
      .finally(() => setLoading(false));
  }, []);

  const directionLabel = { improving: 'MELHORANDO', declining: 'PIORANDO', stable: 'ESTÁVEL', not_available: 'AGUARDANDO BASE' };
  const directionColor = trend?.direction === 'improving' ? 'var(--cy-neon-green)' : trend?.direction === 'declining' ? 'var(--cy-neon-magenta)' : 'var(--cy-neon-yellow)';

  return (
    <section className="executive-history card" aria-labelledby="executive-history-title">
      <div className="executive-history-header">
        <div>
          <div className="executive-kicker"><Activity size={15} /> HISTÓRICO EXECUTIVO · TRANSPARÊNCIA</div>
          <h2 id="executive-history-title">TRAJETÓRIA DA CARTEIRA</h2>
          <p>Snapshots do Nexus para diferenciar incidente pontual de tendência executiva.</p>
        </div>
        <span className="history-source-badge">LEITURA PÚBLICA POR LINK</span>
      </div>
      {loading ? <div className="executive-history-empty">Consultando histórico...</div> : error ? <div className="executive-history-notice"><Info size={14} /> {error} Os dados atuais continuam disponíveis; a série histórica depende do datastore.</div> : (
        <div className="executive-history-grid">
          <div><span>SITUAÇÃO ATUAL</span><strong>{trend?.current ?? '—'}{trend?.current !== null && trend?.current !== undefined ? '%' : ''}</strong><small>último snapshot</small></div>
          <div><span>VARIAÇÃO</span><strong style={{ color: directionColor }}>{trend?.delta === null || trend?.delta === undefined ? '—' : `${trend.delta > 0 ? '+' : ''}${trend.delta} p.p.`}</strong><small>{directionLabel[trend?.direction] || 'AGUARDANDO BASE'}</small></div>
          <div><span>JANELA 7 DIAS</span><strong>{trend?.windows?.['7d'] ?? 0}</strong><small>snapshots</small></div>
          <div><span>JANELA 30 / 90 DIAS</span><strong>{trend?.windows?.['30d'] ?? 0} / {trend?.windows?.['90d'] ?? 0}</strong><small>snapshots</small></div>
        </div>
      )}
    </section>
  );
}

const impactResultLabels = { improved: 'MELHOROU', stable: 'ESTÁVEL', worsened: 'PIOROU', inconclusive: 'INCONCLUSIVO' };

function ImpactRegistry() {
  const [impacts, setImpacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ decisionId: '', clientId: '', baseline: '', observedIndicator: '', result: 'inconclusive', checkpointAt: '', notes: '' });

  const loadImpacts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/executive/impacts');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Registro de Impacto ainda não configurado.');
      setImpacts(data.impacts || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Registro de Impacto indisponível.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadImpacts(); }, []);
  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const handleCreate = async event => {
    event.preventDefault();
    if (saving || !form.decisionId.trim() || !form.observedIndicator.trim()) return;
    setSaving(true);
    try {
      const response = await fetch('/api/executive/impacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível registrar o impacto.');
      setImpacts(current => [data.impact, ...current]);
      setForm({ decisionId: '', clientId: '', baseline: '', observedIndicator: '', result: 'inconclusive', checkpointAt: '', notes: '' });
      setShowForm(false);
      setError('');
    } catch (err) {
      setError(err.message || 'Não foi possível registrar o impacto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="impact-registry card" aria-labelledby="impact-registry-title">
      <div className="impact-registry-header">
        <div>
          <div className="executive-kicker"><Activity size={15} /> IMPACT REGISTRY · NEXUS</div>
          <h2 id="impact-registry-title">DECISÕES EM ACOMPANHAMENTO</h2>
          <p>Registre o resultado observado depois de uma diretriz, sem marcar tarefas do Monday como resolvidas.</p>
        </div>
        <button type="button" className="impact-add-btn" onClick={() => setShowForm(current => !current)}>{showForm ? 'FECHAR' : '+ REGISTRAR IMPACTO'}</button>
      </div>
      {showForm && (
        <form className="impact-form" onSubmit={handleCreate}>
          <div className="impact-form-grid"><input value={form.decisionId} onChange={event => updateField('decisionId', event.target.value)} placeholder="ID ou referência da decisão" aria-label="Decisão relacionada" required /><input value={form.clientId} onChange={event => updateField('clientId', event.target.value)} placeholder="Cliente ou carteira" aria-label="Cliente ou carteira" /><input type="date" value={form.checkpointAt} onChange={event => updateField('checkpointAt', event.target.value)} aria-label="Data do checkpoint" /><select value={form.result} onChange={event => updateField('result', event.target.value)} aria-label="Resultado do impacto">{Object.entries(impactResultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <textarea value={form.baseline} onChange={event => updateField('baseline', event.target.value)} placeholder="Baseline: como estava antes da diretriz" aria-label="Baseline" />
          <textarea value={form.observedIndicator} onChange={event => updateField('observedIndicator', event.target.value)} placeholder="Indicador observado e evidência do resultado" aria-label="Indicador observado" required />
          <textarea value={form.notes} onChange={event => updateField('notes', event.target.value)} placeholder="Notas do checkpoint (opcional)" aria-label="Notas do checkpoint" />
          <div className="impact-form-actions"><button type="button" className="decision-cancel-btn" onClick={() => setShowForm(false)}>CANCELAR</button><button type="submit" className="impact-submit-btn" disabled={saving}>{saving ? 'SALVANDO...' : 'SALVAR IMPACTO'}</button></div>
        </form>
      )}
      {error && <div className="decision-registry-notice"><Info size={14} /> {error}</div>}
      {loading ? <div className="decision-registry-empty">Carregando impactos...</div> : impacts.length === 0 ? <div className="decision-registry-empty">Nenhum checkpoint registrado. O impacto só deve ser avaliado com evidência, não por percepção isolada.</div> : <div className="impact-list">{impacts.slice(0, 6).map(impact => <article className="impact-record" key={impact.id}><div className="impact-record-top"><span className={`impact-result ${impact.result}`}>{impactResultLabels[impact.result] || impact.result}</span><span>{impact.checkpointAt ? `Checkpoint: ${formatDate(impact.checkpointAt)}` : 'Sem checkpoint'}</span></div><strong>{impact.clientId || 'Carteira'}</strong><p>{impact.observedIndicator}</p><small>{impact.decisionId} · {impact.history?.length || 1} eventos</small></article>)}</div>}
    </section>
  );
}

function ExecutiveAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [meetingMode, setMeetingMode] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const copyBriefing = async () => {
    const markdown = analytics?.briefingDocument?.markdown;
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus('BRIEFING COPIADO');
      setTimeout(() => setCopyStatus(''), 2200);
    } catch {
      setCopyStatus('COPIE MANUALMENTE');
    }
  };

  useEffect(() => {
    fetch('/api/executive/analytics')
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Analytics executiva aguardando histórico persistido.');
        setAnalytics(data.analytics);
      })
      .catch(err => setError(err.message || 'Analytics executiva indisponível.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="executive-analytics card" aria-labelledby="executive-analytics-title">
      <div className="executive-analytics-header"><div><div className="executive-kicker"><Activity size={15} /> EXECUTIVE ANALYTICS · SPRINT 8</div><h2 id="executive-analytics-title">RESULTADO E RISCO PERSISTENTE</h2><p>O que mudou, quais decisões funcionaram e onde a liderança precisa intervir.</p></div><div className="analytics-header-actions"><span className="analytics-read-badge">SOMENTE LEITURA · LINK</span><button type="button" className="meeting-mode-btn" onClick={() => setMeetingMode(current => !current)}>{meetingMode ? 'FECHAR MODO REUNIÃO' : 'MODO REUNIÃO'}</button><button type="button" className="briefing-copy-btn" onClick={copyBriefing} disabled={!analytics}>{copyStatus || 'COPIAR BRIEFING'}</button></div></div>
      {loading ? <div className="executive-history-empty">Calculando analytics executiva...</div> : error ? <div className="executive-history-notice"><Info size={14} /> {error}</div> : meetingMode ? (
        <div className="meeting-briefing">
          <div className="meeting-briefing-kicker">BRIEFING EXECUTIVO · MODO REUNIÃO</div>
          <h3>{analytics.briefingDocument?.title || 'Briefing Executivo do Nexus'}</h3>
          <p className="meeting-opening">{analytics.briefingDocument?.opening}</p>
          <div className="meeting-section"><span>PRIORIDADES</span><ol>{(analytics.briefingDocument?.priorities || []).map((priority, index) => <li key={`${priority}-${index}`}>{priority}</li>)}</ol></div>
          <div className="meeting-section"><span>RISCOS PERSISTENTES</span>{(analytics.briefingDocument?.risks || []).length ? analytics.briefingDocument.risks.slice(0, 5).map(risk => <p key={risk.id}><b>{risk.title}</b> — {risk.reason}</p>) : <p>Nenhum risco persistente identificado.</p>}</div>
          <div className="meeting-section"><span>CHECKPOINT</span><p>{analytics.briefingDocument?.nextCheckpoint}</p></div>
          <small>Leitura executiva por link. Fontes operacionais permanecem no Monday e no Vybe Painel.</small>
        </div>
      ) : (
        <>
          <div className="analytics-summary-grid"><div><span>DECISÕES AVALIADAS</span><strong>{analytics.effectiveness.evaluatedDecisions}</strong><small>{analytics.effectiveness.pendingEvaluation} aguardando impacto</small></div><div><span>TAXA DE SINAL POSITIVO</span><strong>{analytics.effectiveness.positiveRate === null ? '—' : `${analytics.effectiveness.positiveRate}%`}</strong><small>{analytics.effectiveness.label}</small></div><div><span>RISCOS PERSISTENTES</span><strong className={analytics.persistentRisks.length ? 'analytics-risk-value' : ''}>{analytics.persistentRisks.length}</strong><small>decisões, impactos ou clientes</small></div><div><span>PADRÕES DETECTADOS</span><strong>{analytics.patterns.patterns.length}</strong><small>{analytics.patterns.note}</small></div></div>
          {(analytics.alerts || []).length > 0 && <div className="analytics-alert-strip"><div className="executive-block-heading"><AlertTriangle size={15} /><span>ALERTAS EXECUTIVOS · SOMENTE LEITURA</span></div><div className="analytics-alert-list">{analytics.alerts.slice(0, 5).map(alert => <article key={alert.id} className={`analytics-alert-item ${alert.severity}`}><span>{alert.label} · {alert.lifecycle || 'detected'}</span><b>{alert.title}</b><small>{alert.reason}</small></article>)}</div></div>}
          <div className="analytics-columns"><div className="analytics-block"><div className="executive-block-heading"><AlertTriangle size={15} /><span>RISCO PERSISTENTE</span></div>{analytics.persistentRisks.length === 0 ? <div className="executive-empty">Nenhum risco persistente identificado no histórico disponível.</div> : analytics.persistentRisks.slice(0, showAllRisks ? analytics.persistentRisks.length : 5).map(risk => <article className={`analytics-risk-card ${risk.severity}`} key={risk.id}><div><span>{risk.severity?.toUpperCase()}</span><b>{risk.title}</b></div><p>{risk.reason}</p><small>{risk.recommendedAction}</small></article>)}{analytics.persistentRisks.length > 5 && <button type="button" className="decision-see-more" onClick={() => setShowAllRisks(current => !current)}>{showAllRisks ? 'MOSTRAR MENOS' : `VER MAIS (${analytics.persistentRisks.length - 5})`}</button>}</div><div className="analytics-block"><div className="executive-block-heading"><CheckCircle2 size={15} /><span>BRIEFING DE LIDERANÇA</span></div><p className="briefing-opening">{analytics.briefing.opening}</p><ol className="briefing-priorities">{analytics.briefing.priorities.map((priority, index) => <li key={`${priority}-${index}`}>{priority}</li>)}</ol><small className="briefing-checkpoint">{analytics.briefing.nextCheckpoint}</small></div></div>
          {analytics.patterns.patterns.length > 0 && <div className="analytics-pattern-row">{analytics.patterns.patterns.map(pattern => <span key={pattern.label}><b>{pattern.count}</b> {pattern.label}</span>)}</div>}
        </>
      )}
    </section>
  );
}

function DecisionMemory() {
  const [memory, setMemory] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/executive/memory${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)
        .then(response => response.json())
        .then(data => setMemory(data.memory || null))
        .catch(() => setMemory(null))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const records = memory?.records || [];
  return <section className="executive-memory card" aria-labelledby="executive-memory-title"><div className="executive-section-header"><div><div className="executive-kicker"><History size={15} /> EXECUTIVE MEMORY · SPRINT 9</div><h2 id="executive-memory-title">MEMÓRIA DE DECISÕES</h2><p>Consulte diretrizes, evidências e impactos anteriores sem reproduzir a fila do Monday.</p></div><span className="analytics-read-badge">LEITURA PÚBLICA · LINK</span></div><div className="memory-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar decisão, cliente ou diretriz..." aria-label="Buscar na memória executiva" /><span>{loading ? 'BUSCANDO...' : `${memory?.total || 0} REGISTROS`}</span></div>{!loading && records.length === 0 ? <div className="executive-history-empty">Nenhuma decisão encontrada no histórico disponível.</div> : <div className="memory-list">{records.slice(0, showAll ? records.length : 5).map(record => <article className="memory-item" key={record.id}><div className="memory-item-main"><span className="memory-status-tag">{record.status}</span><b>{record.title}</b><small>{record.clientId || 'Carteira'} · {record.ownerRole}</small></div><div className="memory-item-impact">{record.impact ? <><span className={`impact-tag ${record.impact.result}`}>{record.impact.result}</span><small>{record.impact.observedIndicator || 'Impacto registrado'}</small></> : <span className="impact-pending">IMPACTO PENDENTE</span>}</div></article>)}</div>}{records.length > 5 && <button type="button" className="decision-see-more" onClick={() => setShowAll(current => !current)}>{showAll ? 'MOSTRAR MENOS' : `VER MAIS (${records.length - 5})`}</button>}</section>;
}

function ScenarioPlanner() {
  const [scenarios, setScenarios] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/executive/scenarios').then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Cenários aguardando histórico persistido.'); setScenarios(data.scenarios || []); }).catch(error => setError(error.message)); }, []);
  return <section className="scenario-planner card" aria-labelledby="scenario-planner-title"><div className="executive-section-header"><div><div className="executive-kicker"><GitBranch size={15} /> EXECUTIVE PLANNING · SPRINT 10</div><h2 id="scenario-planner-title">CENÁRIOS DE PLANEJAMENTO</h2><p>Simulações executivas para orientar CMO e COO. Não são previsões nem alteram o Monday.</p></div><span className="scenario-badge">SIMULAÇÃO</span></div>{error ? <div className="executive-history-notice"><Info size={14} /> {error}</div> : <div className="scenario-grid">{scenarios.map(scenario => <article className="scenario-card" key={scenario.id}><div className="scenario-card-top"><span>{scenario.audience}</span><small>CONFIANÇA {scenario.confidence}</small></div><h3>{scenario.title}</h3><p className="scenario-question">{scenario.question}</p><div className="scenario-signals"><b>SINAIS</b>{scenario.signals.map(signal => <span key={signal}>{signal}</span>)}</div><p className="scenario-recommendation"><b>HIPÓTESE:</b> {scenario.recommendation}</p>{scenario.comparison && <div className="scenario-comparison"><b>COMPARAR</b>{scenario.comparison.map(option => <span key={option.label}><strong>{option.label}</strong> — {option.implication}</span>)}</div>}<small className="scenario-limit">As premissas devem ser revisadas antes de uma diretriz.</small></article>)}</div>}</section>;
}

function OutcomeLearning() {
  const [learning, setLearning] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/executive/analytics').then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Aprendizados aguardando histórico persistido.'); setLearning(data.analytics?.learning || null); }).catch(error => setError(error.message)); }, []);
  return <section className="outcome-learning card" aria-labelledby="outcome-learning-title"><div className="executive-section-header"><div><div className="executive-kicker"><ListChecks size={15} /> OUTCOME LEARNING · SPRINT 10</div><h2 id="outcome-learning-title">O QUE APRENDEMOS?</h2><p>Associações observadas no histórico do Nexus, sem afirmar causalidade automática.</p></div><span className="analytics-read-badge">EVIDÊNCIA · LINK</span></div>{error ? <div className="executive-history-notice"><Info size={14} /> {error}</div> : <div className="learning-grid">{(learning?.learnings || []).map(item => <article className="learning-card" key={item.id}><div className="learning-card-top"><span>{item.evidenceCount} evidência(s)</span><small>CONFIANÇA {item.confidence}</small></div><h3>{item.title}</h3><p>{item.summary}</p><small>{item.caveat}</small></article>)}</div>}{learning?.note && <small className="learning-note">{learning.note}</small>}</section>;
}

function CommandCenter() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanText, setScanText] = useState("Consultando dados atuais do Monday.com...");
  const [meta, setMeta] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [tableSortMode, setTableSortMode] = useState('veic');
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredDonut, setHoveredDonut] = useState(null);
  const [barModalClient, setBarModalClient] = useState(null);
  const [personModalData, setPersonModalData] = useState(null);
  const [attentionFilters, setAttentionFilters] = useState({ search: '', client: 'Todos', type: 'Todos', responsavel: 'Todos' });

  const getModalContent = () => {
    if (!activeModal || !metrics) return { title: '', items: [] };
    
    let title = '';
    let items = [];

    if (activeModal === 'fila') {
      title = 'Total em Fila (Produção Aberta)';
      metrics.posts.ranking.forEach(c => {
        c.details.forEach(p => items.push({...p, clientName: c.name}));
      });
      items.sort((a, b) => new Date(a.prazo || '2099-12-31') - new Date(b.prazo || '2099-12-31'));
    } else if (activeModal === 'equipe') {
      title = 'Atraso Equipe (Gargalo Interno)';
      metrics.posts.ranking.forEach(c => {
        c.details.filter(p => p.isDelayedPrazo).forEach(p => items.push({...p, clientName: c.name}));
      });
      items.sort((a, b) => new Date(a.prazo || '2099-12-31') - new Date(b.prazo || '2099-12-31'));
    } else if (activeModal === 'cliente') {
      title = 'Atraso Cliente (Impacto na Rua)';
      metrics.posts.ranking.forEach(c => {
        c.details.filter(p => p.isDelayedVeiculacao).forEach(p => items.push({...p, clientName: c.name}));
      });
      items.sort((a, b) => new Date(a.veiculacao || '2099-12-31') - new Date(b.veiculacao || '2099-12-31'));
    } else if (activeModal === 'setup') {
      title = 'Demandas e Setup';
      metrics.demands.forEach(d => items.push({...d, clientName: d.cliente, isDemand: true}));
      metrics.bottlenecks.missingPlanning.forEach(c => items.push({name: 'Sem Planejamento Estratégico', clientName: c, isSetup: true}));
      metrics.bottlenecks.missingDashboard.forEach(c => items.push({name: 'Dashboard Desatualizado', clientName: c, isSetup: true}));
      items.sort((a, b) => {
        if (a.isSetup) return -1; // Sem data joga pro topo (crítico)
        if (b.isSetup) return 1;
        return new Date(a.prazo || '2099-12-31') - new Date(b.prazo || '2099-12-31');
      });
    }

    return { title, items };
  };

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


  const attentionItems = metrics?.attentionQueue || [];
  const attentionMeta = metrics?.filters || { clients: [], responsaveis: [] };
  const filteredAttention = attentionItems.filter(item => {
    const search = attentionFilters.search.trim().toLowerCase();
    const matchesSearch = !search || [item.title, item.client, item.owner, item.reason].filter(Boolean).join(' ').toLowerCase().includes(search);
    const matchesClient = attentionFilters.client === 'Todos' || item.client === attentionFilters.client;
    const matchesType = attentionFilters.type === 'Todos' || item.type === attentionFilters.type;
    const matchesOwner = attentionFilters.responsavel === 'Todos' || item.owner === attentionFilters.responsavel;
    return matchesSearch && matchesClient && matchesType && matchesOwner;
  });
  const attentionSummary = metrics?.attentionSummary || {
    total: attentionItems.length,
    critical: attentionItems.filter(item => item.priority === 'critical').length,
    content: attentionItems.filter(item => item.type === 'content').length,
    demands: attentionItems.filter(item => item.type === 'demand').length,
    setup: attentionItems.filter(item => item.type === 'setup').length
  };
  const hasAttentionFilters = Object.values(attentionFilters).some(value => value !== '' && value !== 'Todos');
  const resetAttentionFilters = () => setAttentionFilters({ search: '', client: 'Todos', type: 'Todos', responsavel: 'Todos' });

  if (loading) return <SyncOverlay text={scanText} />;

  if (error) return <ErrorState message={error} onRetry={loadMetrics} />;

  return (
    <div className="container" style={{ padding: '2rem' }}>
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>VYBE <span className="glitch-text" style={{color: 'var(--cy-neon-purple)'}}>NEXUS</span></h1>
          <p style={{fontFamily: 'var(--font-mono)', marginTop: '0.5rem', color: 'var(--cy-text-secondary)'}}>
            COCKPIT DE COMANDO E DECISÃO - CMO / COO
          </p>
        </div>
        <div className="header-meta">
          <span className="header-badge" style={{borderColor: 'var(--cy-neon-purple)', color: 'var(--cy-neon-purple)'}}>COMMAND_LAYER</span>
          <span className="sync-meta" aria-live="polite">{meta?.source || 'Monday.com'} · {meta?.generatedAt ? `ATUALIZADO ${formatDateTime(meta.generatedAt)}` : 'ATUALIZAÇÃO RECENTE'}</span>
        </div>
      </header>

      <ExecutiveCockpit snapshot={metrics.executiveSnapshot} />
      <DecisionRegistry />
      <ExecutiveHistory />
      <ImpactRegistry />
      <ExecutiveAnalytics />
      <DecisionMemory />
      <ScenarioPlanner />
      <OutcomeLearning />

      <details className="production-evidence">
        <summary className="production-evidence-summary">
          <div><span className="evidence-kicker"><Layers size={14} /> MONDAY / EVIDÊNCIA CONTEXTUAL</span><strong>Ver detalhes de produção e execução</strong><small>O Vybe Painel e o Monday continuam sendo a fonte e a camada de operação.</small></div>
          <ChevronDown size={18} />
        </summary>
        <div className="production-evidence-content">
      {/* KPI SECTION */}
      <div className="kpi-overview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="kpi-card" role="button" tabIndex={0} aria-label="Abrir itens em fila" onClick={() => setActiveModal('fila')} onKeyDown={(event) => activateOnKeyboard(event, () => setActiveModal('fila'))} style={{ borderTop: '3px solid #fff' }}>
          <Layers size={20} color="var(--cy-text-secondary)" style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.5 }} />
          <span style={{ color: 'var(--cy-text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total em Fila</span>
          <span style={{ color: '#fff', fontSize: '3rem', fontWeight: 'bold' }}>{metrics.posts.ranking.reduce((acc, c) => acc + c.open, 0)}</span>
        </div>
        <div className="kpi-card" role="button" tabIndex={0} aria-label="Abrir atrasos da equipe" onClick={() => setActiveModal('equipe')} onKeyDown={(event) => activateOnKeyboard(event, () => setActiveModal('equipe'))} style={{ borderTop: '3px solid var(--cy-neon-yellow)' }}>
          <Clock size={20} color="var(--cy-neon-yellow)" style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.5 }} />
          <span style={{ color: 'var(--cy-text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Atraso Equipe</span>
          <span style={{ color: 'var(--cy-neon-yellow)', fontSize: '3rem', fontWeight: 'bold', textShadow: '0 0 15px rgba(255, 234, 0, 0.4)' }}>{metrics.posts.ranking.reduce((acc, c) => acc + c.delayedPrazo, 0)}</span>
        </div>
        <div className="kpi-card" role="button" tabIndex={0} aria-label="Abrir atrasos do cliente" onClick={() => setActiveModal('cliente')} onKeyDown={(event) => activateOnKeyboard(event, () => setActiveModal('cliente'))} style={{ borderTop: '3px solid var(--cy-neon-magenta)' }}>
          <AlertTriangle size={20} color="var(--cy-neon-magenta)" style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.5 }} />
          <span style={{ color: 'var(--cy-text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Atraso Cliente</span>
          <span style={{ color: 'var(--cy-neon-magenta)', fontSize: '3rem', fontWeight: 'bold', textShadow: '0 0 15px rgba(255, 0, 102, 0.4)' }}>{metrics.posts.ranking.reduce((acc, c) => acc + c.delayedVeiculacao, 0)}</span>
        </div>
        <div className="kpi-card" role="button" tabIndex={0} aria-label="Abrir demandas e setup" onClick={() => setActiveModal('setup')} onKeyDown={(event) => activateOnKeyboard(event, () => setActiveModal('setup'))} style={{ borderTop: '3px solid var(--cy-neon-cyan)' }}>
          <ActivitySquare size={20} color="var(--cy-neon-cyan)" style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.5 }} />
          <span style={{ color: 'var(--cy-text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Demandas + Setup</span>
          <span style={{ color: 'var(--cy-neon-cyan)', fontSize: '3rem', fontWeight: 'bold', textShadow: '0 0 15px rgba(0, 243, 255, 0.4)' }}>{metrics.demands.length + metrics.bottlenecks.missingPlanning.length}</span>
        </div>
      </div>



      <section className="attention-panel card" aria-labelledby="attention-title">
        <div className="attention-panel-header">
          <div>
            <div className="attention-kicker"><ListChecks size={15} /> OPERATIONAL EVIDENCE</div>
            <h2 id="attention-title">SINAIS OPERACIONAIS DE APOIO</h2>
            <p>Evidências do Monday e do Vybe Painel para contextualizar riscos e decisões executivas.</p>
          </div>
          <span className="attention-total">{attentionSummary.total} itens</span>
        </div>

        <div className="attention-summary">
          <div className="attention-summary-card critical"><strong>{attentionSummary.critical}</strong><span>CRÍTICOS</span></div>
          <div className="attention-summary-card"><strong>{attentionSummary.content}</strong><span>CONTEÚDOS</span></div>
          <div className="attention-summary-card"><strong>{attentionSummary.demands}</strong><span>DEMANDAS</span></div>
          <div className="attention-summary-card"><strong>{attentionSummary.setup}</strong><span>SETUPS</span></div>
        </div>

        <div className="attention-filters" aria-label="Filtros de evidência operacional">
          <label className="attention-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={attentionFilters.search}
              onChange={(event) => setAttentionFilters(current => ({ ...current, search: event.target.value }))}
              placeholder="Buscar item, cliente ou responsável..."
              aria-label="Buscar na fila de atenção"
            />
          </label>
          <select value={attentionFilters.client} onChange={(event) => setAttentionFilters(current => ({ ...current, client: event.target.value }))} aria-label="Filtrar por cliente">
            <option value="Todos">Todos os clientes</option>
            {attentionMeta.clients.map(client => <option key={client} value={client}>{client}</option>)}
          </select>
          <select value={attentionFilters.type} onChange={(event) => setAttentionFilters(current => ({ ...current, type: event.target.value }))} aria-label="Filtrar por tipo">
            <option value="Todos">Todos os tipos</option>
            <option value="content">Conteúdo</option>
            <option value="demand">Demanda</option>
            <option value="setup">Setup</option>
          </select>
          <select value={attentionFilters.responsavel} onChange={(event) => setAttentionFilters(current => ({ ...current, responsavel: event.target.value }))} aria-label="Filtrar por responsável">
            <option value="Todos">Todos os responsáveis</option>
            {attentionMeta.responsaveis.map(owner => <option key={owner} value={owner}>{owner}</option>)}
          </select>
          {hasAttentionFilters && <button type="button" className="clear-filter-btn" onClick={resetAttentionFilters}><X size={14} /> Limpar</button>}
        </div>

        <div className="attention-list">
          {filteredAttention.slice(0, 10).map(item => (
            <div className="attention-row" key={item.key}>
              <div className="attention-row-top">
                <div className="attention-tags">
                  <span className={`attention-priority ${item.priority}`}>{attentionPriorityLabels[item.priority] || item.priority}</span>
                  <span className={`attention-type ${item.type}`}>{attentionTypeLabels[item.type] || item.type}</span>
                </div>
                {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="attention-open">Abrir no Monday <ChevronRight size={14} /></a>}
              </div>
              <strong className="attention-title">{item.title}</strong>
              <div className="attention-context">
                <span>{item.client}</span>
                <span>{item.owner}</span>
                <span>{item.reason}</span>
                {item.dueDate && <span>Prazo {formatDate(item.dueDate)}</span>}
              </div>
            </div>
          ))}
          {filteredAttention.length === 0 && <div className="empty-state">Nenhum item corresponde aos filtros atuais.</div>}
        </div>
        {filteredAttention.length > 10 && <div className="attention-footer">Mostrando 10 de {filteredAttention.length} itens filtrados. Use os filtros para reduzir a fila.</div>}
      </section>

      {/* CHARTS SECTION - Custom SVG */}
      <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* BAR CHART custom */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7 }}>Gargalos de Produção por Cliente</h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {metrics.posts.ranking.slice(0, 8).map((c, i) => {
              const total = c.delayedPrazo + c.delayedVeiculacao;
              const maxTotal = Math.max(...metrics.posts.ranking.slice(0, 8).map(x => x.delayedPrazo + x.delayedVeiculacao)) || 1;
              const pctEquipe = (c.delayedPrazo / maxTotal) * 100;
              const pctAgencia = (c.delayedVeiculacao / maxTotal) * 100;
              const isHovered = hoveredBar === i;
              return (
                <div key={i} role="button" tabIndex={0} aria-label={`Ver gargalos de ${c.name}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}
                  onKeyDown={(event) => activateOnKeyboard(event, () => setBarModalClient(c))}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onClick={() => setBarModalClient(c)}
                >
                  <span style={{ width: '110px', fontSize: '0.72rem', color: isHovered ? '#fff' : 'var(--cy-text-secondary)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.2s', cursor: 'pointer' }} title={c.name}>{c.name}</span>
                  <div style={{ flex: 1, height: isHovered ? '24px' : '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', display: 'flex', transition: 'height 0.15s ease', cursor: 'pointer' }}>
                    {c.delayedPrazo > 0 && <div style={{ width: `${pctEquipe}%`, background: 'var(--cy-neon-yellow)', transition: 'width 0.6s ease', opacity: isHovered ? 1 : 0.85 }} />}
                    {c.delayedVeiculacao > 0 && <div style={{ width: `${pctAgencia}%`, background: 'var(--cy-neon-magenta)', transition: 'width 0.6s ease', opacity: isHovered ? 1 : 0.85 }} />}
                  </div>
                  <span style={{ width: '24px', fontSize: '0.72rem', color: isHovered ? 'var(--cy-neon-yellow)' : '#fff', fontWeight: 'bold', flexShrink: 0, transition: 'color 0.2s' }}>{total}</span>
                  {isHovered && (
                    <div style={{ position: 'absolute', right: '40px', top: '-48px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '8px 12px', zIndex: 100, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{c.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--cy-neon-yellow)', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span>🟡 Equipe (Prazo)</span><span>{c.delayedPrazo} posts</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--cy-neon-magenta)', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span>🟣 Agência (Veic.)</span><span>{c.delayedVeiculacao} posts</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px', textAlign: 'center' }}>Clique para ver detalhes</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--cy-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--cy-neon-yellow)', display: 'inline-block' }} /> Equipe (Prazo)
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--cy-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--cy-neon-magenta)', display: 'inline-block' }} /> Agência (Veiculacão)
            </span>
          </div>
        </div>

        {/* DONUT CHART custom SVG */}
        {(() => {
          const equipe = metrics.posts.ranking.reduce((acc, c) => acc + c.delayedPrazo, 0);
          const agencia = metrics.posts.ranking.reduce((acc, c) => acc + c.delayedVeiculacao, 0);
          const total = equipe + agencia || 1;
          const pctE = equipe / total;
          const pctA = agencia / total;
          const r = 60; const cx = 100; const cy = 100;
          const circ = 2 * Math.PI * r;
          const dashE = circ * pctE - 4;
          const dashA = circ * pctA - 4;
          const offsetA = circ * pctE;
          const hE = hoveredDonut === 'equipe';
          const hA = hoveredDonut === 'agencia';
          return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7, width: '100%' }}>Distribuição do Atraso</h3>
              <svg viewBox="0 0 200 200" width="160" height="160" style={{ overflow: 'visible' }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="20" />
                {equipe > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--cy-neon-yellow)" strokeWidth={hE ? 26 : 20}
                  strokeDasharray={`${dashE} ${circ}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ filter: hE ? 'drop-shadow(0 0 12px rgba(255,234,0,0.9))' : 'drop-shadow(0 0 6px rgba(255,234,0,0.5))', transition: 'all 0.2s ease', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredDonut('equipe')}
                  onMouseLeave={() => setHoveredDonut(null)}
                />}
                {agencia > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--cy-neon-magenta)" strokeWidth={hA ? 26 : 20}
                  strokeDasharray={`${dashA} ${circ}`}
                  strokeDashoffset={-offsetA}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ filter: hA ? 'drop-shadow(0 0 12px rgba(255,0,102,0.9))' : 'drop-shadow(0 0 6px rgba(255,0,102,0.5))', transition: 'all 0.2s ease', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredDonut('agencia')}
                  onMouseLeave={() => setHoveredDonut(null)}
                />}
                {hoveredDonut === 'equipe' && (
                  <>
                    <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--cy-neon-yellow)" fontSize="20" fontWeight="bold">{equipe}</text>
                    <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" letterSpacing="1">EQUIPE</text>
                    <text x={cx} y={cy + 20} textAnchor="middle" fill="var(--cy-neon-yellow)" fontSize="11">{Math.round(pctE * 100)}%</text>
                  </>
                )}
                {hoveredDonut === 'agencia' && (
                  <>
                    <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--cy-neon-magenta)" fontSize="20" fontWeight="bold">{agencia}</text>
                    <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" letterSpacing="1">AGÊNCIA</text>
                    <text x={cx} y={cy + 20} textAnchor="middle" fill="var(--cy-neon-magenta)" fontSize="11">{Math.round(pctA * 100)}%</text>
                  </>
                )}
                {!hoveredDonut && (
                  <>
                    <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="bold">{total}</text>
                    <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" letterSpacing="1">TOTAL</text>
                  </>
                )}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', background: hE ? 'rgba(255,234,0,0.08)' : 'transparent', transition: 'background 0.2s' }}
                  onMouseEnter={() => setHoveredDonut('equipe')}
                  onMouseLeave={() => setHoveredDonut(null)}
                >
                  <span style={{ fontSize: '0.75rem', color: hE ? '#fff' : 'var(--cy-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--cy-neon-yellow)', display: 'inline-block' }} /> Equipe (Prazo)
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--cy-neon-yellow)' }}>{equipe} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>({Math.round(pctE * 100)}%)</span></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', background: hA ? 'rgba(255,0,102,0.08)' : 'transparent', transition: 'background 0.2s' }}
                  onMouseEnter={() => setHoveredDonut('agencia')}
                  onMouseLeave={() => setHoveredDonut(null)}
                >
                  <span style={{ fontSize: '0.75rem', color: hA ? '#fff' : 'var(--cy-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--cy-neon-magenta)', display: 'inline-block' }} /> Agência (Veic.)
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--cy-neon-magenta)' }}>{agencia} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>({Math.round(pctA * 100)}%)</span></span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* MODAL DETALHES DO CLIENTE (clique nas barras) */}
      {barModalClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setBarModalClient(null)}
        >
          <div style={{ background: '#131313', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '2rem', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>{barModalClient.name}</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--cy-text-secondary)', letterSpacing: '1px' }}>GARGALOS DE PRODUCÃO</span>
              </div>
              <button type="button" aria-label="Fechar detalhes do cliente" onClick={() => setBarModalClient(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255,234,0,0.08)', border: '1px solid rgba(255,234,0,0.2)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--cy-neon-yellow)' }}>{barModalClient.delayedPrazo}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--cy-text-secondary)', marginTop: '4px' }}>ATRASO EQUIPE (PRAZO)</div>
              </div>
              <div style={{ background: 'rgba(255,0,102,0.08)', border: '1px solid rgba(255,0,102,0.2)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--cy-neon-magenta)' }}>{barModalClient.delayedVeiculacao}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--cy-text-secondary)', marginTop: '4px' }}>ATRASO AGÊNCIA (VEIC.)</div>
              </div>
            </div>
            <h4 style={{ color: 'var(--cy-text-secondary)', fontSize: '0.75rem', letterSpacing: '1px', marginBottom: '0.75rem' }}>POSTS COM GARGALO</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {barModalClient.details && barModalClient.details.filter(p => p.isDelayedPrazo || p.isDelayedVeiculacao).map((p, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#fff', flex: 1 }}>{p.name}</span>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {p.isDelayedPrazo && <span style={{ fontSize: '0.65rem', background: 'rgba(255,234,0,0.15)', color: 'var(--cy-neon-yellow)', padding: '2px 8px', borderRadius: '4px' }}>EQUIPE</span>}
                    {p.isDelayedVeiculacao && <span style={{ fontSize: '0.65rem', background: 'rgba(255,0,102,0.15)', color: 'var(--cy-neon-magenta)', padding: '2px 8px', borderRadius: '4px' }}>AGÊNCIA</span>}
                  </div>
                  {p.prazo && <span style={{ fontSize: '0.7rem', color: 'var(--cy-text-secondary)', flexShrink: 0 }}>{formatDate(p.prazo)}</span>}
                </div>
              ))}
              {(!barModalClient.details || barModalClient.details.filter(p => p.isDelayedPrazo || p.isDelayedVeiculacao).length === 0) && (
                <p style={{ color: 'var(--cy-text-secondary)', fontSize: '0.85rem' }}>Nenhum post detalhado disponível.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RANKING DE RESPONSÁVEIS */}
      {metrics.posts.responsavelRanking && metrics.posts.responsavelRanking.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
                Quem está Atrasando?
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--cy-text-secondary)' }}>Ranking de responsáveis por atrasos em produção</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--cy-neon-magenta)', background: 'rgba(255,0,102,0.1)', border: '1px solid rgba(255,0,102,0.2)', padding: '3px 10px', borderRadius: '20px' }}>
              {metrics.posts.responsavelRanking.length} pessoas com atraso
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {metrics.posts.responsavelRanking.slice(0, 12).map((person, idx) => {
              const totalPerson = person.delayedPrazo + person.delayedVeiculacao;
              const maxTotal = metrics.posts.responsavelRanking[0] ? metrics.posts.responsavelRanking[0].delayedPrazo + metrics.posts.responsavelRanking[0].delayedVeiculacao : 1;
              const pct = (totalPerson / maxTotal) * 100;
              const isCritical = totalPerson >= 10;
              const isWarning = totalPerson >= 5 && totalPerson < 10;
              const borderColor = isCritical ? 'var(--cy-neon-magenta)' : isWarning ? 'var(--cy-neon-yellow)' : 'rgba(255,255,255,0.1)';
              const numColor = isCritical ? 'var(--cy-neon-magenta)' : isWarning ? 'var(--cy-neon-yellow)' : 'var(--cy-neon-cyan)';
              return (
                <div key={idx}
                  onClick={() => setPersonModalData(person)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', transition: 'background 0.2s, transform 0.15s', userSelect: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>{person.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--cy-text-secondary)', marginTop: '2px', letterSpacing: '0.5px' }}>{person.tipo || 'Equipe'}</div>
                    </div>
                    <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: numColor, lineHeight: 1 }}>{totalPerson}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {person.delayedPrazo > 0 && (
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255,234,0,0.12)', color: 'var(--cy-neon-yellow)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        ⏱ {person.delayedPrazo} prazo
                      </span>
                    )}
                    {person.delayedVeiculacao > 0 && (
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255,0,102,0.12)', color: 'var(--cy-neon-magenta)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        📅 {person.delayedVeiculacao} veic.
                      </span>
                    )}
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: numColor, borderRadius: '2px', transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>Clique para ver posts →</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL PESSOA */}
      {personModalData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setPersonModalData(null)}
        >
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '2rem', width: '100%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '4px' }}>{personModalData.name}</h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--cy-text-secondary)', letterSpacing: '1px' }}>{personModalData.tipo?.toUpperCase() || 'EQUIPE'} &nbsp;&bull;&nbsp; {personModalData.posts.length} POSTS ATRASADOS</span>
              </div>
              <button type="button" aria-label="Fechar detalhes do responsável" onClick={() => setPersonModalData(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0' }}>×</button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,234,0,0.07)', border: '1px solid rgba(255,234,0,0.2)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--cy-neon-yellow)' }}>{personModalData.delayedPrazo}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--cy-text-secondary)', marginTop: '4px', letterSpacing: '1px' }}>⏱ ATRASO DE PRAZO (INTERNO)</div>
              </div>
              <div style={{ background: 'rgba(255,0,102,0.07)', border: '1px solid rgba(255,0,102,0.2)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--cy-neon-magenta)' }}>{personModalData.delayedVeiculacao}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--cy-text-secondary)', marginTop: '4px', letterSpacing: '1px' }}>📅 JÁ DEVIA ESTAR NO AR</div>
              </div>
            </div>

            {/* Posts list grouped by client */}
            {(() => {
              const byClient = {};
              personModalData.posts.forEach(p => {
                if (!byClient[p.cliente]) byClient[p.cliente] = [];
                byClient[p.cliente].push(p);
              });
              return Object.entries(byClient).map(([clienteName, posts]) => (
                <div key={clienteName}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--cy-neon-cyan)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid rgba(0,243,255,0.1)', paddingBottom: '6px' }}>
                    {clienteName} &mdash; {posts.length} post{posts.length > 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {posts.map((p, i) => (
                      <div key={i}
                        onClick={() => window.open(`https://vybehub.monday.com/boards/7829537690/pulses/${p.id}`, '_blank')}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none' }}>
                        <span style={{ fontSize: '0.82rem', color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.postName}>{p.postName}</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          {p.isDelayedPrazo && <span style={{ fontSize: '0.6rem', background: 'rgba(255,234,0,0.15)', color: 'var(--cy-neon-yellow)', padding: '2px 7px', borderRadius: '4px' }}>PRAZO</span>}
                          {p.isDelayedVeiculacao && <span style={{ fontSize: '0.6rem', background: 'rgba(255,0,102,0.15)', color: 'var(--cy-neon-magenta)', padding: '2px 7px', borderRadius: '4px' }}>VEIC.</span>}
                          {p.prazo && <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>{formatDate(p.prazo)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <div className="bottom-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* BOTTLENECKS */}
        <div className="card critical" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 style={{color: 'var(--cy-neon-magenta)'}}>Gargalos Estratégicos</h3>
              <span className="niche-badge" style={{color: 'var(--cy-neon-magenta)', borderColor: 'var(--cy-neon-magenta)'}}>Setup & Planejamento</span>
            </div>
            <AlertTriangle size={24} color="var(--cy-neon-magenta)" />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ color: 'var(--cy-text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Sem Planejamento ({metrics.bottlenecks.missingPlanning.length})</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0', maxHeight: '150px', overflowY: 'auto' }}>
              {metrics.bottlenecks.missingPlanning.map((c, i) => <li key={i} style={{fontSize: '0.85rem', marginBottom: '0.2rem', padding: '0.2rem 0', borderBottom: '1px solid #222'}}>• {c}</li>)}
            </ul>
            
            <h4 style={{ color: 'var(--cy-text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Dashboard Atrasado/Pendente ({metrics.bottlenecks.missingDashboard.length})</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
              {metrics.bottlenecks.missingDashboard.map((c, i) => <li key={i} style={{fontSize: '0.85rem', marginBottom: '0.2rem', padding: '0.2rem 0', borderBottom: '1px solid #222'}}>• {c}</li>)}
            </ul>
          </div>
        </div>

        {/* POSTS ATRASADOS */}
        <div className="card warning" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{color: 'var(--cy-neon-yellow)'}}>Conteúdo Atrasado</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem' }}>
                <span className="niche-badge" style={{color: 'var(--cy-neon-yellow)', borderColor: 'var(--cy-neon-yellow)'}}>Total: {metrics.posts.totalDelayed} posts</span>
                <button onClick={() => setTableSortMode(m => m === 'veic' ? 'prazo' : 'veic')} style={{ background: 'rgba(255, 234, 0, 0.1)', border: '1px solid var(--cy-neon-yellow)', color: 'var(--cy-neon-yellow)', padding: '0.2rem 0.6rem', cursor: 'pointer', borderRadius: '2px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Filtrar: {tableSortMode === 'veic' ? 'Veiculação (Agência)' : 'Prazo (Equipe)'}
                </button>
              </div>
            </div>
            <Clock size={24} color="var(--cy-neon-yellow)" />
          </div>
          <div style={{ marginTop: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #333', color: 'var(--cy-text-secondary)' }}>Cliente</th>
                  <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #333', color: 'var(--cy-text-secondary)', textAlign: 'center' }}>Abertos</th>
                  <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #333', color: 'var(--cy-text-secondary)', textAlign: 'center' }} title="Atraso da Equipe Interna (Prazo)">Eqp.</th>
                  <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #333', color: 'var(--cy-text-secondary)', textAlign: 'center' }} title="Atraso da Agência p/ Cliente (Veiculação)">Agn.</th>
                </tr>
              </thead>
              <tbody>
                {[...metrics.posts.ranking].sort((a, b) => {
                  if (tableSortMode === 'veic') return b.delayedVeiculacao - a.delayedVeiculacao || b.delayedPrazo - a.delayedPrazo || b.open - a.open;
                  return b.delayedPrazo - a.delayedPrazo || b.delayedVeiculacao - a.delayedVeiculacao || b.open - a.open;
                }).map((row, i) => (
                  <ClientPostsRow key={i} row={row} sortMode={tableSortMode} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DEMANDAS TRAVADAS */}
        <div className="card normal" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 style={{color: 'var(--cy-neon-cyan)'}}>Demandas Atrasadas</h3>
              <span className="niche-badge" style={{color: 'var(--cy-neon-cyan)', borderColor: 'var(--cy-neon-cyan)'}}>Total: {metrics.demands.length} demands</span>
            </div>
            <ActivitySquare size={24} color="var(--cy-neon-cyan)" />
          </div>
          <div style={{ marginTop: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {metrics.demands.map((d, i) => (
                <DemandItem key={i} demand={d} />
              ))}
            </ul>
          </div>
        </div>
      </div>
        </div>
      </details>

      {/* MODAL OVERLAY */}
      {activeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setActiveModal(null)}>
          <div className="card modal-content" style={{ width: '90%', maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#fff', margin: 0 }}>{getModalContent().title}</h2>
              <button type="button" aria-label="Fechar lista de detalhes" onClick={() => setActiveModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--cy-text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {getModalContent().items.length > 0 ? getModalContent().items.map((item, idx) => (
                  <li key={idx} style={{ padding: '1rem', borderBottom: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ color: 'var(--cy-neon-cyan)', fontWeight: 'bold' }}>{item.clientName}</div>
                    <div style={{ color: '#fff', fontSize: '0.9rem' }}>{item.name}</div>
                    {item.isDemand ? (
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--cy-text-secondary)', alignItems: 'center' }}>
                        <span>Status: <span style={{color:'var(--cy-neon-yellow)'}}>{item.status}</span></span>
                        <span>Prazo: {formatDate(item.prazo)}</span>
                        <a href={`https://gestaovybes-team.monday.com/boards/8385559107/pulses/${item.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--cy-neon-cyan)', textDecoration: 'none', fontWeight: 'bold', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}><ExternalLink size={12}/> Abrir Demanda</a>
                      </div>
                    ) : item.isSetup ? (
                      <div style={{ color: 'var(--cy-neon-magenta)', fontSize: '0.8rem' }}>Ação necessária no Monday</div>
                    ) : (
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--cy-text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: item.isDelayedPrazo ? 'var(--cy-neon-yellow)' : 'inherit' }}>Prazo: {formatDate(item.prazo)}</span>
                        <span style={{ color: item.isDelayedVeiculacao ? 'var(--cy-neon-magenta)' : 'inherit' }}>Veic.: {formatDate(item.veiculacao)}</span>
                        {(item.responsavel || item.editorDesigner) && (
                           <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--cy-neon-cyan)', border: '1px solid rgba(0,243,255,0.2)' }}>
                             👤 {item.responsavel || item.editorDesigner}
                           </span>
                        )}
                        <a href={`https://gestaovybes-team.monday.com/boards/7829537690/pulses/${item.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--cy-neon-cyan)', textDecoration: 'none', fontWeight: 'bold', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}><ExternalLink size={12}/> Abrir Post</a>
                      </div>
                    )}
                  </li>
                )) : <div style={{color: 'var(--cy-text-secondary)', textAlign: 'center', padding: '2rem'}}>Nenhum item encontrado.</div>}
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Dashboard({ onSelectClient }) {
  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>VYBE <span className="glitch-text">NEXUS</span></h1>
          <p style={{fontFamily: 'var(--font-mono)', marginTop: '0.5rem', color: 'var(--cy-text-secondary)'}}>
            EVIDENCE-BASED CMO AUDIT SYSTEM
          </p>
        </div>
        <span className="header-badge">LIVE_DATA</span>
      </header>

      <div className="grid">
        {clients.map(client => {
          const auditPending = hasPendingAudit(client);
          return (
            <div
              key={client.id}
              className={`card ${client.status}`}
              role="button"
              tabIndex={0}
              aria-label={`Abrir auditoria de ${client.name}`}
              onClick={() => onSelectClient(client)}
              onKeyDown={(event) => activateOnKeyboard(event, () => onSelectClient(client))}
            >
              <div className="card-header">
                <div>
                  <h3>{client.name}</h3>
                  <span className="niche-badge">{client.niche}</span>
                </div>
                <div className="card-header-actions">
                  <span className={`audit-state ${auditPending ? 'pending' : 'ready'}`}>
                    {auditPending ? 'AUDITORIA PENDENTE' : 'AUDITORIA LEGACY · VALIDAR'}
                  </span>
                  <Terminal size={24} color={auditPending ? 'var(--cy-neon-yellow)' : 'var(--cy-neon-cyan)'} />
                </div>
              </div>
              <div style={{marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--cy-border)'}}>
                <p style={{fontSize: '0.85rem', color: 'var(--cy-text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                  <strong style={{color: 'var(--cy-text-primary)'}}>{auditPending ? 'STATUS:' : 'DIR:'}</strong>{' '}
                  {auditPending ? 'Aguardando uma auditoria baseada em dados reais e validada pela equipe.' : client.cmoDirective}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IssueAccordion({ issue }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`accordion ${isOpen ? 'open' : ''}`}>
      <div className="accordion-header" role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={(event) => activateOnKeyboard(event, () => setIsOpen(!isOpen))} onClick={() => setIsOpen(!isOpen)}>
        <div className="accordion-title">
          <ServerCrash size={16} className="text-magenta" />
          <span>{issue.title}</span>
        </div>
        {isOpen ? <ChevronUp size={18} className="text-cyan" /> : <ChevronDown size={18} className="text-secondary" />}
      </div>
      
      {isOpen && (
        <div className="accordion-body">
          <div className="info-block evidence-block">
            <h4 className="info-label text-cyan"><Search size={14} /> EVIDÊNCIA TÉCNICA (ORIGEM DO DADO)</h4>
            <p className="info-text" style={{fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#e2e8f0'}}>{issue.evidence}</p>
          </div>

          <div className="info-block" style={{marginTop: '1.5rem'}}>
            <h4 className="info-label"><Activity size={14} /> RACIONAL ESTRATÉGICO (O PORQUÊ)</h4>
            <p className="info-text">{issue.rationale}</p>
          </div>
          
          <div className="info-block" style={{marginTop: '1.5rem'}}>
            <h4 className="info-label text-green"><GitCommit size={14} /> PLAYBOOK DE EXECUÇÃO (COMO RESOLVER)</h4>
            <ul className="step-list">
              {issue.steps.map((step, idx) => (
                <li key={idx}>
                  <span className="step-num">{idx + 1}</span>
                  <span className="step-text">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="info-block" style={{marginTop: '1.5rem', background: 'rgba(234, 179, 8, 0.05)', padding: '1rem', borderLeft: '2px solid var(--cy-neon-yellow)'}}>
            <h4 className="info-label text-yellow"><Target size={14} /> IMPACTO PROJETADO</h4>
            <p className="info-text text-yellow">{issue.impact}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BusinessIntelligence({ data, clientId, auditPending }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanText, setScanText] = useState("");
  const [lastScan, setLastScan] = useState("Não sincronizado nesta sessão");

  const handleScan = async () => {
    if (isScanning || !clientId) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanText("Iniciando rotinas...");
    
    const progressInterval = setInterval(() => {
      setScanProgress(p => {
        if (p < 20) { setScanText("Conectando ao servidor backend..."); return p + 1; }
        if (p < 40) { setScanText("Raspando dados ao vivo do Instagram..."); return p + 1; }
        if (p < 70) { setScanText("Gerando análise com Gemini 3.7 Flash..."); return p + 1; }
        if (p < 95) { setScanText("Montando playbook estratégico de CMO..."); return p + 0.5; }
        return 95;
      });
    }, 150);

    try {
      const response = await fetch(`/api/audit/${clientId}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      clearInterval(progressInterval);
      
      if (response.ok && result.success) {
        setScanProgress(100);
        setScanText("Auditoria concluída! Sincronizando painel...");
        setTimeout(() => {
          setLastScan("Agora mesmo");
          setIsScanning(false);
        }, 1000);
      } else {
        setIsScanning(false);
        alert("Erro na Auditoria IA: " + (result.error || "Falha desconhecida"));
      }
    } catch (err) {
      clearInterval(progressInterval);
      setIsScanning(false);
      alert("Erro ao conectar com o Servidor IA. Ele está rodando na porta 3001?");
    }
  };
  const [showByollmModal, setShowByollmModal] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [byollmLoading, setByollmLoading] = useState(false);

  const handleByollmPrompt = async () => {
    if (byollmLoading || !clientId) return;
    setByollmLoading(true);
    try {
      const response = await fetch(`/api/prompt/${clientId}`);
      const result = await response.json();
      
      if (response.ok && result.prompt) {
        await navigator.clipboard.writeText(result.prompt);
        alert("Prompt copiado para a área de transferência! Cole no seu ChatGPT/Gemini e depois cole a resposta no campo que vai abrir.");
        setShowByollmModal(true);
      } else {
        alert("Erro ao gerar prompt: " + (result.error || "Falha desconhecida"));
      }
    } catch (err) {
      alert("Erro ao conectar com o Servidor IA.");
    } finally {
      setByollmLoading(false);
    }
  };

  const handleSaveByollm = async () => {
    if (!pastedJson.trim()) return;
    
    let parsedData = null;
    let errorMessage = "";

    try {
      // Limpa blocos de código markdown se existirem
      const cleanText = pastedJson.replace(/```json/g, '').replace(/```/g, '').trim();

      // Estratégia indestrutível: Encontra todas as chaves de abertura '{' e tenta parsear 
      // do final para o começo, pegando o último JSON válido (que geralmente é a resposta real da IA).
      let lastValidJson = null;
      for (let i = cleanText.length - 1; i >= 0; i--) {
        if (cleanText[i] === '{') {
          // Tenta parsear a substring a partir desta chave até o final, ou tenta encontrar o fechamento
          for (let j = cleanText.length; j > i; j--) {
            if (cleanText[j - 1] === '}') {
              try {
                const candidate = JSON.parse(cleanText.substring(i, j));
                if (candidate && candidate.igStats && candidate.cmoDirective && candidate.issues) {
                  lastValidJson = candidate;
                  break; // Encontrou um JSON válido e completo!
                }
              } catch (e) {
                // Ignora erros de parse e continua tentando
              }
            }
          }
        }
        if (lastValidJson) break;
      }

      if (lastValidJson) {
        parsedData = lastValidJson;
      } else {
        throw new Error("Não encontrei um formato JSON com os dados corretos (igStats, cmoDirective, issues) no texto colado.");
      }
    } catch (err) {
      alert("JSON inválido!\n\nDetalhe do erro: " + err.message + "\n\nDICA: Certifique-se de colar APENAS a resposta final do ChatGPT que começa com { e termina com }.");
      return;
    }

    try {
      const response = await fetch(`/api/save/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData)
      });
      
      if (response.ok) {
        alert("Análise salva com sucesso!");
        setShowByollmModal(false);
        setPastedJson("");
        window.location.reload(); // Recarregar para mostrar os novos dados
      } else {
        alert("Erro ao salvar no servidor.");
      }
    } catch (err) {
      alert("Erro de conexão ao salvar.");
    }
  };

  if (!data) return null;

  return (
    <section className="bi-container">
      <div className="bi-header">
        <div className="cmo-title" style={{marginBottom: 0}}>
          <Database size={20} className="text-cyan" /> COMPANY INTELLIGENCE
            <span className={`audit-confidence ${auditPending ? 'pending' : 'review'}`}>{auditPending ? 'AUDITORIA PENDENTE' : 'REVISAR EVIDÊNCIAS'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--cy-text-secondary)', fontFamily: 'var(--font-mono)' }}>
            ÚLTIMO SCAN: {lastScan}
          </span>
          <button 
            className="scan-btn"
            onClick={handleByollmPrompt}
            disabled={byollmLoading || isScanning}
            style={{ backgroundColor: 'var(--cy-neon-purple)', color: 'black' }}
          >
            {byollmLoading ? 'GERANDO PROMPT...' : 'GERAR VIA CHAT'}
          </button>
          <button 
            className={`scan-btn ${isScanning ? 'scanning' : ''}`}
            onClick={handleScan}
            disabled={isScanning || byollmLoading}
          >
            <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
            {isScanning ? 'VARRENDO WEB...' : 'ATUALIZAR API'}
          </button>
        </div>
      </div>
      
      {showByollmModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 10, 12, 0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--cy-bg-card)',
            border: '1px solid var(--cy-neon-purple)',
            padding: '2rem',
            width: '600px',
            borderRadius: '8px'
          }}>
            <h2 style={{color: 'var(--cy-neon-purple)', marginBottom: '1rem'}}>COLE O RESULTADO DA IA</h2>
            <p style={{color: 'var(--cy-text-secondary)', marginBottom: '1rem', fontSize: '0.9rem'}}>
              O prompt completo foi copiado. Cole-o no ChatGPT ou Gemini e cole o JSON de resposta abaixo:
            </p>
            <textarea 
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              style={{
                width: '100%', height: '300px',
                background: '#050505', border: '1px solid #333',
                color: '#fff', fontFamily: 'monospace',
                padding: '1rem', marginBottom: '1rem'
              }}
              placeholder="{&#10;  &quot;igStats&quot;: &quot;...&quot;,&#10;  &quot;cmoDirective&quot;: &quot;...&quot;,&#10;  &quot;issues&quot;: [...]&#10;}"
            />
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setShowByollmModal(false)}
                style={{background: 'transparent', color: '#fff', border: '1px solid #555', padding: '0.5rem 1rem', cursor: 'pointer'}}
              >
                CANCELAR
              </button>
              <button 
                onClick={handleSaveByollm}
                style={{background: 'var(--cy-neon-purple)', color: '#000', border: 'none', padding: '0.5rem 1rem', fontWeight: 'bold', cursor: 'pointer'}}
              >
                SALVAR ANÁLISE
              </button>
            </div>
          </div>
        </div>
      )}
      
      {isScanning && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 10, 12, 0.92)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cy-neon-cyan)'
        }}>
          <RefreshCw size={56} className="spin" style={{ marginBottom: '1.5rem' }} />
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', margin: '0 0 1rem 0', textShadow: '0 0 20px rgba(0, 243, 255, 0.5)' }}>
            {Math.floor(scanProgress)}%
          </h1>
          <h2 style={{ fontFamily: 'var(--font-mono)', letterSpacing: '2px', margin: 0 }}>AUDITORIA IA EM ANDAMENTO</h2>
          <p style={{ color: 'var(--cy-text-secondary)', marginTop: '0.5rem', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>{scanText}</p>
          
          <div style={{ width: '400px', height: '6px', background: 'rgba(255,255,255,0.05)', marginTop: '2rem', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${scanProgress}%`, height: '100%', background: 'var(--cy-neon-cyan)', boxShadow: '0 0 10px var(--cy-neon-cyan)', transition: 'width 0.2s ease-out' }}></div>
          </div>
        </div>
      )}

      <div className="bi-grid">
        {data.address && (
          <div className="bi-card">
            <MapPin size={16} className="text-secondary" />
            <div>
              <div className="bi-label">Endereço Registrado</div>
              <div className="bi-value">{data.address}</div>
            </div>
          </div>
        )}
        {data.officialSite && (
          <div className="bi-card">
            <Globe size={16} className="text-secondary" />
            <div>
              <div className="bi-label">Ecossistema Web</div>
              <div className="bi-value">{data.officialSite}</div>
            </div>
          </div>
        )}
        {data.googleRating && (
          <div className="bi-card">
            <Star size={16} className="text-yellow" />
            <div>
              <div className="bi-label">Google Rating (NPS)</div>
              <div className="bi-value text-yellow">{data.googleRating}</div>
            </div>
          </div>
        )}
        {data.igStats && (
          <div className="bi-card bi-card-wide">
            <Database size={16} className="text-cyan" />
            <div>
              <div className="bi-label">Base observada</div>
              <div className="bi-value">{data.igStats}</div>
            </div>
          </div>
        )}
        {data.coreAsset && (
          <div className="bi-card">
            <ShieldAlert size={16} className="text-magenta" />
            <div>
              <div className="bi-label">Vantagem Injusta (Asset)</div>
              <div className="bi-value">{data.coreAsset}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AuditGovernance({ auditPending }) {
  const status = auditPending ? 'pending_validation' : 'legacy_unvalidated';
  const statusLabel = auditPending ? 'PENDENTE DE VALIDAÇÃO' : 'LEGACY · NÃO VALIDADA';
  const statusColor = auditPending ? 'var(--cy-neon-yellow)' : 'var(--cy-text-secondary)';
  return (
    <section className="audit-governance" aria-label="Governança da Auditoria IA">
      <div className="audit-governance-heading"><ShieldAlert size={16} /> GOVERNANÇA DA AUDITORIA IA</div>
      <div className="audit-governance-grid">
        <div><span>STATUS</span><strong style={{ color: statusColor }}>{statusLabel}</strong></div>
        <div><span>CONFIANÇA</span><strong style={{ color: statusColor }}>{auditPending ? 'NÃO VERIFICADA' : 'LEGADO'}</strong></div>
        <div><span>VERSÃO</span><strong>AGUARDANDO DATASTORE</strong></div>
        <div><span>FONTE</span><strong>{status === 'pending_validation' ? 'AUDITORIA PENDENTE' : 'CLIENTS.JS · LEGADO'}</strong></div>
      </div>
      <p>O conteúdo exibido abaixo é contexto estratégico e não deve ser tratado como evidência validada até existir fonte, versão, responsável e validação humana persistidos.</p>
    </section>
  );
}

function ClientDetail({ client, onBack }) {
  const auditPending = hasPendingAudit(client);
  const validChannels = getValidAuditChannels(client);

  return (
    <div className="container">
      <div className="detail-view">
        <header className="detail-header">
          <div>
            <h1>{client.name}</h1>
            <p style={{fontFamily: 'var(--font-mono)', color: 'var(--cy-neon-cyan)', marginTop: '0.5rem'}}>ID: {client.id} // {client.niche}</p>
          </div>
          <button type="button" className="back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> SYSTEM.BACK()
          </button>
        </header>

        <BusinessIntelligence data={client.businessIntelligence} clientId={client.id} auditPending={auditPending} />
        <AuditGovernance auditPending={auditPending} />

        {auditPending ? (
          <section className="audit-pending" role="status">
            <div className="audit-pending-title"><AlertTriangle size={18} /> AUDITORIA AGUARDANDO VALIDAÇÃO</div>
            <p>Este cliente ainda não possui uma análise baseada em dados reais validada. O Nexus ocultou textos provisórios para evitar conclusões sem evidência.</p>
          </section>
        ) : (
          <section className="cmo-directive">
            <div className="cmo-title"><ShieldAlert size={20} /> CMO PRIME DIRECTIVE</div>
            <p className="cmo-text">{client.cmoDirective}</p>
          </section>
        )}

        <section className="kpi-wrapper">
          <div className="kpi-title"><Crosshair size={16} /> TARGET KPIs (MONITORAMENTO OBRIGATÓRIO)</div>
          <div className="kpi-grid">
            {client.kpis.map((kpi, idx) => (
              <div key={idx} className="kpi-card">
                <BarChart2 size={16} /> {kpi}
              </div>
            ))}
          </div>
        </section>

        {validChannels.length > 0 ? (
          <section className="channel-container">
            <h2 className="channel-header">EVIDENCE-BASED AUDIT</h2>
            <div className="channel-grid">
              {validChannels.map((channel, idx) => (
                <div key={idx} className="channel-card">
                  <div className="channel-card-head">
                    <div className="channel-name"><Layers size={18} color="var(--cy-neon-cyan)" /> {channel.name}</div>
                    <span className={`status-badge ${channel.status}`}>{channel.status}</span>
                  </div>
                  <div className="channel-body">
                    {channel.issues.map((issue, i) => (
                      <IssueAccordion key={i} issue={issue} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="audit-pending" role="status">
            <div className="audit-pending-title"><Info size={18} /> SEM EVIDÊNCIAS PUBLICADAS</div>
            <p>As análises detalhadas aparecerão aqui depois que uma auditoria válida for salva.</p>
          </section>
        )}
      </div>
    </div>
  );
}

function ClientLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [meta, setMeta] = useState(null);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortMode, setSortMode] = useState('priority');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/dashboard/clients-logs');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(`Dossiê de Clientes: ${data.error || 'não foi possível carregar o histórico de relacionamento.'}`);
      }
      setLogs(data.logs || []);
      setMeta(data.meta || null);
    } catch (err) {
      setError(err.message || 'Erro de conexão com o Dossiê de Clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredLogs = [...logs]
    .filter(client => !normalizedSearch || client.name.toLowerCase().includes(normalizedSearch))
    .filter(client => statusFilter === 'Todos' || client.relationshipStatus === statusFilter)
    .sort((a, b) => sortMode === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : (b.daysSinceLastMeeting ?? 9999) - (a.daysSinceLastMeeting ?? 9999));
  const criticalCount = logs.filter(client => client.daysSinceLastMeeting >= 30).length;
  const noHistoryCount = logs.filter(client => !client.lastMeetingDate).length;
  const scheduledCount = logs.reduce((total, client) => total + (client.futureMeetings?.length || 0), 0);

  if (loading) return <SyncOverlay text="Carregando histórico de relacionamento e próximas reuniões..." />;
  if (error) return <ErrorState message={error} onRetry={loadLogs} />;

  return (
    <div className="container client-logs-page">
      <header className="header logs-header">
        <div>
          <h1>DOSSIÊ <span className="glitch-text" style={{ color: 'var(--cy-neon-yellow)' }}>DE CLIENTES</span></h1>
          <p style={{ color: 'var(--cy-text-secondary)', fontFamily: 'var(--font-mono)' }}>Histórico de Manutenção e Relacionamento</p>
        </div>
        <div className="header-meta">
          <span className="header-badge" style={{ background: 'var(--cy-neon-yellow)', color: '#050505' }}>RELATIONSHIP DATA</span>
          <span className="sync-meta">{meta?.generatedAt ? `ATUALIZADO ${formatDateTime(meta.generatedAt)}` : 'ATUALIZAÇÃO RECENTE'}</span>
        </div>
      </header>

      <div className="logs-toolbar">
        <label className="client-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar cliente..."
            aria-label="Buscar cliente no dossiê"
          />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar clientes por status">
          <option value="Todos">Todos os status</option>
          <option value="critical">Críticos</option>
          <option value="warning">Atenção</option>
          <option value="no-history">Sem histórico</option>
          <option value="healthy">Saudáveis</option>
        </select>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Ordenar clientes">
          <option value="priority">Ordenar por prioridade</option>
          <option value="name">Ordenar por nome</option>
        </select>
        <span className="filter-count">{filteredLogs.length} de {logs.length} clientes</span>
      </div>

      <div className="logs-summary" aria-label="Resumo do dossiê">
        <div><strong>{logs.length}</strong><span>CLIENTES</span></div>
        <div className="critical"><strong>{criticalCount}</strong><span>CRÍTICOS</span></div>
        <div className="warning"><strong>{noHistoryCount}</strong><span>SEM HISTÓRICO</span></div>
        <div className="info"><strong>{scheduledCount}</strong><span>REUNIÕES AGENDADAS</span></div>
      </div>

      <div className="logs-grid">
        {filteredLogs.map((client) => {
          const isCritical = client.daysSinceLastMeeting >= 30;
          const isWarning = client.daysSinceLastMeeting >= 15 && client.daysSinceLastMeeting < 30;
          const isExpanded = expandedClient === client.name;
          let statusColor = 'var(--cy-neon-cyan)';
          let statusText = 'SAUDÁVEL';
          if (isCritical) { statusColor = 'var(--cy-neon-magenta)'; statusText = 'CRÍTICO'; }
          else if (isWarning) { statusColor = 'var(--cy-neon-yellow)'; statusText = 'ATENÇÃO'; }
          if (!client.lastMeetingDate) { statusColor = '#666'; statusText = 'SEM HISTÓRICO'; }

          return (
            <div key={client.name} className={`client-log-card ${isCritical ? 'critical' : ''}`} style={{ borderColor: statusColor }}>
              <div className="client-log-card-header">
                <h3>{client.name}</h3>
                <span className="client-log-status" style={{ color: statusColor, borderColor: statusColor }}>{statusText}</span>
              </div>

              <div className="client-log-age" style={{ color: statusColor }}>
                {client.daysSinceLastMeeting !== null ? (
                  <span>Última reunião: <strong>{client.daysSinceLastMeeting} dias atrás</strong> ({formatDate(client.lastMeetingDate)})</span>
                ) : (
                  <span>Nenhuma reunião anterior registrada.</span>
                )}
              </div>

              <HealthScoreCard healthScore={client.healthScore} />
              <div className="client-operational">
                <div><strong>{client.operational?.openPosts || 0}</strong><span>posts abertos</span></div>
                <div><strong>{client.operational?.delayedPosts || 0}</strong><span>conteúdos atrasados</span></div>
                <div><strong>{client.operational?.delayedDemands || 0}</strong><span>demandas</span></div>
              </div>
              <div className="next-action"><CheckCircle2 size={14} /> <span><b>PRÓXIMA AÇÃO:</b> {client.operational?.nextAction || 'Revisar situação do cliente'}</span></div>

              {client.futureMeetings && client.futureMeetings.length > 0 && (
                <div className="future-meetings">
                  <div className="future-meetings-title"><Clock size={14} color="var(--cy-neon-yellow)" /> PRÓXIMAS AGENDADAS</div>
                  {client.futureMeetings.map((fm, i) => (
                    <div key={i}>{formatDate(fm.date.split('T')[0])} — {fm.title}</div>
                  ))}
                </div>
              )}

              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedClient(isExpanded ? null : client.name)}
                className="history-btn"
              >
                {isExpanded ? 'OCULTAR HISTÓRICO' : 'VER HISTÓRICO COMPLETO'}
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isExpanded && (
                <div className="history-content">
                  {client.meetings.length === 0 ? (
                    <div className="empty-history">Sem histórico no Monday.</div>
                  ) : (
                    <ul>
                      {client.meetings.map((meeting, i) => (
                        <li key={i}>
                          <div className="history-row">
                            <span>{formatDate(meeting.date)}</span>
                            <span>{meeting.status || 'Sem status'}</span>
                          </div>
                          <div className="history-links">
                            {meeting.pauta ? <a href={meeting.pauta} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Pauta</a> : <span>Sem pauta</span>}
                            {meeting.ata ? <a href={meeting.ata} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Ata</a> : <span>Sem ata</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredLogs.length === 0 && <div className="empty-state">Nenhum cliente encontrado para “{searchTerm}”.</div>}
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('commandCenter'); // 'commandCenter' ou 'audit'
  const [selectedClient, setSelectedClient] = useState(null);

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--cy-bg)' }}>
      {/* SIDEBAR NAVEGAÇÃO */}
      <nav style={{
        width: '240px',
        borderRight: '1px solid var(--cy-border)',
        backgroundColor: '#050505',
        display: 'flex',
        flexDirection: 'column',
        padding: '2rem 1rem'
      }}>
        <div style={{ marginBottom: '3rem', paddingLeft: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '2px', color: '#fff' }}>VYBE<span style={{color: 'var(--cy-neon-purple)'}}>OS</span></h2>
          <div style={{ fontSize: '0.7rem', color: 'var(--cy-text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>V.2.0 LIVE</div>
        </div>

        <button
          type="button"
          aria-label="Abrir Command Center"
          aria-pressed={activeTab === 'commandCenter'}
          onClick={() => { setActiveTab('commandCenter'); setSelectedClient(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
            background: activeTab === 'commandCenter' ? 'rgba(157, 0, 255, 0.1)' : 'transparent',
            border: 'none', borderLeft: activeTab === 'commandCenter' ? '3px solid var(--cy-neon-purple)' : '3px solid transparent',
            color: activeTab === 'commandCenter' ? 'var(--cy-neon-purple)' : 'var(--cy-text-secondary)',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.9rem',
            transition: 'all 0.2s', marginBottom: '0.5rem', borderRadius: '0 8px 8px 0'
          }}
        >
          <LayoutDashboard size={18} />
          COMMAND CENTER
        </button>

        <button
          type="button"
          aria-label="Abrir Auditoria IA"
          aria-pressed={activeTab === 'audit'}
          onClick={() => { setActiveTab('audit'); setSelectedClient(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
            background: activeTab === 'audit' ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
            border: 'none', borderLeft: activeTab === 'audit' ? '3px solid var(--cy-neon-cyan)' : '3px solid transparent',
            color: activeTab === 'audit' ? 'var(--cy-neon-cyan)' : 'var(--cy-text-secondary)',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.9rem',
            transition: 'all 0.2s', borderRadius: '0 8px 8px 0'
          }}
        >
          <Target size={18} />
          AUDITORIA IA
        </button>

        <button
          type="button"
          aria-label="Abrir Dossiê de Clientes"
          aria-pressed={activeTab === 'clientLogs'}
          onClick={() => { setActiveTab('clientLogs'); setSelectedClient(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
            background: activeTab === 'clientLogs' ? 'rgba(255, 234, 0, 0.1)' : 'transparent',
            border: 'none', borderLeft: activeTab === 'clientLogs' ? '3px solid var(--cy-neon-yellow)' : '3px solid transparent',
            color: activeTab === 'clientLogs' ? 'var(--cy-neon-yellow)' : 'var(--cy-text-secondary)',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.9rem',
            transition: 'all 0.2s', borderRadius: '0 8px 8px 0', marginTop: '0.5rem'
          }}
        >
          <Layers size={18} />
          DOSSIÊ CLIENTES
        </button>
      </nav>

      {/* ÁREA PRINCIPAL */}
      <main className="app-main" style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'commandCenter' && <CommandCenter />}
        {activeTab === 'clientLogs' && <ClientLogs />}
        {activeTab === 'audit' && (
          selectedClient ? (
            <ClientDetail client={selectedClient} onBack={() => setSelectedClient(null)} />
          ) : (
            <Dashboard onSelectClient={setSelectedClient} />
          )
        )}
      </main>
    </div>
  );
}

export default App;
