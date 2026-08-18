import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { Activity } from 'lucide-react';
import { statusColorFor } from '../data/status-colors.js';
import { PeopleAvatars } from '../components/PeopleAvatars.jsx';

// Esta estação é o único consumidor do Recharts. Mantê-la em módulo separado
// permite carregá-la sob demanda e tirar o gráfico do bundle inicial.

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

export default function AnalystStation({ snapshot, onExit }) {
  const statusCounts = snapshot.quantitative?.statusCounts || {};
  const delayDetails = snapshot.delayDetails || [];
  const [panelSnapshot, setPanelSnapshot] = useState(null);
  const [panelError, setPanelError] = useState('');
  const [panelPageError, setPanelPageError] = useState('');
  const [panelLoadingMore, setPanelLoadingMore] = useState(false);
  const [filters, setFilters] = useState({ client: '', responsible: '', stage: '', status: '' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/executive/vybe-panel?limit=200')
      .then(response => response.ok ? response.json() : response.json().then(body => Promise.reject(new Error(body.message || 'Vybe Painel indisponível.'))))
      .then(payload => {
        if (!cancelled) setPanelSnapshot(payload);
      })
      .catch(error => {
        if (!cancelled) setPanelError(error.message);
      });
    return () => { cancelled = true; };
  }, []);

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
  const filterOptions = useMemo(() => {
    const values = key => [...new Set(delayDetails.map(item => String(item?.[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { clients: values('client'), responsible: values('responsavel'), stages: values('stage'), statuses: values('status') };
  }, [delayDetails]);
  const filteredDelays = useMemo(() => allDelaysSorted.filter(item => {
    const matches = (key, selected) => !selected || String(item?.[key] || '') === selected;
    return matches('client', filters.client)
      && matches('responsavel', filters.responsible)
      && matches('stage', filters.stage)
      && matches('status', filters.status);
  }), [allDelaysSorted, filters]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const updateFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));

  return (
    <div className="animate-fade" style={{ minHeight: '100vh' }}>
      <header className="app-header">
        <div className="app-header-title">
          <Activity size={28} color="var(--vybe-cyan)" /> <span style={{ color: 'var(--vybe-cyan)' }}>ANALISTA / INVESTIGAÇÃO EXECUTIVA</span> <span className="badge" style={{ background: 'var(--vybe-cyan)' }}>FOCO</span>
        </div>
        <div className="app-header-meta">
          <span>ALVO: CAUSAS, EVIDÊNCIAS E IMPACTOS</span>
          <button onClick={onExit} style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>&larr; VOLTAR AO JARVIS</button>
        </div>
      </header>

      <div className="analyst-intro"><Activity size={15} /> Este modo investiga os sinais encontrados no cockpit e cruza evidências com a organização do Vybe Painel. Ele não altera o Monday, não cria demanda e não substitui a execução operacional.</div>

      <section className="analyst-panel-sync data-panel animate-slide delay-1" style={{ borderColor: 'var(--vybe-orange, #ff9d00)' }}>
        <div className="data-panel-title" style={{ color: 'var(--vybe-orange, #ff9d00)', borderColor: 'rgba(255,157,0,0.25)' }}>PONTE VYBE PAINEL · LEITURA COMPLETA</div>
        {panelError ? (
          <div className="analyst-source-warning" role="status" aria-live="polite">A fonte do Painel não respondeu: {panelError}. As evidências do Monday continuam disponíveis.</div>
        ) : panelSnapshot ? (
          <>
            <div className="analyst-source-summary" aria-live="polite">
              <strong>{panelSnapshot.pagination?.count || 0}</strong> itens lidos em <strong>{panelSnapshot.pagination?.pages || 0}</strong> páginas · {panelSnapshot.pagination?.complete ? 'leitura completa' : 'leitura parcial'} · somente leitura
              {panelSnapshot.cache?.hit ? ' · cache executivo' : ''}
            </div>
            {panelSnapshot.warning ? <div className="analyst-source-warning" role="status" aria-live="polite">Contexto parcial: {panelSnapshot.warning} A investigação continua usando o Monday como fonte principal.</div> : null}
            {panelPageError ? <div className="analyst-source-warning" role="status" aria-live="polite">Não foi possível carregar a próxima página do Painel: {panelPageError}</div> : null}
            <div className="analyst-source-groups">
              {Object.entries((panelSnapshot.items || []).reduce((acc, item) => {
                const group = item.group?.title || 'Sem grupo';
                acc[group] = (acc[group] || 0) + 1;
                return acc;
              }, {})).slice(0, 6).map(([group, count]) => (
                <span key={group} className="analyst-source-chip">{group}: <b>{count}</b></span>
              ))}
            </div>
            {panelSnapshot.pagination?.nextCursor ? <button type="button" className="list-expand" onClick={loadMorePanel} disabled={panelLoadingMore}>{panelLoadingMore ? 'CARREGANDO…' : `CARREGAR MAIS ITENS DO PAINEL (${panelSnapshot.pagination.count || 0})`}</button> : null}
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
        <div className="data-panel-title" aria-live="polite" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>FILTRAR A INVESTIGAÇÃO · {filteredDelays.length} EVIDÊNCIAS</div>
        <div className="analyst-filter-grid">
          <label>CLIENTE<select value={filters.client} onChange={event => updateFilter('client', event.target.value)}><option value="">Todos os clientes</option>{filterOptions.clients.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>RESPONSÁVEL<select value={filters.responsible} onChange={event => updateFilter('responsible', event.target.value)}><option value="">Todos os responsáveis</option>{filterOptions.responsible.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>ETAPA<select value={filters.stage} onChange={event => updateFilter('stage', event.target.value)}><option value="">Todas as etapas</option>{filterOptions.stages.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>STATUS MONDAY<select value={filters.status} onChange={event => updateFilter('status', event.target.value)}><option value="">Todos os status</option>{filterOptions.statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        {activeFilterCount > 0 ? <button type="button" className="list-expand analyst-filter-clear" onClick={() => setFilters({ client: '', responsible: '', stage: '', status: '' })}>LIMPAR {activeFilterCount} FILTRO(S) · MOSTRAR TUDO</button> : null}
      </section>

      <div className="dashboard-grid full">

        {/* GRÁFICO DE FLUXO */}
        <div className="data-panel animate-slide delay-1" style={{ borderColor: 'var(--vybe-cyan)' }}>
          <div className="data-panel-title" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>FLUXO DA CARTEIRA · POR STATUS</div>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--vybe-text-muted)" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--vybe-text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,243,255,0.05)' }} />
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
        <div className="data-panel animate-slide delay-2" style={{ borderColor: 'var(--vybe-cyan)' }}>
          <div className="data-panel-title" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>EVIDÊNCIAS DO MONDAY · ITENS AFETADOS</div>
          <div className="vybe-table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="vybe-table">
              <thead style={{ position: 'sticky', top: 0, background: 'rgba(10,10,10,0.95)', zIndex: 1 }}>
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
                        <span className="item-meta critical">-{item.daysOverdue}D</span>
                      ) : (
                        <span className="item-meta" style={{ background: 'rgba(0,255,102,0.1)', color: '#00ff66' }}>OK</span>
                      )}
                    </td>
                    <td><a href={`https://gestaovybes-team.monday.com/boards/7829537690/pulses/${item.id}`} target="_blank" rel="noreferrer" className="analyst-evidence-link">MONDAY</a>{item.panelItem && <span className="analyst-panel-match" title="Este item também foi localizado na organização do Vybe Painel"> · PAINEL</span>}</td>
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
