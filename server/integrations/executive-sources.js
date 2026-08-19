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
      mirrorReady: true
    };
  }

  return {
    name: 'Monday.com · fallback direto',
    status: 'fallback',
    freshness: 'fallback',
    capturedAt: new Date().toISOString(),
    complete: true,
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
    complete: sourceMeta.complete !== false && fieldCoverage?.complete !== false
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
