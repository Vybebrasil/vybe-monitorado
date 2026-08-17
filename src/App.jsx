import React, { useState, useEffect } from 'react';
import { Activity, ServerCrash, Target, RefreshCw, AlertTriangle, Clock, ExternalLink, Info, ListChecks, CheckCircle2, History, GitBranch } from 'lucide-react';

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
  const [form, setForm] = useState({ title: '', context: '', ownerRole: 'Liderança executiva', priority: 'medium', clientId: '', directive: '', checkpointAt: '' });

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
      setForm({ title: '', context: '', ownerRole: 'Liderança executiva', priority: 'medium', clientId: '', directive: '', checkpointAt: '' });
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
  return <section className="scenario-planner card" aria-labelledby="scenario-planner-title"><div className="executive-section-header"><div><div className="executive-kicker"><GitBranch size={15} /> EXECUTIVE PLANNING · SPRINT 10</div><h2 id="scenario-planner-title">CENÁRIOS DE PLANEJAMENTO</h2><p>Simulações executivas para orientar a liderança. Não são previsões nem alteram o Monday.</p></div><span className="scenario-badge">SIMULAÇÃO</span></div>{error ? <div className="executive-history-notice"><Info size={14} /> {error}</div> : <div className="scenario-grid">{scenarios.map(scenario => <article className="scenario-card" key={scenario.id}><div className="scenario-card-top"><span>{scenario.audience}</span><small>CONFIANÇA {scenario.confidence}</small></div><h3>{scenario.title}</h3><p className="scenario-question">{scenario.question}</p><div className="scenario-signals"><b>SINAIS</b>{scenario.signals.map(signal => <span key={signal}>{signal}</span>)}</div><p className="scenario-recommendation"><b>HIPÓTESE:</b> {scenario.recommendation}</p>{scenario.comparison && <div className="scenario-comparison"><b>COMPARAR</b>{scenario.comparison.map(option => <span key={option.label}><strong>{option.label}</strong> — {option.implication}</span>)}</div>}<small className="scenario-limit">As premissas devem ser revisadas antes de uma diretriz.</small></article>)}</div>}</section>;
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
      <DecisionRegistry />
      <ExecutiveHistory />
      <ImpactRegistry />
      <ExecutiveAnalytics />
            <DecisionMemory />
      <ScenarioPlanner />
      <OutcomeLearning />
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
