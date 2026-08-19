import { useState } from 'react';
import { clickable, formatNumber, formatPct } from './executive-helpers.js';
import { ExecutiveMeter } from './ExecutiveMeter.jsx';

export function ReadinessKpiBand({ snapshot, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const readiness = snapshot?.portfolioReadiness || {};
  const kpis = readiness.kpis || {};
  const eligible = Number(kpis.eligibleClients ?? readiness.eligibleClients) || 0;
  const planning = kpis.planning || { withCount: eligible ? Math.max(0, eligible - (Number(readiness.missingPlanning) || 0)) : null, withoutCount: eligible ? Number(readiness.missingPlanning) || 0 : null, coveragePct: readiness.planningCoveragePct ?? null, withClients: [], withoutClients: [], source: 'Monday.com · Gestão de Clientes · Planejamento' };
  const meetings = kpis.meetingsCurrentMonth || { withCount: null, withoutCount: null, coveragePct: null, withClients: [], withoutClients: [], month: null, source: 'Monday.com · Reuniões · data' };
  const onboarding = kpis.onboarding || { withCount: Number(snapshot?.portfolioExecution?.onboarding?.length) || 0, withoutCount: eligible || null, coveragePct: null, withClients: [], withoutClients: [], windowDays: snapshot?.portfolioExecution?.onboardingWindowDays || 30, source: 'Monday.com · created_at + ausência de execução' };
  const calendar = kpis.calendar3Months || { mapped: false, completeCount: null, missingCount: null, coveragePct: null, completeClients: null, missingClients: null, source: 'Monday.com · três colunas mensais de calendário', message: 'Três colunas mensais ainda não mapeadas.' };
  const agenda = kpis.agendaNext30Days || { mapped: false, withCount: null, withoutCount: null, coveragePct: null, withClients: null, withoutClients: null, source: 'Google Calendar · iCal · próximos 30 dias', period: null, message: 'Agenda indisponível ou não configurada.' };
  const monthLabel = meetings.month ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${meetings.month}-01T00:00:00Z`)) : 'mês atual';
  const cards = [
    { id: 'readiness-planning', label: 'PLANEJAMENTO', value: planning.withCount === null ? 'N/D' : formatNumber(planning.withCount), detail: planning.withCount === null ? 'campo não disponível' : `${formatNumber(planning.withoutCount)} sem planejamento · ${formatNumber(eligible)} ativos`, progress: planning.coveragePct, tone: 'warning', title: 'Clientes com planejamento identificado no Monday.', explanation: `${formatNumber(planning.withCount ?? 0)} clientes com planejamento e ${formatNumber(planning.withoutCount ?? 0)} sem planejamento. Fonte: ${planning.source}.`, action: 'Abrir clientes com e sem planejamento' },
    { id: 'readiness-meetings', label: 'REUNIÕES NO MÊS ATUAL · MONDAY', value: meetings.withCount === null ? 'N/D' : formatNumber(meetings.withCount), detail: meetings.withCount === null ? 'board de reuniões indisponível' : `${formatNumber(meetings.withoutCount)} sem reunião · ${monthLabel}`, progress: meetings.coveragePct, tone: 'cyan', title: 'Clientes com reunião registrada no board Reuniões do Monday no mês atual.', explanation: meetings.withCount === null ? 'O board de Reuniões ainda não respondeu nesta leitura.' : `${formatNumber(meetings.withCount)} clientes têm pelo menos uma reunião no board Reuniões em ${monthLabel}; ${formatNumber(meetings.withoutCount)} não têm registro nesse board.`, action: 'Abrir clientes com e sem reunião no Monday' },
    { id: 'readiness-agenda', label: 'AGENDA · PRÓXIMOS 30 DIAS', value: agenda.mapped ? formatNumber(agenda.withCount) : 'N/D', detail: agenda.mapped ? `${formatNumber(agenda.withoutCount)} sem reunião na Agenda` : 'iCal indisponível', progress: agenda.mapped ? agenda.coveragePct : null, tone: agenda.mapped ? 'cyan' : 'supporting', title: 'Clientes com evento correspondente no Google Calendar nos próximos 30 dias.', explanation: agenda.mapped ? `${formatNumber(agenda.withCount)} clientes têm evento correspondente na Agenda; ${formatNumber(agenda.withoutCount)} não têm evento correspondente no período.` : `${agenda.message || 'Google Calendar indisponível nesta leitura.'}`, action: 'Abrir clientes com e sem reunião na Agenda' },
    { id: 'readiness-onboarding', label: 'FASE DE ENTRADA', value: formatNumber(onboarding.withCount), detail: `${formatNumber(onboarding.withoutCount)} fora da entrada · janela ${formatNumber(onboarding.windowDays)}D`, progress: eligible ? (onboarding.withCount / eligible) * 100 : null, tone: 'cyan', title: 'Clientes em implantação segundo a janela de entrada do Nexus.', explanation: `${formatNumber(onboarding.withCount)} clientes estão na janela de implantação de ${formatNumber(onboarding.windowDays)} dias e são separados do indicador de cliente sem execução.`, action: 'Abrir clientes em fase de entrada' },
    { id: 'readiness-calendar', label: 'CALENDÁRIO · 3 MESES', value: calendar.mapped ? formatNumber(calendar.completeCount) : 'N/D', detail: calendar.mapped ? `${formatNumber(calendar.missingCount)} sem 3 meses · ${formatNumber(eligible)} ativos` : '3 colunas não mapeadas no Monday', progress: calendar.mapped ? calendar.coveragePct : null, tone: calendar.mapped ? 'warning' : 'supporting', title: 'Clientes com três meses de calendário preenchidos no Monday.', explanation: calendar.mapped ? `${formatNumber(calendar.completeCount)} clientes têm as três colunas mensais preenchidas e ${formatNumber(calendar.missingCount)} não têm cobertura completa.` : `${calendar.message || 'Mapeie três IDs de colunas mensais para ativar esta leitura.'}`, action: 'Abrir cobertura de calendário' }
  ];

  return (
    <section className="readiness-kpi-band" aria-label="KPIs de prontidão e relacionamento da carteira">
      <div className="readiness-kpi-header"><div><span className="executive-section-kicker">PRONTIDÃO · RELACIONAMENTO</span><h2>O que está preparado antes da execução?</h2></div><div className="readiness-kpi-header-actions"><span className="readiness-kpi-note">CLIENTES · FONTES EXECUTIVAS</span><button type="button" className="readiness-kpi-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'RECOLHER KPIs' : 'ABRIR KPIs DE PRONTIDÃO'} <span aria-hidden="true">{expanded ? '↑' : '↓'}</span></button></div></div>
      {!expanded ? <div className="readiness-kpi-compact" aria-label="Resumo compacto de prontidão">
        {cards.map(card => <button type="button" className={`readiness-kpi-chip ${card.tone}`} key={card.id} onClick={() => onSelect(card.id)}><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></button>)}
      </div> : <div className="readiness-kpi-grid">
        {cards.map(card => <article className={`executive-kpi-card supporting ${card.tone}`} key={card.id} {...clickable(() => onSelect(card.id), `${card.action}: ${card.label}`)}>
          <span className="executive-kpi-label">{card.label}</span>
          <strong className="executive-kpi-value">{card.value}</strong>
          <span className="executive-kpi-detail">{card.detail}</span>
          <ExecutiveMeter value={card.progress} tone={card.tone} label={card.title} />
          <span className="executive-kpi-click">CLIQUE PARA INVESTIGAR ↗</span>
          <div className="executive-kpi-tooltip"><strong>{card.title}</strong><span>{card.explanation}</span><small>{card.action}</small></div>
        </article>)}
      </div>}
    </section>
  );
}
