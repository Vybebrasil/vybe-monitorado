import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { Activity } from 'lucide-react';
import { statusColorFor } from '../data/status-colors.js';
import { PeopleAvatars } from '../components/PeopleAvatars.jsx';
import { ExecutiveInsightHeader, ExecutiveSectionHeader } from '../components/ExecutiveInsightHeader.jsx';

// Esta estação é o único consumidor do Recharts. Mantê-la em módulo separado
// permite carregá-la sob demanda e tirar o gráfico do bundle inicial.

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p>{payload[0].payload.name || payload[0].payload.stage}</p>
        <span>{payload[0].value} itens</span>
      </div>
    );
  }
  return null;
};

export default function AnalystStation({ snapshot, history, onExit }) {
  const statusCounts = snapshot.quantitative?.statusCounts || {};
  const delayDetails = snapshot.delayDetails || [];
  const [panelSnapshot, setPanelSnapshot] = useState(null);
  const [panelError, setPanelError] = useState('');
  const [panelPageError, setPanelPageError] = useState('');
  const [panelLoadingMore, setPanelLoadingMore] = useState(false);
  const [panelRefreshing, setPanelRefreshing] = useState(false);
  const [filters, setFilters] = useState({ client: '', responsible: '', stage: '', status: '', source: '' });

  const fetchPanelSummary = async ({ wait = false, signal } = {}) => {
    const response = await fetch(`/api/executive/vybe-panel?limit=200${wait ? '&wait=1' : ''}`, { cache: 'no-store', signal });
    const raw = await response.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    if (!response.ok) throw new Error(body?.message || 'Vybe Painel indisponível nesta leitura.');
    if (!body || typeof body !== 'object') throw new Error('Vybe Painel retornou uma resposta inválida nesta leitura.');
    return body;
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadPanel = async () => {
      try {
        const payload = await fetchPanelSummary({ signal: controller.signal });
        if (cancelled) return;
        setPanelSnapshot(payload);
        if (payload.cache?.pending) {
          window.setTimeout(async () => {
            try {
              const freshPayload = await fetchPanelSummary({ wait: true, signal: controller.signal });
              if (!cancelled) setPanelSnapshot(freshPayload);
            } catch (error) {
              if (!cancelled && error.name !== 'AbortError') setPanelError(error.message);
            }
          }, 1200);
        }
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') setPanelError(error.message);
      }
    };
    loadPanel();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const refreshPanel = async () => {
    if (panelRefreshing) return;
    setPanelRefreshing(true);
    setPanelError('');
    try {
      const payload = await fetchPanelSummary({ wait: true });
      setPanelSnapshot(payload);
    } catch (error) {
      setPanelError(error.message);
    } finally {
      setPanelRefreshing(false);
    }
  };

  const loadMorePanel = async () => {
    const cursor = panelSnapshot?.pagination?.nextCursor;
    if (!cursor || panelLoadingMore) return;
    setPanelLoadingMore(true);
    setPanelPageError('');
    try {
      const response = await fetch(`/api/executive/vybe-panel/page?cursor=${encodeURIComponent(cursor)}&limit=100`);
      const payload = response.ok ? await response.json() : await response.json().then(body => Promise.reject(new Error(body.message || 'Página do Vybe Painel indisponível.')));
      setPanelSnapshot(previous => {
        if (!previous) return payload;
        const items = [...(previous.items || []), ...(payload.items || [])];
        return {
          ...previous,
          items,
          pagination: {
            ...previous.pagination,
            pages: (previous.pagination?.pages || 0) + 1,
            count: items.length,
            complete: payload.pagination?.complete === true,
            truncated: payload.pagination?.complete !== true,
            nextCursor: payload.pagination?.nextCursor || null
          },
          warning: payload.pagination?.complete ? null : previous.warning
        };
      });
    } catch (error) {
      setPanelPageError(error.message);
    } finally {
      setPanelLoadingMore(false);
    }
  };

  // Transform statusCounts object to array for Recharts pipeline
  const pipelineData = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Evidências de atraso ordenadas para investigação executiva
  const allDelaysSorted = useMemo(() => [...delayDetails].sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0)), [delayDetails]);
  const panelItemsById = useMemo(() => new Map((panelSnapshot?.items || []).map(item => [String(item.id), item])), [panelSnapshot?.items]);
  const panelAffectedItems = useMemo(() => allDelaysSorted
    .map(item => ({ ...item, panelItem: panelItemsById.get(String(item.id)) }))
    .filter(item => item.panelItem), [allDelaysSorted, panelItemsById]);
  const panelGroups = useMemo(() => Object.entries((panelSnapshot?.items || []).reduce((acc, item) => {
    const group = item.group?.title || 'Sem grupo';
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {})).slice(0, 6), [panelSnapshot?.items]);
  const filterOptions = useMemo(() => {
    const values = key => [...new Set(delayDetails.map(item => String(item?.[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { clients: values('client'), responsible: values('responsavel'), stages: values('stage'), statuses: values('status') };
  }, [delayDetails]);
  const filteredDelays = useMemo(() => allDelaysSorted.filter(item => {
    const matches = (key, selected) => !selected || String(item?.[key] || '') === selected;
    const sourceMatches = !filters.source
      || (filters.source === 'panel' && panelItemsById.has(String(item.id)))
      || (filters.source === 'monday' && !panelItemsById.has(String(item.id)));
    return matches('client', filters.client)
      && matches('responsavel', filters.responsible)
      && matches('stage', filters.stage)
      && matches('status', filters.status)
      && sourceMatches;
  }), [allDelaysSorted, filters, panelItemsById]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const updateFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
  const currentScore = Number(snapshot?.portfolioStability?.rawScore ?? snapshot?.portfolioStability?.score);
  const previousScore = Number(history?.score?.previous);
  const scoreDelta = Number.isFinite(currentScore) && Number.isFinite(previousScore) ? currentScore - previousScore : null;
  const sourceQuality = snapshot?.sourceQuality || {};
  const sourceVersion = sourceQuality.mirrorVersion ?? sourceQuality.sync?.version ?? null;
  const historicalChanges = history?.changes || [];
  const primaryDelay = filteredDelays[0];
  const primaryDelayText = primaryDelay
    ? `${primaryDelay.name || 'Item sem nome'} · ${primaryDelay.daysOverdue || 0} dias de atraso · ${primaryDelay.client || 'cliente não informado'}.`
    : 'Nenhuma evidência de atraso combina com o recorte atual.';
  const scrollToEvidence = () => document.querySelector('.analyst-evidence-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="animate-fade analyst-station" style={{ minHeight: '100vh' }}>
      <header className="analyst-station-header">
        <div className="analyst-station-brand"><Activity size={20} aria-hidden="true" /><span>Analista · investigação executiva</span><span className="badge">Foco</span></div>
        <div className="analyst-station-header-actions"><span>causa · impacto · evidência</span><button type="button" onClick={onExit}>&larr; Voltar ao JARVIS</button></div>
      </header>

      <ExecutiveInsightHeader
        className="analyst-insight"
        eyebrow={<><Activity size={14} aria-hidden="true" /> Investigação guiada</>}
        title={filteredDelays.length ? 'Qual é a causa deste sinal?' : 'O que merece ser investigado?'}
        description="O Analista parte do sinal escolhido no cockpit e organiza a evidência sem substituir a execução no Monday."
        recommendation={primaryDelayText}
        impactLabel="Evidências no recorte"
        impactValue={filteredDelays.length}
        impactNote={`${activeFilterCount ? `${activeFilterCount} filtros ativos` : 'todos os atrasos observáveis'} · origem Monday`}
        tone={primaryDelay?.daysOverdue >= 15 ? 'critical' : filteredDelays.length ? 'warning' : 'stable'}
        primaryAction="Ir para evidências"
        onPrimary={scrollToEvidence}
        context="Contexto do Vybe Painel e filtros avançados ficam abaixo como suporte à investigação."
      />

      <div className="analyst-intro"><Activity size={15} /> Este modo cruza evidências do Monday com a organização do Vybe Painel. Ele não altera o Monday, não cria demanda e não substitui a execução operacional.</div>

      <section className="analyst-investigation-context data-panel animate-slide delay-1" aria-label="Contexto temporal da investigação">
        <ExecutiveSectionHeader eyebrow="Contexto" title="Versão e mudanças observadas" note="memória comparável" />
        <div className="analyst-context-metrics">
          <span><b>{sourceVersion ?? 'N/D'}</b> versão do espelho</span>
          <span><b>{Number.isFinite(currentScore) ? currentScore : 'N/D'}</b> placar atual</span>
          <span><b>{scoreDelta === null ? 'N/D' : `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`}</b> desde o snapshot anterior</span>
          <span><b>{historicalChanges.length}</b> sinais comparados</span>
        </div>
        {historicalChanges.length > 0 ? <div className="analyst-change-chips">{historicalChanges.slice(0, 6).map(change => <span key={change.key} className={change.direction}>{change.label}: {change.previous} → {change.current}</span>)}</div> : <small className="analyst-source-hint">Histórico comparável indisponível ou sem datastore persistente nesta implantação.</small>}
        {sourceQuality.consistency?.mode === 'mixed' ? <div className="analyst-source-warning" role="status">Coorte mista: Produção usa a versão do espelho; demais fontes seguem leitura direta.</div> : null}
      </section>

      <section className="analyst-panel-sync data-panel animate-slide delay-1">
        <ExecutiveSectionHeader eyebrow="Fonte complementar" title="Ponte Vybe Painel" note="somente leitura" />
        {panelError ? (
          <div className="analyst-source-warning" role="status" aria-live="polite">A fonte do Painel não respondeu: {panelError}. As evidências do Monday continuam disponíveis.</div>
        ) : panelSnapshot ? (
          <>
            <div className="analyst-source-summary" aria-live="polite">
              <strong>{panelSnapshot.pagination?.count || 0}</strong> itens lidos em <strong>{panelSnapshot.pagination?.pages || 0}</strong> páginas · {panelSnapshot.pagination?.complete ? 'leitura completa' : 'leitura parcial'} · somente leitura
               {panelSnapshot.cache?.pending ? ' · atualização em segundo plano' : panelSnapshot.cache?.stale ? ' · usando cache anterior' : panelSnapshot.cache?.hit ? ' · cache executivo' : ''}
               <button type="button" className="list-expand analyst-panel-refresh" onClick={refreshPanel} disabled={panelRefreshing}>{panelRefreshing ? 'Atualizando painel…' : 'Atualizar contexto do painel'}</button>
             </div>
            {panelSnapshot.warning ? <div className="analyst-source-warning" role="status" aria-live="polite">Contexto parcial: {panelSnapshot.warning} A investigação continua usando o Monday como fonte principal.</div> : null}
            {panelPageError ? <div className="analyst-source-warning" role="status" aria-live="polite">Não foi possível carregar a próxima página do Painel: {panelPageError}</div> : null}
            <div className="analyst-source-groups">
              {panelGroups.map(([group, count]) => (
                <span key={group} className="analyst-source-chip">{group}: <b>{count}</b></span>
              ))}
            </div>
            {panelSnapshot.pagination?.nextCursor ? <button type="button" className="list-expand" onClick={loadMorePanel} disabled={panelLoadingMore}>{panelLoadingMore ? 'Carregando…' : `Carregar mais itens do painel (${panelSnapshot.pagination.count || 0})`}</button> : null}
            {panelAffectedItems.length > 0 && (
              <div className="analyst-panel-affected">
                <span>Itens afetados encontrados também no Painel: <b>{panelAffectedItems.length}</b></span>
                <span className="analyst-source-hint">A investigação usa o Monday como origem e o Painel como contexto de organização.</span>
              </div>
            )}
          </>
        ) : (
          <div className="analyst-source-loading">Consultando a organização do Vybe Painel…</div>
        )}
      </section>

      <section className="analyst-filters data-panel animate-slide delay-1" aria-label="Filtros cruzados da investigação">
        <ExecutiveSectionHeader eyebrow="Refinamento" title={`Filtrar evidências · ${filteredDelays.length}`} note={activeFilterCount ? `${activeFilterCount} filtros ativos` : 'todos os sinais'} />
        <div className="analyst-filter-grid">
          <label>Cliente<select value={filters.client} onChange={event => updateFilter('client', event.target.value)}><option value="">Todos os clientes</option>{filterOptions.clients.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Responsável<select value={filters.responsible} onChange={event => updateFilter('responsible', event.target.value)}><option value="">Todos os responsáveis</option>{filterOptions.responsible.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Etapa<select value={filters.stage} onChange={event => updateFilter('stage', event.target.value)}><option value="">Todas as etapas</option>{filterOptions.stages.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Status Monday<select value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="">Todos os status</option>{filterOptions.statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Fonte de evidência<select value={filters.source} onChange={event => updateFilter('source', event.target.value)}><option value="">Monday + Painel</option><option value="panel">Com contexto do Painel</option><option value="monday">Somente Monday</option></select></label>
        </div>
        {activeFilterCount > 0 ? <button type="button" className="list-expand analyst-filter-clear" onClick={() => setFilters({ client: '', responsible: '', stage: '', status: '', source: '' })}>Limpar {activeFilterCount} filtro(s) · mostrar tudo</button> : null}
      </section>

      <div className="dashboard-grid full">

        {/* GRÁFICO DE FLUXO */}
        <div className="data-panel analyst-flow-panel animate-slide delay-1">
          <div className="data-panel-title">Fluxo da carteira · por status</div>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--vybe-text-muted)" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--vybe-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100,210,255,0.05)' }} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={statusColorFor(entry.name, snapshot.quantitative?.statusColors)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* EVIDÊNCIAS DOS ATRASOS */}
        <div className="data-panel analyst-evidence-panel animate-slide delay-2">
          <div className="data-panel-title">Evidências do Monday · itens afetados</div>
          <div className="vybe-table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="vybe-table">
              <thead>
                <tr>
                  <th>ID Monday</th>
                  <th>Tarefa</th>
                  <th>Cliente</th>
                  <th>Status (Etapa)</th>
                  <th>Responsável</th>
                  <th>Atraso</th>
                  <th>Evidência</th>
                </tr>
              </thead>
              <tbody>
                {filteredDelays.map(item => (
                  <tr key={item.id}>
                    <td><span className="badge">{item.id || 'N/A'}</span></td>
                    <td className="item-primary">{item.name}</td>
                    <td style={{ color: 'var(--vybe-cyan)' }}>{item.client}</td>
                    <td><span className="monday-status-badge" style={{ color: statusColorFor(item.status, snapshot.quantitative?.statusColors), borderColor: statusColorFor(item.status, snapshot.quantitative?.statusColors) }}>{item.status || item.stage}</span></td>
                    <td><PeopleAvatars people={item.responsavelPeople} names={item.responsavel} label="Responsável" /></td>
                    <td>
                      {item.daysOverdue > 0 ? (
                        <span className="item-meta critical">-{item.daysOverdue}D em atraso</span>
                      ) : (
                        <span className="item-meta" style={{ background: 'rgba(48,209,88,.12)', color: 'var(--vybe-green)' }}>No prazo</span>
                      )}
                    </td>
                    <td><a href={`https://gestaovybes-team.monday.com/boards/7829537690/pulses/${item.id}`} target="_blank" rel="noreferrer" className="analyst-evidence-link">Abrir no Monday</a>{item.panelItem && <span className="analyst-panel-match" title="Este item também foi localizado na organização do Vybe Painel"> · PAINEL</span>}</td>
                  </tr>
                ))}
                {filteredDelays.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--vybe-text-muted)' }}>{activeFilterCount ? 'Nenhuma evidência combina com os filtros selecionados.' : 'Nenhum atraso encontrado nesta leitura do Monday.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
