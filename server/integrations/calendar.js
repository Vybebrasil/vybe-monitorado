import ical from 'node-ical';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getICalUrl() {
  try {
    const envPath = join(__dirname, '..', '..', '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const urlLine = envContent.split('\n').find(line => line.startsWith('GOOGLE_CALENDAR_ICAL_URL='));
    if (urlLine) return urlLine.slice('GOOGLE_CALENDAR_ICAL_URL='.length).trim();
  } catch (error) {
    console.warn('Não foi possível ler GOOGLE_CALENDAR_ICAL_URL do .env:', error.message);
  }
  return process.env.GOOGLE_CALENDAR_ICAL_URL || '';
}

function emptyCalendarQuality({ configured = false, status = 'unavailable', error = null, fetchedAt }) {
  return {
    source: 'Google Calendar · iCal',
    configured,
    complete: false,
    status,
    fetchedAt,
    eventCount: 0,
    error
  };
}

export async function getCalendarSnapshot({ now = new Date() } = {}) {
  const fetchedAt = new Date().toISOString();
  const url = getICalUrl();
  if (!url) {
    console.warn('Nenhum link iCal configurado (GOOGLE_CALENDAR_ICAL_URL).');
    return { events: [], quality: emptyCalendarQuality({ fetchedAt, status: 'not-configured', error: 'GOOGLE_CALENDAR_ICAL_URL não configurada.' }) };
  }

  try {
    const events = await ical.async.fromURL(url);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const futureMeetings = [];

    for (const key in events) {
      if (!Object.prototype.hasOwnProperty.call(events, key)) continue;
      const event = events[key];
      if (event.type !== 'VEVENT' || !event.start) continue;
      const eventDate = new Date(event.start);
      if (eventDate < startOfToday) continue;
      futureMeetings.push({
        title: event.summary || 'Sem título',
        date: eventDate.toISOString(),
        description: event.description || '',
        location: event.location || ''
      });
    }

    futureMeetings.sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      events: futureMeetings,
      quality: {
        source: 'Google Calendar · iCal',
        configured: true,
        complete: true,
        status: 'ok',
        fetchedAt,
        eventCount: futureMeetings.length,
        error: null
      }
    };
  } catch (error) {
    console.error('Erro ao buscar calendário iCal:', error);
    return { events: [], quality: emptyCalendarQuality({ configured: true, fetchedAt, status: 'error', error: error.message }) };
  }
}

export async function getFutureMeetings(options = {}) {
  const snapshot = await getCalendarSnapshot(options);
  return snapshot.events;
}
