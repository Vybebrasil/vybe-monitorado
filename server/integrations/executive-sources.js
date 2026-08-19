import mondayIntegration from './monday.js';
import { getCalendarSnapshot } from './calendar.js';
import { getOperationalMirrorSnapshot } from './operational-mirror.js';

function mirrorIsReady(snapshot) {
  return snapshot?.ready === true && Array.isArray(snapshot.items);
}

export function buildExecutiveSourceMeta(operationalMirror) {
  const ready = mirrorIsReady(operationalMirror);
  if (ready) {
    const state = operationalMirror.sync?.state || 'fresh';
    const stale = state === 'stale' || state === 'refreshing' || state === 'pending';
    return {
      name: operationalMirror.source,
      status: stale ? 'stale' : 'live',
      freshness: stale ? 'stale' : 'live',
      capturedAt: operationalMirror.sync?.checkedAt || operationalMirror.updatedAt,
      complete: !stale,
      sync: operationalMirror.sync,
      mirrorVersion: Number(operationalMirror.version || operationalMirror.sync?.version || 0),
      versionScope: 'production-mirror',
      versionMonitor: operationalMirror.sync?.versionMonitor || null,
      mirrorReady: true
    };
  }

  return {
    name: 'Monday.com · fallback direto',
    status: 'fallback',
    freshness: 'fallback',
    capturedAt: new Date().toISOString(),
    complete: true,
    mirrorVersion: null,
    versionScope: 'fallback-direct',
    versionMonitor: null,
    sync: {
      state: operationalMirror?.sync?.state || 'unavailable',
      fallback: true,
      error: operationalMirror?.sync?.error || 'Espelho operacional indisponível; leitura direta utilizada.'
    },
    mirrorReady: false
  };
}

export async function getExecutiveSourceBundle({
  forceRefresh = false,
  includeCalendar = true,
  includeMeetingLogs = true
} = {}) {
  const operationalMirror = await getOperationalMirrorSnapshot({ waitForFresh: true, force: forceRefresh });
  const sourceMeta = buildExecutiveSourceMeta(operationalMirror);
  const mirrorSnapshot = sourceMeta.mirrorReady ? operationalMirror : null;

  const [bottlenecks, posts, demands, calendar, meetingLogs] = await Promise.all([
    mondayIntegration.getClientBottlenecks(),
    mondayIntegration.getOpenPosts({ mirrorSnapshot }),
    mondayIntegration.getDelayedDemands(),
    includeCalendar
      ? getCalendarSnapshot()
      : Promise.resolve(null),
    includeMeetingLogs
      ? mondayIntegration.getClientLogs().catch(error => {
          console.warn('[Sources] Histórico de reuniões indisponível:', error.message);
          return [];
        })
      : Promise.resolve([])
  ]);

  const fieldCoverage = posts?.quantitative?.fieldCoverage || null;
  const effectiveSourceMeta = {
    ...sourceMeta,
    fieldCoverage,
    complete: sourceMeta.complete !== false && fieldCoverage?.complete !== false,
    consistency: {
      mode: 'mixed',
      mirrorVersion: sourceMeta.mirrorVersion ?? null,
      versionScope: sourceMeta.versionScope || null,
      boards: {
        production: { source: sourceMeta.name, version: sourceMeta.mirrorVersion ?? null, mode: sourceMeta.mirrorReady ? 'operational-mirror' : 'monday-fallback' },
        clients: { source: 'Monday.com · direto', version: null, mode: 'direct' },
        demands: { source: 'Monday.com · direto', version: null, mode: 'direct' },
        calendar: { source: includeCalendar ? 'Google Calendar · iCal' : 'não consultado', version: null, mode: includeCalendar ? 'direct' : 'disabled' },
        meetings: { source: includeMeetingLogs ? 'Monday.com · Reuniões · direto' : 'não consultado', version: null, mode: includeMeetingLogs ? 'direct' : 'disabled' }
      },
      note: 'A Produção de Conteúdo acompanha a versão do espelho do Vybe Painel; as demais fontes ainda são lidas diretamente pelo Nexus.'
    }
  };

  return {
    operationalMirror,
    sourceMeta: effectiveSourceMeta,
    bottlenecks,
    posts,
    demands,
    calendar,
    meetingLogs
  };
}
