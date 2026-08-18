import React from 'react';
import { clampPct, formatPct } from './executive-helpers.js';

export function ExecutiveMeter({ value, min = 0, max = 100, tone = 'cyan', label, showValue = true, displayValue }) {
  const range = Number(max) - Number(min);
  const ratio = range > 0 ? clampPct(((Number(value) - Number(min)) / range) * 100) : 0;
  return (
    <div className={`visual-meter ${tone}`} aria-label={label || `${formatPct(value)} do total`}>
      <span className="visual-meter-track"><span className="visual-meter-fill" style={{ width: `${ratio}%` }} /></span>
      {showValue ? <strong>{displayValue ?? formatPct(value)}</strong> : null}
    </div>
  );
}
