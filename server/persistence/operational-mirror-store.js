const DEFAULT_KEY = 'vybe:nexus:operational-mirror';

function config() {
  const url = String(process.env.NEXUS_OPERATIONAL_MIRROR_STORE_URL || process.env.NEXUS_MIRROR_STORE_URL || '').trim().replace(/\/$/, '');
  const token = String(process.env.NEXUS_OPERATIONAL_MIRROR_STORE_TOKEN || process.env.NEXUS_MIRROR_STORE_TOKEN || '').trim();
  const key = String(process.env.NEXUS_OPERATIONAL_MIRROR_STORE_KEY || DEFAULT_KEY).trim() || DEFAULT_KEY;
  return { url, token, key, configured: Boolean(url && token) };
}

async function command(command, timeoutMs = 3_000) {
  const store = config();
  if (!store.configured) return null;
  const response = await fetch(store.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${store.token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(`Cache compartilhado do espelho indisponível: ${payload?.error || response.status}`);
  return payload?.result;
}

export function describeOperationalMirrorStore() {
  const store = config();
  return {
    configured: store.configured,
    key: store.key,
    source: store.configured ? 'NEXUS_OPERATIONAL_MIRROR_STORE_URL' : null
  };
}

export async function readSharedOperationalMirror() {
  const store = config();
  if (!store.configured) return null;
  const value = await command(['GET', store.key]);
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed?.snapshot?.ready || !Number.isFinite(Number(parsed.checkedAt))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSharedOperationalMirror(snapshot, checkedAt = Date.now()) {
  const store = config();
  if (!store.configured || !snapshot?.ready) return false;
  const ttlSeconds = Math.max(15, Number(process.env.NEXUS_OPERATIONAL_MIRROR_STORE_TTL_SECONDS) || 60);
  await command(['SET', store.key, JSON.stringify({ snapshot, checkedAt }), 'EX', ttlSeconds]);
  return true;
}
