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
    const urlLine = envContent.split('\n').find(l => l.startsWith('GOOGLE_CALENDAR_ICAL_URL='));
    if (urlLine) return urlLine.split('=')[1].trim();
  } catch (e) {
    console.warn("Could not read GOOGLE_CALENDAR_ICAL_URL from .env");
  }
  return process.env.GOOGLE_CALENDAR_ICAL_URL || '';
}

export async function getFutureMeetings() {
  const url = getICalUrl();
  if (!url) {
    console.warn('Nenhum link iCal configurado no .env (GOOGLE_CALENDAR_ICAL_URL)');
    return [];
  }

  try {
    const events = await ical.async.fromURL(url);
    const futureMeetings = [];
    
    // Filtra apenas eventos do dia de hoje em diante
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const k in events) {
      if (events.hasOwnProperty(k)) {
        const ev = events[k];
        if (ev.type === 'VEVENT' && ev.start) {
          const eventDate = new Date(ev.start);
          if (eventDate >= startOfToday) {
            futureMeetings.push({
              title: ev.summary || 'Sem título',
              date: ev.start.toISOString(),
              description: ev.description || '',
              location: ev.location || ''
            });
          }
        }
      }
    }

    // Ordenar do mais próximo pro mais distante
    return futureMeetings.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (err) {
    console.error('Erro ao buscar calendário iCal:', err);
    return [];
  }
}
