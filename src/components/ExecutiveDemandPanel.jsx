import React from 'react';
import { ClipboardList } from 'lucide-react';
import { statusColorFor } from '../data/status-colors.js';
import { formatDate, formatNumber, formatPct } from './executive-helpers.js';
import { ExecutiveDisclosure, ExecutiveInsightHeader, ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

const demandItemUrl = id => id ? `https://gestaovybes-team.monday.com/boards/8385559107/pulses/${id}` : '#';

export function ExecutiveDemandPanel({ snapshot, onSelectClient }) {
  const detailedItems = Array.isArray(snapshot?.demandItemRows) ? snapshot.demandItemRows : Array.isArray(snapshot?.demandItems) ? snapshot.demandItems : [];
  const hasDemandData = detailedItems.length > 0 || snapshot?.demandItemRowsComplete === true || snapshot?.sourceQuality?.consistency?.boards?.demands?.complete === true;
  const items = detailedItems;
  const delayed = items.filter(item => item.isDelayed);
  const onTime = Math.max(0, items.length - delayed.length);
  const clients = new Set(items.map(item => item.cliente || item.client).filter(Boolean));
  const statusCounts = items.reduce((acc, item) => {
    const status = item.status || 'Sem status';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const visible = [...items]
    .filter(item => !item.isCompleted && !String(item.status || '').toLowerCase().includes('finalizado'))
    .sort((a, b) => Number(b.isDelayed) - Number(a.isDelayed) || new Date(a.prazo || '2999-12-31') - new Date(b.prazo || '2999-12-31'))
    .slice(0, 5);
  const source = snapshot?.sourceQuality?.consistency?.boards?.demands || {};
  const statusColors = snapshot?.quantitative?.statusColors || {};
  const primary = visible[0];
  const tone = !hasDemandData ? 'warning' : delayed.length ? 'critical' : 'stable';
  const display = value => value === null || value === undefined ? 'N/D' : formatNumber(value);
  const sourceContext = hasDemandData ? (source.source || 'Monday.com · Solicitações de Demandas · direto') : 'Monday.com · Solicitações de Demandas · fonte indisponível';

  return (
    <section className="executive-module demand-module" aria-label="Visão executiva de Solicitações de Demandas">
      <ExecutiveInsightHeader
        className="demand-hero"
        eyebrow={<><ClipboardList size={14} aria-hidden="true" /> Operação · solicitações</>}
        title="Qual solicitação precisa ser atendida primeiro?"
        description="Esta visão trata somente o board de Solicitações de Demandas. Não mistura atrasos de Produção de Conteúdo."
        recommendation={primary ? `${primary.name} · ${primary.cliente || primary.client || 'cliente não informado'} · ${primary.isDelayed ? 'prazo vencido' : 'próximo prazo'}.` : hasDemandData ? 'Nenhuma Solicitação de Demanda aberta nesta leitura.' : 'O board de Solicitações de Demandas não respondeu nesta leitura.'}
        impactLabel="Solicitações vencidas"
        impactValue={display(hasDemandData ? delayed.length : null)}
        impactNote={hasDemandData ? `${formatPct(items.length ? delayed.length / items.length * 100 : null)} do board · ${formatNumber(items.length)} abertas` : 'N/D · board não reconciliado'}
        tone={tone}
        context={sourceContext}
      />

      <div className="executive-module-kpi-grid">
        <div className="executive-module-kpi"><span>Demandas abertas</span><strong>{display(hasDemandData ? items.length : null)}</strong><small>{hasDemandData ? 'itens ativos no board' : 'board indisponível nesta leitura'}</small></div>
        <div className="executive-module-kpi critical"><span>Demandas vencidas</span><strong>{display(hasDemandData ? delayed.length : null)}</strong><small>{hasDemandData ? `${formatPct(items.length ? delayed.length / items.length * 100 : null)} do board` : 'N/D do board'}</small></div>
        <div className="executive-module-kpi stable"><span>No prazo</span><strong>{display(hasDemandData ? onTime : null)}</strong><small>{hasDemandData ? `${formatPct(items.length ? onTime / items.length * 100 : null)} do board` : 'N/D do board'}</small></div>
        <div className="executive-module-kpi cyan"><span>Clientes com demanda</span><strong>{display(hasDemandData ? clients.size : null)}</strong><small>{hasDemandData ? 'clientes atendidos pelo fluxo' : 'N/D do board'}</small></div>
      </div>

      <div className="executive-module-body-grid">
        <div className="executive-module-list">
          <ExecutiveSectionHeader icon={ClipboardList} eyebrow="Evidências prioritárias" title="Próximas demandas" note={hasDemandData ? `${formatNumber(visible.length)} de ${formatNumber(items.length)} no recorte` : 'fonte indisponível'} />
          {visible.length === 0 ? <div className="executive-empty-state"><strong>{hasDemandData ? 'Nenhuma Solicitação de Demanda aberta nesta leitura.' : 'Solicitações de Demandas indisponíveis nesta leitura.'}</strong><span>{hasDemandData ? 'Isso não significa ausência de trabalho em Produção de Conteúdo.' : 'O Nexus não converte ausência de resposta do board em zero real.'}</span></div> : visible.map((item, index) => {
            const color = statusColorFor(item.status, statusColors);
            return <article className={`executive-demand-row ${item.isDelayed ? 'is-delayed' : ''} ${index === 0 ? 'is-primary' : ''}`} key={item.id || item.name}>
              <div className="executive-demand-main"><strong>{item.name}</strong><span>{item.cliente || item.client || 'Cliente não informado'} · {item.quadro || item.stage || 'Grupo não informado'}</span></div>
              <span className="monday-status-badge" style={{ color, borderColor: color }}>{item.status || 'Sem status'}</span>
              <div className="executive-demand-date"><b>{item.isDelayed ? 'Vencida' : 'Prazo'}</b><span>{formatDate(item.prazo || item.dueDate)}</span></div>
              <div className="executive-demand-actions">
                {(item.cliente || item.client) && onSelectClient ? <button type="button" className="executive-inline-link" onClick={() => onSelectClient(item.cliente || item.client)}>Abrir cliente ↗</button> : null}
                {item.id ? <a className="executive-inline-link" href={demandItemUrl(item.id)} target="_blank" rel="noreferrer">Abrir no Monday ↗</a> : null}
              </div>
            </article>;
          })}
          {items.length > 5 ? <div className="executive-module-more">A lista completa está disponível no explorador abaixo.</div> : null}
        </div>
        <aside className="executive-module-side">
          <ExecutiveDisclosure label="Status das solicitações" summary={hasDemandData ? `${formatNumber(Object.keys(statusCounts).length)} grupos` : 'fonte indisponível'} defaultOpen>
            {hasDemandData ? Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([status, count]) => {
              const color = statusColorFor(status, statusColors);
              return <div className="executive-status-row" key={status}><span><i style={{ background: color }} />{status}</span><strong>{formatNumber(count)}</strong></div>;
            }) : <div className="executive-module-note"><strong>Sem resposta do board</strong><span>Este estado não equivale a 0 demandas. Atualize a leitura ou verifique a configuração da fonte.</span></div>}
            <div className="executive-module-note"><strong>Regra de leitura</strong><span>Demanda aberta no prazo é atendimento em curso; só entra em “vencida” quando o prazo já passou.</span></div>
          </ExecutiveDisclosure>
        </aside>
      </div>
    </section>
  );
}
