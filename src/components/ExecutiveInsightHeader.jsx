import React from 'react';
import { ArrowUpRight, CheckCircle2, Info } from 'lucide-react';

/**
 * Cabeçalho de decisão compartilhado pelas estações executivas.
 * Mantém a pergunta dominante separada de impacto, recomendação e ações.
 */
export function ExecutiveInsightHeader({
  eyebrow,
  title,
  description,
  impactLabel,
  impactValue,
  impactNote,
  recommendation,
  tone = 'neutral',
  primaryAction,
  onPrimary,
  secondaryAction,
  onSecondary,
  context,
  compact = false,
  className = '',
}) {
  return (
    <header className={`executive-insight-header ${tone} ${compact ? 'compact' : ''} ${className}`.trim()}>
      <div className="executive-insight-copy">
        {eyebrow ? <span className="executive-insight-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {recommendation ? (
          <div className="executive-insight-recommendation">
            <CheckCircle2 size={15} aria-hidden="true" />
            <span><b>Próximo passo</b>{recommendation}</span>
          </div>
        ) : null}
        {context ? <div className="executive-insight-context"><Info size={13} aria-hidden="true" />{context}</div> : null}
        {(primaryAction || secondaryAction) ? (
          <div className="executive-insight-actions">
            {primaryAction ? <button type="button" className="executive-action-primary" onClick={onPrimary}>{primaryAction}<ArrowUpRight size={15} aria-hidden="true" /></button> : null}
            {secondaryAction ? <button type="button" className="executive-action-secondary" onClick={onSecondary}>{secondaryAction}</button> : null}
          </div>
        ) : null}
      </div>
      {(impactLabel || impactValue || impactNote) ? (
        <div className="executive-insight-impact" aria-label={impactLabel}>
          {impactLabel ? <span>{impactLabel}</span> : null}
          {impactValue !== undefined && impactValue !== null ? <strong>{impactValue}</strong> : null}
          {impactNote ? <small>{impactNote}</small> : null}
        </div>
      ) : null}
    </header>
  );
}

export function ExecutiveSectionHeader({ icon: Icon, eyebrow, title, note, action, onAction, actionClassName = '' }) {
  return (
    <header className="executive-section-header">
      <div className="executive-section-heading">
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
      </div>
      <div className="executive-section-meta">
        {note ? <small>{note}</small> : null}
        {action ? <button type="button" className={actionClassName} onClick={onAction}>{action}<ArrowUpRight size={13} aria-hidden="true" /></button> : null}
      </div>
    </header>
  );
}

export function ExecutiveDisclosure({ label, summary, children, defaultOpen = false }) {
  return (
    <details className="executive-disclosure" open={defaultOpen}>
      <summary><span>{label}</span>{summary ? <small>{summary}</small> : null}<ArrowUpRight size={13} aria-hidden="true" /></summary>
      <div className="executive-disclosure-body">{children}</div>
    </details>
  );
}
