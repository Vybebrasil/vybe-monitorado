import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { Activity } from 'lucide-react';

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

  // Transform statusCounts object to array for Recharts pipeline
  const pipelineData = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Evidências de atraso ordenadas para investigação executiva
  const allDelaysSorted = [...delayDetails].sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  const panelItemsById = useMemo(() => new Map((panelSnapshot?.items || []).map(item => [String(item.id), item])), [panelSnapshot]);
  const panelAffectedItems = allDelaysSorted
    .map(item => ({ ...item, panelItem: panelItemsById.get(String(item.id)) }))
    .filter(item => item.panelItem);

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
          <div className="analyst-source-warning">A fonte do Painel não respondeu: {panelError}. As evidências do Monday continuam disponíveis.</div>
        ) : panelSnapshot ? (
          <>
            <div className="analyst-source-summary">
              <strong>{panelSnapshot.pagination?.count || 0}</strong> itens lidos em <strong>{panelSnapshot.pagination?.pages || 0}</strong> páginas · {panelSnapshot.pagination?.complete ? 'leitura completa' : 'leitura parcial'} · somente leitura
            </div>
            <div className="analyst-source-groups">
              {Object.entries((panelSnapshot.items || []).reduce((acc, item) => {
                const group = item.group?.title || 'Sem grupo';
                acc[group] = (acc[group] || 0) + 1;
                return acc;
              }, {})).slice(0, 6).map(([group, count]) => (
                <span key={group} className="analyst-source-chip">{group}: <b>{count}</b></span>
              ))}
            </div>
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
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--vybe-cyan)' : 'rgba(0,243,255,0.4)'} />
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
                {allDelaysSorted.map(item => (
                  <tr key={item.id}>
                    <td><span className="badge">{item.id || 'N/A'}</span></td>
                    <td className="item-primary">{item.name}</td>
                    <td style={{ color: 'var(--vybe-cyan)' }}>{item.client}</td>
                    <td>{item.status || item.stage}</td>
                    <td>{item.responsavel || 'Não Atribuído'}</td>
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
                {allDelaysSorted.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--vybe-text-muted)' }}>Nenhum atraso encontrado nesta leitura do Monday.</td>
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
