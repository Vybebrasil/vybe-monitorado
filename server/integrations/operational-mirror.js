import { describeOperationalMirrorStore, readSharedOperationalMirror, writeSharedOperationalMirror } from '../persistence/operational-mirror-store.js';

const DEFAULT_MIRROR_API_URL = 'https://vybepainel-v2.vercel.app/api/operational-mirror';
const REQUEST_TIMEOUT_MS = Number(process.env.VYBE_OPERATIONAL_MIRROR_TIMEOUT_MS) || 8_000;
const CACHE_TTL_MS = Number(process.env.VYBE_OPERATIONAL_MIRROR_CACHE_MS) || 12_000;
const MAX_DELTA_CHANGES = Number(process.env.VYBE_OPERATIONAL_MIRROR_MAX_DELTA_CHANGES) || 250;

const mirrorCache = {
  snapshot: null,
  version: 0,
  checkedAt: 0,
  expiresAt: 0,
  promise: null,
  lastError: null,
  lastVersionChangeAt: 0,
  pollsWithoutVersionChange: 0,
  lastChanges: []
};

function getMirrorUrl() {
  return (process.env.VYBE_OPERATIONAL_MIRROR_API_URL || DEFAULT_MIRROR_API_URL).trim();
}

function safeUrl() {
  try {
    return new URL(getMirrorUrl());
  } catch {
    throw new Error('URL do espelho operacional do Vybe Painel inválida.');
  }
}

async function requestMirror(path = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(500, REQUEST_TIMEOUT_MS));
  try {
    const response = await fetch(`${getMirrorUrl()}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Espelho operacional respondeu com HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error(`A leitura do espelho operacional excedeu ${Math.ceil(REQUEST_TIMEOUT_MS / 1000)} segundos.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeItem(item) {
  if (!item?.id) return null;
  return {
    ...item,
    id: String(item.id),
    name: item.name || '',
    group: item.group || null,
    updated_at: item.updated_at || null,
    column_values: Array.isArray(item.column_values) ? item.column_values : []
  };
}

export function applyOperationalMirrorDelta(currentSnapshot = null, delta = {}) {
  if (!currentSnapshot || delta?.requires_snapshot) return { snapshot: null, requiresSnapshot: true };
  const currentVersion = Number(currentSnapshot.version) || 0;
  const nextVersion = Number(delta.version) || currentVersion;
  if (nextVersion <= currentVersion) return { snapshot: currentSnapshot, requiresSnapshot: false, changed: false };
  if (!Array.isArray(delta.changes) || delta.changes.length > MAX_DELTA_CHANGES) {
    return { snapshot: null, requiresSnapshot: true };
  }

  const items = new Map((currentSnapshot.items || []).map(item => [String(item.id), item]));
  let invalidChange = false;
  delta.changes.forEach(change => {
    const itemId = String(change?.item_id || change?.id || '');
    if (!itemId) {
      invalidChange = true;
      return;
    }
    if (change.operation === 'delete' || change.deleted === true) {
      items.delete(itemId);
      return;
    }
    if (change.operation && change.operation !== 'upsert' && change.operation !== 'update' && change.operation !== 'create') {
      invalidChange = true;
      return;
    }
    if (!change.raw) {
      invalidChange = true;
      return;
    }
    const normalized = normalizeItem(change.raw);
    if (!normalized) invalidChange = true;
    else items.set(itemId, normalized);
  });

  if (invalidChange) return { snapshot: null, requiresSnapshot: true };

  return {
    requiresSnapshot: false,
    changed: true,
    snapshot: {
      ...currentSnapshot,
      version: nextVersion,
      items: [...items.values()],
      updatedAt: new Date().toISOString()
    }
  };
}

export function normalizeSnapshot(payload) {
  if (!payload?.ready || !Array.isArray(payload.items)) {
    throw new Error('O espelho operacional não retornou uma base pronta.');
  }
  const items = payload.items.map(normalizeItem).filter(Boolean);
  const declaredComplete = payload.complete ?? payload.completeness?.complete ?? null;
  const declaredItemCount = Number(payload.item_count ?? payload.itemCount);
  const countMatches = Number.isFinite(declaredItemCount) && declaredItemCount > 0 && items.length >= declaredItemCount;
  const statusOf = item => String((item.column_values || []).find(column => column?.id === 'status')?.text || '').trim().toLowerCase();
  const observedCompletedCount = items.filter(item => /finalizado|publicado|cancelado|feito|concluído|entregue/.test(statusOf(item))).length;
  const legacyFullSnapshotInferred = declaredComplete == null && !countMatches && observedCompletedCount > 0 && items.length > observedCompletedCount;
  const complete = declaredComplete === false
    ? false
    : declaredComplete === true || countMatches || legacyFullSnapshotInferred;
  const completeness = {
    complete,
    state: complete ? (declaredComplete === true || countMatches ? 'verified' : 'inferred') : 'partial',
    declaredItemCount: Number.isFinite(declaredItemCount) ? declaredItemCount : null,
    receivedItemCount: items.length,
    observedCompletedCount,
    activeItemCount: Number(payload.active_item_count ?? payload.activeItemCount) || null,
    reason: complete
      ? (declaredComplete === true || countMatches ? 'contract_verified' : 'legacy_full_snapshot_inferred')
      : 'full_cohort_not_verified'
  };
  return {
    source: 'Vybe Painel · espelho operacional',
    boardId: String(payload.board_id || 7829537690),
    ready: true,
    complete,
    completeness,
    version: Number(payload.version) || 0,
    items,
    statusOptions: Array.isArray(payload.status_options) ? payload.status_options : [],
    bootstrappedAt: payload.bootstrapped_at || null,
    updatedAt: new Date().toISOString()
  };
}

function syncMeta({ state, snapshot, error = null, pending = false, fallback = false } = {}) {
  const checkedAt = mirrorCache.checkedAt ? new Date(mirrorCache.checkedAt).toISOString() : null;
  const ageMs = mirrorCache.checkedAt ? Math.max(0, Date.now() - mirrorCache.checkedAt) : null;
  const version = Number(snapshot?.version || mirrorCache.version || 0);
  return {
    state,
    pending,
    fallback,
    version,
    checkedAt,
    ageSeconds: ageMs === null ? null : Math.floor(ageMs / 1000),
    cacheExpiresAt: mirrorCache.expiresAt ? new Date(mirrorCache.expiresAt).toISOString() : null,
    itemCount: Array.isArray(snapshot?.items) ? snapshot.items.length : 0,
    completeness: snapshot?.completeness || null,
    error: error?.message || mirrorCache.lastError?.message || null,
    versionMonitor: {
      lastVersionChangeAt: mirrorCache.lastVersionChangeAt ? new Date(mirrorCache.lastVersionChangeAt).toISOString() : null,
      pollsWithoutVersionChange: mirrorCache.pollsWithoutVersionChange,
      observation: mirrorCache.pollsWithoutVersionChange > 0 ? 'stable' : 'changed'
    },
    changes: mirrorCache.lastChanges
  };
}

async function refreshMirror() {
  if (!mirrorCache.promise) {
    mirrorCache.promise = (async () => {
      try {
        const previousVersion = Number(mirrorCache.version) || 0;
        const shared = await readSharedOperationalMirror().catch(error => {
          console.warn('[Mirror] Cache compartilhado indisponível:', error.message);
          return null;
        });
        const sharedCheckedAt = Number(shared?.checkedAt) || 0;
        const sharedAgeMs = sharedCheckedAt ? Date.now() - sharedCheckedAt : Infinity;
        if (shared?.snapshot && sharedAgeMs >= 0 && sharedAgeMs <= CACHE_TTL_MS && Number(shared.snapshot.version) >= Number(mirrorCache.version || 0)) {
          mirrorCache.snapshot = shared.snapshot;
          mirrorCache.version = Number(shared.snapshot.version) || 0;
          mirrorCache.checkedAt = Number(shared.checkedAt) || Date.now();
          mirrorCache.expiresAt = Date.now() + CACHE_TTL_MS;
          mirrorCache.lastError = null;
          mirrorCache.lastChanges = Array.isArray(shared.recentChanges) ? shared.recentChanges : [];
          if (mirrorCache.version > previousVersion || !mirrorCache.lastVersionChangeAt) {
            mirrorCache.lastVersionChangeAt = mirrorCache.checkedAt;
            mirrorCache.pollsWithoutVersionChange = 0;
          } else {
            mirrorCache.pollsWithoutVersionChange += 1;
          }
          return mirrorCache.snapshot;
        }

        let nextSnapshot;
        if (!mirrorCache.snapshot || !mirrorCache.version) {
          nextSnapshot = normalizeSnapshot(await requestMirror());
          mirrorCache.lastChanges = [];
        } else {
          const delta = await requestMirror(`?action=delta&since=${encodeURIComponent(mirrorCache.version)}`);
          const applied = applyOperationalMirrorDelta(mirrorCache.snapshot, delta);
          mirrorCache.lastChanges = applied.requiresSnapshot ? [] : (Array.isArray(delta?.changes) ? delta.changes : []);
          nextSnapshot = applied.requiresSnapshot ? normalizeSnapshot(await requestMirror()) : (applied.snapshot || mirrorCache.snapshot);
        }
        mirrorCache.snapshot = nextSnapshot;
        mirrorCache.version = Number(nextSnapshot.version) || mirrorCache.version;
        mirrorCache.checkedAt = Date.now();
        if (mirrorCache.version > previousVersion || !mirrorCache.lastVersionChangeAt) {
          mirrorCache.lastVersionChangeAt = mirrorCache.checkedAt;
          mirrorCache.pollsWithoutVersionChange = 0;
        } else {
          mirrorCache.pollsWithoutVersionChange += 1;
        }
        mirrorCache.expiresAt = Date.now() + CACHE_TTL_MS;
        mirrorCache.lastError = null;
        await writeSharedOperationalMirror(nextSnapshot, mirrorCache.checkedAt, mirrorCache.lastChanges).catch(error => {
          console.warn('[Mirror] Não foi possível persistir o cache compartilhado:', error.message);
        });
        return nextSnapshot;
      } catch (error) {
        mirrorCache.lastError = error;
        if (mirrorCache.snapshot) return mirrorCache.snapshot;
        throw error;
      } finally {
        mirrorCache.promise = null;
      }
    })();
  }
  return mirrorCache.promise;
}

export function describeOperationalMirrorSource() {
  const url = safeUrl();
  return {
    configured: true,
    host: url.host,
    path: url.pathname,
    mode: 'versioned-operational-mirror',
    boardId: '7829537690',
    pollSeconds: 15,
    cacheSeconds: Math.round(CACHE_TTL_MS / 1000),
    sharedCache: describeOperationalMirrorStore()
  };
}

export async function getOperationalMirrorSnapshot({ waitForFresh = true, force = false } = {}) {
  const now = Date.now();
  const hasUsableCache = mirrorCache.snapshot && !force && mirrorCache.expiresAt > now;
  if (hasUsableCache) {
    return {
      ...mirrorCache.snapshot,
      sync: syncMeta({ state: 'fresh', snapshot: mirrorCache.snapshot })
    };
  }

  const refresh = refreshMirror();
  if (!waitForFresh) {
    refresh.catch(() => null);
    return {
      ...(mirrorCache.snapshot || { source: 'Vybe Painel · espelho operacional', boardId: '7829537690', ready: false, version: 0, items: [], statusOptions: [] }),
      sync: syncMeta({ state: mirrorCache.snapshot ? 'refreshing' : 'pending', snapshot: mirrorCache.snapshot, pending: true })
    };
  }

  try {
    const snapshot = await refresh;
    return { ...snapshot, sync: syncMeta({ state: mirrorCache.lastError ? 'stale' : 'fresh', snapshot }) };
  } catch (error) {
    return {
      ...(mirrorCache.snapshot || { source: 'Vybe Painel · espelho operacional', boardId: '7829537690', ready: false, version: 0, items: [], statusOptions: [] }),
      sync: syncMeta({ state: mirrorCache.snapshot ? 'stale' : 'unavailable', snapshot: mirrorCache.snapshot, error })
    };
  }
}

export function resetOperationalMirrorCacheForTests() {
  mirrorCache.snapshot = null;
  mirrorCache.version = 0;
  mirrorCache.checkedAt = 0;
  mirrorCache.expiresAt = 0;
  mirrorCache.promise = null;
  mirrorCache.lastError = null;
  mirrorCache.lastVersionChangeAt = 0;
  mirrorCache.pollsWithoutVersionChange = 0;
  mirrorCache.lastChanges = [];
}
