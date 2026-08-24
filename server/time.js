// Régua de datas da agência.
//
// Prazo, veiculação e data de reunião vêm do Monday como dia de calendário, sem
// hora. Interpretá-los com `new Date().setHours(0,0,0,0)` amarra o resultado ao
// fuso do servidor: na Vercel isso é UTC, então entre 21h e meia-noite de
// Brasília o servidor já virou o dia e todo item com prazo do próprio dia passa
// a ser contado como atrasado. Aqui o "hoje" é sempre o dia da agência.

export const AGENCY_TIME_ZONE = process.env.NEXUS_TIME_ZONE || 'America/Bahia';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AGENCY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Dia corrente na agência, no formato YYYY-MM-DD (mesmo formato do Monday).
export function agencyToday(now = new Date()) {
  return dayFormatter.format(now instanceof Date ? now : new Date(now));
}

const toUtcMs = day => {
  const [year, month, date] = String(day).split('-').map(Number);
  return Number.isFinite(year) ? Date.UTC(year, month - 1, date) : NaN;
};

// Comparação entre dias de calendário: strings YYYY-MM-DD ordenam
// lexicograficamente na mesma ordem cronológica.
export function isBeforeToday(dateString, now = new Date()) {
  return Boolean(dateString) && String(dateString) < agencyToday(now);
}

export function isWithinNextDays(dateString, now = new Date(), days = 7) {
  if (!dateString) return false;
  const target = toUtcMs(dateString);
  const today = toUtcMs(agencyToday(now));
  if (!Number.isFinite(target) || !Number.isFinite(today)) return false;
  return target >= today && target <= today + days * 86400000;
}

export function daysOverdue(dateString, now = new Date()) {
  if (!dateString) return 0;
  const target = toUtcMs(dateString);
  const today = toUtcMs(agencyToday(now));
  if (!Number.isFinite(target) || !Number.isFinite(today)) return 0;
  return Math.max(0, Math.round((today - target) / 86400000));
}

// Dias corridos entre um instante passado e hoje, na régua da agência.
export function daysSince(isoDate, now = new Date()) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const from = toUtcMs(agencyToday(parsed));
  const today = toUtcMs(agencyToday(now));
  return Math.max(0, Math.round((today - from) / 86400000));
}

// Deslocamento do fuso da agência em relação ao UTC, no instante dado.
// Calculado pelas partes formatadas, não por reparse de string: reparse usa o
// fuso do sistema e o resultado se anula quando os dois coincidem.
function agencyOffsetMs(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: AGENCY_TIME_ZONE,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(date).map(part => [part.type, part.value])
  );
  const wallClock = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
  );
  return wallClock - date.getTime();
}

// Instante em que o dia corrente começou na agência. Útil para filtrar eventos
// com hora (reuniões), onde comparar só o dia perderia a informação.
export function startOfAgencyDay(now = new Date()) {
  const midnightAsUtc = toUtcMs(agencyToday(now));
  // Meio-dia é seguro para medir o deslocamento vigente sem cair numa virada.
  const offset = agencyOffsetMs(new Date(midnightAsUtc + 12 * 3600000));
  return new Date(midnightAsUtc - offset);
}
