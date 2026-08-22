import React from 'react';
import { ArrowUpRight, ListFilter } from 'lucide-react';

/**
 * Prévia curta de evidências: mostra até cinco itens e empurra o inventário
 * completo para uma ação explícita, mantendo a hierarquia executiva.
 */
export function ExecutiveEvidencePreview({
  title = 'Evidências',
  note,
  items = [],
  total = items.length,
  renderItem,
  empty = 'Nenhuma evidência disponível nesta leitura.',
  onMore,
  moreLabel,
  className = '',
}) {
  const visible = Array.isArray(items) ? items.slice(0, 5) : [];
  const hasMore = Number(total) > visible.length;

  return (
    <section className={`executive-evidence-preview ${className}`} aria-label={title}>
      <header className="executive-evidence-header">
        <div><ListFilter size={15} aria-hidden="true" /><span>{title}</span></div>
        <small>{note || `${visible.length} de ${Number(total) || 0}`}</small>
      </header>
      {visible.length ? (
        <div className="executive-evidence-list">
          {visible.map((item, index) => <React.Fragment key={item?.id || item?.name || item?.client || item?.itemId || index}>{renderItem(item, index)}</React.Fragment>)}
        </div>
      ) : <div className="executive-evidence-empty">{empty}</div>}
      {hasMore && onMore ? <button type="button" className="executive-evidence-more" onClick={onMore}>{moreLabel || `Ver mais ${Number(total) - visible.length} evidências`}<ArrowUpRight size={13} aria-hidden="true" /></button> : null}
    </section>
  );
}

export function EvidenceRow({ eyebrow, title, meta, value, tone = 'neutral', onClick, action = 'Investigar' }) {
  const content = <><div className="executive-evidence-row-copy">{eyebrow ? <small>{eyebrow}</small> : null}<strong>{title}</strong>{meta ? <span>{meta}</span> : null}</div>{value ? <b className={`executive-evidence-row-value ${tone}`}>{value}</b> : null}{onClick ? <ArrowUpRight size={14} aria-hidden="true" /> : null}</>;
  return onClick ? <button type="button" className="executive-evidence-row" onClick={onClick} aria-label={`${action}: ${title}`}>{content}</button> : <div className="executive-evidence-row">{content}</div>;
}
