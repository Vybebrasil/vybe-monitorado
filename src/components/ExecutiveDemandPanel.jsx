import React from 'react';
import { statusColorFor } from '../data/status-colors.js';
import { formatDate, formatNumber, formatPct } from './executive-helpers.js';

const demandItemUrl = id => id ? `https://gestaovybes-team.monday.com/boards/8385559107/pulses/${id}` : '#';

export function ExecutiveDemandPanel({ snapshot, onSelectClient }) {
  const items = Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : [];
  const delayed = items.filter(item => item.isDelayed);
  const onTime = Math.max(0, items.length - delayed.length);
  const clients = new Set(items.map(item => item.cliente).filter(Boolean));
  const statusCounts = items.reduce((acc, item) => {
    const status = item.status || 'Sem status';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const visible = [...items]
    .sort((a, b) => Number(b.isDelayed) - Number(a.isDelayed) || new Date(a.prazo || '2999-12-31') - new Date(b.prazo || '2999-12-31'))
    .slice(0, 5);
  const source = snapshot?.sourceQuality?.consistency?.boards?.demands || {};
  const statusColors = snapshot?.quantitative?.statusColors || {};

  return (
    <section className="executive-module demand-module" aria-label="Visão executiva de Solicitações de Demandas">
      <header className="executive-module-header">
        <div><span className="executive-section-kicker">OPERAÇÃO · SOLICITAÇÕES</span><h2>O que está sendo solicitado à agência?</h2><p>Esta visão trata somente o board de Solicitações de Demandas. Não mistura atrasos de Produção de Conteúdo.</p></div>
        <span className="executive-module-source">{source.source || 'Monday.com · Solicitações de Demandas · direto'}</span>
      </header>
      <div className="executive-module-kpi-grid">
        <div className="executive-module-kpi"><span>DEMANDAS ABERTAS</span><strong>{formatNumber(items.length)}</strong><small>itens ativos no board</small></div>
        <div className="executive-module-kpi critical"><span>DEMANDAS VENCIDAS</span><strong>{formatNumber(delayed.length)}</strong><small>{formatPct(items.length ? delayed.length / items.length * 100 : null)} do board</small></div>
        <div className="executive-module-kpi stable"><span>NO PRAZO</span><strong>{formatNumber(onTime)}</strong><small>{formatPct(items.length ? onTime / items.length * 100 : null)} do board</small></div>
        <div className="executive-module-kpi cyan"><span>CLIENTES COM DEMANDA</span><strong>{formatNumber(clients.size)}</strong><small>clientes atendidos pelo fluxo</small></div>
      </div>
      <div className="executive-module-body-grid">
        <div className="executive-module-list">
          <div className="executive-module-section-title"><span>PRÓXIMAS DEMANDAS PRIORITÁRIAS</span><b>{formatNumber(items.length)} no total</b></div>
          {visible.length === 0 ? <div className="executive-empty-state"><strong>Nenhuma Solicitação de Demanda aberta nesta leitura.</strong><span>Isso não significa ausência de trabalho em Produção de Conteúdo.</span></div> : visible.map(item => {
            const color = statusColorFor(item.status, statusColors);
            return <article className={`executive-demand-row ${item.isDelayed ? 'is-delayed' : ''}`} key={item.id || item.name}>
              <div className="executive-demand-main"><strong>{item.name}</strong><span>{item.cliente || 'Cliente não informado'} · {item.quadro || 'Grupo não informado'}</span></div>
              <span className="monday-status-badge" style={{ color, borderColor: color }}>{item.status || 'Sem status'}</span>
              <div className="executive-demand-date"><b>{item.isDelayed ? 'VENCIDA' : 'PRAZO'}</b><span>{formatDate(item.prazo)}</span></div>
              {item.cliente && onSelectClient ? <button type="button" className="executive-inline-link" onClick={() => onSelectClient(item.cliente)}>ABRIR CLIENTE ↗</button> : null}
              {item.id ? <a className="executive-inline-link" href={demandItemUrl(item.id)} target="_blank" rel="noreferrer">ABRIR NO MONDAY ↗</a> : null}
            </article>;
          })}
          {items.length > 5 ? <div className="executive-module-more">VER MAIS {formatNumber(items.length - 5)} DEMANDAS NO ANALISTA</div> : null}
        </div>
        <aside className="executive-module-side">
          <div className="executive-module-section-title"><span>STATUS DAS SOLICITAÇÕES</span><b>{formatNumber(Object.keys(statusCounts).length)} grupos</b></div>
          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([status, count]) => {
            const color = statusColorFor(status, statusColors);
            return <div className="executive-status-row" key={status}><span><i style={{ background: color }} />{status}</span><strong>{formatNumber(count)}</strong></div>;
          })}
          <div className="executive-module-note"><strong>REGRA DE LEITURA</strong><span>Demanda aberta no prazo é atendimento em curso; só entra em “vencida” quando o prazo já passou.</span></div>
        </aside>
      </div>
    </section>
  );
}
