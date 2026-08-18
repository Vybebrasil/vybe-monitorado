import React from 'react';
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

  // Transform statusCounts object to array for Recharts pipeline
  const pipelineData = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Tabela completa de auditoria visível e ordenada
  const allDelaysSorted = [...delayDetails].sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));

  return (
    <div className="animate-fade" style={{ minHeight: '100vh' }}>
      <header className="app-header">
        <div className="app-header-title">
          <Activity size={28} color="var(--vybe-cyan)" /> <span style={{ color: 'var(--vybe-cyan)' }}>CONSOLE PESSOAL</span> <span className="badge" style={{ background: 'var(--vybe-cyan)' }}>FOCO</span>
        </div>
        <div className="app-header-meta">
          <span>ALVO: FILA DE EXECUÇÃO E GARGALOS</span>
          <button onClick={onExit} style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>&times; ENCERRAR SESSÃO</button>
        </div>
      </header>

      <div className="dashboard-grid full">

        {/* GRÁFICO DE PIPELINE */}
        <div className="data-panel animate-slide delay-1" style={{ borderColor: 'var(--vybe-cyan)' }}>
          <div className="data-panel-title" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>ESTEIRA DE PRODUÇÃO (PIPELINE GLOBAL)</div>
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

        {/* TABELA DE AUDITORIA ABERTA */}
        <div className="data-panel animate-slide delay-2" style={{ borderColor: 'var(--vybe-cyan)' }}>
          <div className="data-panel-title" style={{ color: 'var(--vybe-cyan)', borderColor: 'rgba(0,243,255,0.2)' }}>REGISTRO DE AUDITORIA (RAW DATA)</div>
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
                  </tr>
                ))}
                {allDelaysSorted.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--vybe-text-muted)' }}>Nenhuma pendência na auditoria.</td>
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
