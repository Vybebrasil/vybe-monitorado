import React from 'react';
import { ClipboardList } from 'lucide-react';
import { statusColorFor } from '../data/status-colors.js';
import { formatDate, formatNumber, formatPct } from './executive-helpers.js';
import { ExecutiveDisclosure, ExecutiveInsightHeader, ExecutiveSectionHeader } from './ExecutiveInsightHeader.jsx';

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
  const primary = visible[0];
  const tone = delayed.length ? 'critical' : 'stable';

  return (
    <section className="executive-module demand-module" aria-label="Visão executiva de Solicitações de Demandas">
      <ExecutiveInsightHeader
        className="demand-hero"
        eyebrow={<><ClipboardList size={14} aria-hidden="true" /> Operação · solicitações</>}
        title="Qual solicitação precisa ser atendida primeiro?"
        description="Esta visão trata somente o board de Solicitações de Demandas. Não mistura atrasos de Produção de Conteúdo."
        recommendation={primary ? `${primary.name} · ${primary.cliente || 'cliente não informado'} · ${primary.isDelayed ? 'prazo vencido' : 'próximo prazo'}.` : 'Nenhuma Solicitação de Demanda aberta nesta leitura.'}
        impactLabel="Solicitações vencidas"
        impactValue={formatNumber(delayed.length)}
        impactNote={`${formatPct(items.length ? delayed.length / items.length * 100 : null)} do board · ${formatNumber(items.length)} abertas`}
        tone={tone}
        context={source.source || 'Monday.com · Solicitações de Demandas · direto'}
      />

      <div className="executive-module-kpi-grid">
        <div className="executive-module-kpi"><span>Demandas abertas</span><strong>{formatNumber(items.length)}</strong><small>itens ativos no board</small></div>
        <div className="executive-module-kpi critical"><span>Demandas vencidas</span><strong>{formatNumber(delayed.length)}</strong><small>{formatPct(items.length ? delayed.length / items.length * 100 : null)} do board</small></div>
        <div className="executive-module-kpi stable"><span>No prazo</span><strong>{formatNumber(onTime)}</strong><small>{formatPct(items.length ? onTime / items.length * 100 : null)} do board</small></div>
        <div className="executive-module-kpi cyan"><span>Clientes com demanda</span><strong>{formatNumber(clients.size)}</strong><small>clientes atendidos pelo fluxo</small></div>
      </div>

      <div className="executive-module-body-grid">
        <div className="executive-module-list">
          <ExecutiveSectionHeader icon={ClipboardList} eyebrow="Evidências prioritárias" title="Próximas demandas" note={`${formatNumber(items.length)} no total`} />
          {visible.length === 0 ? <div className="executive-empty-state"><strong>Nenhuma Solicitação de Demanda aberta nesta leitura.</strong><span>Isso não significa ausência de trabalho em Produção de Conteúdo.</span></div> : visible.map((item, index) => {
            const color = statusColorFor(item.status, statusColors);
            return <article className={`executive-demand-row ${item.isDelayed ? 'is-delayed' : ''} ${index === 0 ? 'is-primary' : ''}`} key={item.id || item.name}>
              <div className="executive-demand-main"><strong>{item.name}</strong><span>{item.cliente || 'Cliente não informado'} · {item.quadro || 'Grupo não informado'}</span></div>
              <span className="monday-status-badge" style={{ color, borderColor: color }}>{item.status || 'Sem status'}</span>
              <div className="executive-demand-date"><b>{item.isDelayed ? 'Vencida' : 'Prazo'}</b><span>{formatDate(item.prazo)}</span></div>
              <div className="executive-demand-actions">
                {item.cliente && onSelectClient ? <button type="button" className="executive-inline-link" onClick={() => onSelectClient(item.cliente)}>Abrir cliente ↗</button> : null}
                {item.id ? <a className="executive-inline-link" href={demandItemUrl(item.id)} target="_blank" rel="noreferrer">Abrir no Monday ↗</a> : null}
              </div>
            </article>;
          })}
          {items.length > 5 ? <div className="executive-module-more">Ver mais {formatNumber(items.length - 5)} demandas no Analista</div> : null}
        </div>
        <aside className="executive-module-side">
          <ExecutiveDisclosure label="Status das solicitações" summary={`${formatNumber(Object.keys(statusCounts).length)} grupos`} defaultOpen>
            {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([status, count]) => {
              const color = statusColorFor(status, statusColors);
              return <div className="executive-status-row" key={status}><span><i style={{ background: color }} />{status}</span><strong>{formatNumber(count)}</strong></div>;
            })}
            <div className="executive-module-note"><strong>Regra de leitura</strong><span>Demanda aberta no prazo é atendimento em curso; só entra em “vencida” quando o prazo já passou.</span></div>
          </ExecutiveDisclosure>
        </aside>
      </div>
    </section>
  );
}
