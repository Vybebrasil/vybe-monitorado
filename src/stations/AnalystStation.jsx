import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { Activity, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { statusColorFor } from '../data/status-colors.js';
import { PeopleAvatars } from '../components/PeopleAvatars.jsx';
import { formatDate, mondayItemUrl, delayUrgency } from '../components/executive-helpers.js';

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

// Lê o ?vybe_member=ID da URL e devolve o ID ou null
function getMemberIdFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('vybe_member') || null;
  } catch {
    return null;
  }
}

// Verifica se um item tem prazo hoje ou amanhã (usa campo prazo ou veiculacao)
function isPriorityToday(item) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const checkDate = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return false;
    // Compara sem fuso — apenas a data
    const dLocal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return dLocal >= today && dLocal <= tomorrow;
  };

  return checkDate(item.prazo) || checkDate(item.veiculacao);
}

function isPriorityThisWeek(item) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const checkDate = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return false;
    const dLocal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return dLocal >= today && dLocal <= weekEnd;
  };

  return checkDate(item.prazo) || checkDate(item.veiculacao);
}

// Painel "Meu Dia" — fila pessoal do membro logado
function MyDayPanel({ myItems, memberId }) {
  const overdue = myItems.filter(item => (item.daysOverdue || 0) > 0);
  const dueToday = myItems.filter(item => !item.daysOverdue && isPriorityToday(item));
  const dueWeek = myItems.filter(item => !item.daysOverdue && !isPriorityToday(item) && isPriorityThisWeek(item));

  const renderRow = (item) => {
    const urgency = delayUrgency(item.daysOverdue);
    const link = mondayItemUrl(item.id);
    return (
      <div key={item.id} className={`my-day-row urgency-${urgency.tone}`}>
        <div className="my-day-row-left">
          <div className="my-day-item-name">{item.name}</div>
          <div className="my-day-item-meta">
            <span style={{ color: 'var(--vybe-cyan)' }}>{item.client}</span>
            <span>{item.stage || item.status}</span>
            {item.prazo && <span>Prazo: {formatDate(item.prazo)}</span>}
            {item.veiculacao && <span>Veiculação: {formatDate(item.veiculacao)}</span>}
          </div>
        </div>
        <div className="my-day-row-right">
          {item.daysOverdue > 0
            ? <span className="item-meta critical">-{item.daysOverdue}D</span>
            : <span className="item-meta" style={{ color: '#ffaa00', background: 'rgba(255,170,0,0.1)' }}>HOJE/AMANHÃ</span>
          }
          {link && <a href={link} target="_blank" rel="noreferrer" className="analyst-evidence-link">ABRIR ↗</a>}
        </div>
      </div>
    );
  };

  if (myItems.length === 0) {
    return (
      <section className="data-panel animate-slide delay-1 my-day-panel" style={{ borderColor: 'var(--vybe-cyan)' }}>
        <div className="data-panel-title" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>
          <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />MEU DIA · FILA PESSOAL</span>
          <span style={{ color: 'var(--vybe-text-muted)', fontSize: '0.7rem' }}>ID {memberId}</span>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#00ff66', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
          ✓ Nenhum item atrasado ou com prazo iminente associado a este membro.
        </div>
      </section>
    );
  }

  return (
    <section className="data-panel animate-slide delay-1 my-day-panel" style={{ borderColor: 'var(--vybe-cyan)' }}>
      <div className="data-panel-title" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>
        <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />MEU DIA · FILA PESSOAL</span>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {overdue.length > 0 && <span style={{ color: 'var(--vybe-red)', fontSize: '0.7rem' }}>{overdue.length} ATRASADO(S)</span>}
          {dueToday.length > 0 && <span style={{ color: 'var(--vybe-gold)', fontSize: '0.7rem' }}>{dueToday.length} HOJE/AMANHÃ</span>}
          {dueWeek.length > 0 && <span style={{ color: 'var(--vybe-text-muted)', fontSize: '0.7rem' }}>{dueWeek.length} NA SEMANA</span>}
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="my-day-section">
          <div className="my-day-section-title" style={{ color: 'var(--vybe-red)' }}>
            <AlertTriangle size={12} /> ATRASADOS ({overdue.length})
          </div>
          {overdue.map(renderRow)}
        </div>
      )}

      {dueToday.length > 0 && (
        <div className="my-day-section">
          <div className="my-day-section-title" style={{ color: 'var(--vybe-gold)' }}>
            <Clock size={12} /> PRAZO HOJE / AMANHÃ ({dueToday.length})
          </div>
          {dueToday.map(renderRow)}
        </div>
      )}

      {dueWeek.length > 0 && (
        <div className="my-day-section">
          <div className="my-day-section-title" style={{ color: 'var(--vybe-text-muted)' }}>
            <Calendar size={12} /> ESTA SEMANA ({dueWeek.length})
          </div>
          {dueWeek.map(renderRow)}
        </div>
      )}
    </section>
  );
}

export default function AnalystStation({ snapshot, onExit }) {
  const statusCounts = snapshot.quantitative?.statusCounts || {};
  const delayDetails = snapshot.delayDetails || [];
  const [panelSnapshot, setPanelSnapshot] = useState(null);
  const [panelError, setPanelError] = useState('');
  const [panelPageError, setPanelPageError] = useState('');
  const [panelLoadingMore, setPanelLoadingMore] = useState(false);
  const [filters, setFilters] = useState({ client: '', responsible: '', stage: '', status: '' });

  // Detecta o membro logado via ?vybe_member na URL
  const memberId = useMemo(() => getMemberIdFromUrl(), []);

  // Nome do membro a partir dos delayDetails (responsavel que contenha o ID)
  // O Monday retorna o nome — o ID numérico é o que vem na URL.
  // Como o delayDetails traz 'responsavel' (nome) e não o ID do Monday,
  // vamos identificar o membro pelo responsável mais frequente nos itens
  // que têm o ID do Monday matching — ou deixar o filtro de nome ser manual.
  // Para o "Meu Dia": filtramos todos os itens onde responsavel_id === memberId
  // (campo responsavelId que pode existir) ou deixamos o filtro por nome.
  const memberItems = useMemo(() => {
    if (!memberId) return [];
    // Tenta filtrar por responsavelId (campo numérico, se disponível)
    const byId = delayDetails.filter(item =>
      String(item.responsavelId || '') === memberId ||
      (Array.isArray(item.responsavelIds) && item.responsavelIds.map(String).includes(memberId))
    );
    if (byId.length > 0) return byId;
    // Se não tiver ID numérico, retorna array vazio — não força um match errado
    return [];
  }, [memberId, delayDetails]);

  // Auto-aplica filtro de responsável se veio via URL (pelo nome se tivermos match)
  const memberName = useMemo(() => {
    if (memberItems.length === 0) return null;
    return memberItems[0]?.responsavel || null;
  }, [memberItems]);

  // Busca só o contexto dos itens que a investigação realmente mostra.
  const evidenceIds = useMemo(
    () => [...new Set((delayDetails || []).map(item => String(item?.id || '').trim()).filter(Boolean))],
    [delayDetails]
  );

  useEffect(() => {
    let cancelled = false;
    if (evidenceIds.length === 0) { setPanelSnapshot({ items: [], pagination: { count: 0, pages: 1, complete: true } }); return undefined; }
    fetch(`/api/executive/vybe-panel/items?ids=${encodeURIComponent(evidenceIds.join(','))}`)
      .then(response => response.ok ? response.json() : response.json().then(body => Promise.reject(new Error(body.message || 'Vybe Painel indisponível.'))))
      .then(payload => { if (!cancelled) setPanelSnapshot(payload); })
      .catch(error => { if (!cancelled) setPanelError(error.message); });
    return () => { cancelled = true; };
  }, [evidenceIds]);

  // Auto-preenche o filtro de responsável se temos nome do membro
  useEffect(() => {
    if (memberName) {
      setFilters(previous => ({ ...previous, responsible: memberName }));
    }
  }, [memberName]);

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

  const pipelineData = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

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
          <Activity size={28} color="var(--vybe-cyan)" /> <span style={{ color: 'var(--vybe-cyan)' }}>ANALISTA / INVESTIGAÇÃO EXECUTIVA</span>
          {memberId && <span className="badge" style={{ background: 'rgba(0,243,255,0.15)', color: 'var(--vybe-cyan)', border: '1px solid rgba(0,243,255,0.3)' }}>
            {memberName || `MEMBRO #${memberId}`}
          </span>}
        </div>
        <div className="app-header-meta">
          <span>ALVO: CAUSAS, EVIDÊNCIAS E IMPACTOS</span>
          <button onClick={onExit} style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>&larr; VOLTAR AO JARVIS</button>
        </div>
      </header>

      <div className="analyst-intro"><Activity size={15} /> Este modo investiga os sinais encontrados no cockpit e cruza evidências com a organização do Vybe Painel. Ele não altera o Monday, não cria demanda e não substitui a execução operacional.</div>

      {/* MEU DIA — só aparece se veio ?vybe_member na URL */}
      {memberId && (
        <div style={{ padding: '0 3rem' }}>
          <MyDayPanel myItems={memberItems} memberId={memberId} />
        </div>
      )}

      <section className="analyst-panel-sync data-panel animate-slide delay-1" style={{ borderColor: 'var(--vybe-orange, #ff9d00)' }}>
        <div className="data-panel-title" style={{ color: 'var(--vybe-orange, #ff9d00)', borderColor: 'rgba(255,157,0,0.25)' }}>PONTE VYBE PAINEL · CONTEXTO DAS EVIDÊNCIAS</div>
        {panelError ? (
          <div className="analyst-source-warning" role="status" aria-live="polite">A fonte do Painel não respondeu: {panelError}. As evidências do Monday continuam disponíveis.</div>
        ) : panelSnapshot ? (
          <>
            <div className="analyst-source-summary" aria-live="polite">
              <strong>{(panelSnapshot.items || []).length}</strong> de <strong>{evidenceIds.length}</strong> evidências com contexto no Painel · somente leitura
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
        <div className="data-panel-title" aria-live="polite" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>
          FILTRAR A INVESTIGAÇÃO · {filteredDelays.length} EVIDÊNCIAS
          {memberId && memberName && filters.responsible === memberName && (
            <span style={{ color: 'var(--vybe-cyan)', fontSize: '0.65rem', opacity: 0.7 }}>· FILTRO PESSOAL ATIVO</span>
          )}
        </div>
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
                  <th>Tempo Parado</th>
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
                    <td>
                      {item.daysInStatus !== null && item.daysInStatus !== undefined ? (
                        <span className={`item-meta ${item.daysInStatus >= 10 ? 'critical' : item.daysInStatus >= 5 ? 'warning' : ''}`} title={`Mudou em ${item.statusChangedAt}`}>
                          {item.daysInStatus}D
                        </span>
                      ) : <span className="item-meta">N/A</span>}
                    </td>
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
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--vybe-text-muted)' }}>{activeFilterCount ? 'Nenhuma evidência combina com os filtros selecionados.' : 'Nenhum atraso encontrado nesta leitura do Monday.'}</td>
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
