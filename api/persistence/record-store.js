import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const STORE_DEFINITIONS = Object.freeze({
  decisions: { envPrefix: 'DECISION', keySuffix: 'executive-decisions' },
  snapshots: { envPrefix: 'SNAPSHOT', keySuffix: 'executive-snapshots' },
  impacts: { envPrefix: 'IMPACT', keySuffix: 'executive-impacts' },
  health: { envPrefix: 'HEALTH', keySuffix: 'client-health-snapshots' }
});

const probeCache = new Map();
const PROBE_CACHE_MS = 30_000;

const isProduction = () => process.env.NODE_ENV === 'production';
const localDataDirectory = () => process.env.NEXUS_LOCAL_DATA_DIR || join(process.cwd(), '.data');
const firstValue = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';

function normalizeBaseUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (isProduction() && parsed.protocol !== 'https:') return '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function resolveRemoteConfig(storeName) {
  const definition = STORE_DEFINITIONS[storeName];
  if (!definition) throw new Error(`Store desconhecido: ${storeName}`);

  const specificUrlName = `NEXUS_${definition.envPrefix}_STORE_URL`;
  const specificTokenName = `NEXUS_${definition.envPrefix}_STORE_TOKEN`;
  const rawUrl = firstValue(
    process.env[specificUrlName],
    process.env.NEXUS_STORE_URL,
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.KV_REST_API_URL
  );
  const token = firstValue(
    process.env[specificTokenName],
    process.env.NEXUS_STORE_TOKEN,
    process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.KV_REST_API_TOKEN
  );
  const url = normalizeBaseUrl(rawUrl);
  const prefix = firstValue(process.env.NEXUS_STORE_PREFIX, 'vybe:nexus');
  const source = process.env[specificUrlName]
    ? specificUrlName
    : process.env.NEXUS_STORE_URL
      ? 'NEXUS_STORE_URL'
      : process.env.UPSTASH_REDIS_REST_URL
        ? 'UPSTASH_REDIS_REST_URL'
        : process.env.KV_REST_API_URL
          ? 'KV_REST_API_URL'
          : null;

  return {
    storeName,
    url,
    token,
    key: `${prefix}:${definition.keySuffix}`,
    source,
    urlProvided: Boolean(rawUrl),
    tokenProvided: Boolean(token),
    configured: Boolean(url && token)
  };
}

function storageError(code, message, cause) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

async function executeRedis(config, command, { timeoutMs = 5_000 } = {}) {
  let response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw storageError('REMOTE_STORE_UNAVAILABLE', 'Não foi possível alcançar o datastore remoto.', error);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw storageError('REMOTE_STORE_INVALID_RESPONSE', `O datastore respondeu HTTP ${response.status} sem JSON válido.`, error);
  }

  if (!response.ok || payload?.error) {
    const detail = payload?.error || `HTTP ${response.status}`;
    throw storageError('REMOTE_STORE_COMMAND_FAILED', `O datastore recusou a operação: ${detail}`);
  }

  return payload?.result;
}

function parseRecord(value, storeName) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    throw storageError('STORE_DATA_CORRUPT', `O store ${storeName} contém um registro inválido.`, error);
  }
}

async function readLocal(fileName) {
  const path = join(localDataDirectory(), fileName);
  try {
    const content = await readFile(path, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocal(fileName, records) {
  await mkdir(localDataDirectory(), { recursive: true });
  const path = join(localDataDirectory(), fileName);
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

export function describeRecordStore(storeName) {
  const config = resolveRemoteConfig(storeName);
  if (config.configured) {
    return {
      mode: 'upstash-redis-rest',
      ready: true,
      source: config.source,
      key: config.key,
      missing: []
    };
  }

  if (!isProduction()) {
    return {
      mode: 'local-development',
      ready: true,
      source: 'NEXUS_LOCAL_DATA_DIR',
      key: config.key,
      missing: []
    };
  }

  const missing = [];
  if (!config.url) missing.push(config.urlProvided ? 'valid HTTPS store URL' : 'store URL');
  if (!config.token) missing.push('store token');
  return {
    mode: config.urlProvided || config.tokenProvided ? 'misconfigured' : 'unavailable',
    ready: false,
    source: config.source,
    key: config.key,
    missing
  };
}

async function probeRemote(config) {
  const cacheKey = `${config.url}|${config.token}`;
  const cached = probeCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < PROBE_CACHE_MS) return cached;

  let result;
  try {
    const pong = await executeRedis(config, ['PING'], { timeoutMs: 3_000 });
    result = { ready: pong === 'PONG' || pong === 'OK', checkedAt: Date.now(), error: null };
  } catch (error) {
    result = { ready: false, checkedAt: Date.now(), error: error.code || 'REMOTE_STORE_UNAVAILABLE' };
  }
  probeCache.set(cacheKey, result);
  return result;
}

export async function getPersistenceHealth({ probe = true } = {}) {
  const entries = await Promise.all(Object.keys(STORE_DEFINITIONS).map(async storeName => {
    const descriptor = describeRecordStore(storeName);
    if (!probe || descriptor.mode !== 'upstash-redis-rest') return [storeName, descriptor];
    const result = await probeRemote(resolveRemoteConfig(storeName));
    return [storeName, { ...descriptor, ready: result.ready, checkedAt: new Date(result.checkedAt).toISOString(), error: result.error }];
  }));
  return Object.fromEntries(entries);
}

export function createRecordStore({ storeName, localFileName, unavailableCode, unavailableMessage }) {
  if (!STORE_DEFINITIONS[storeName]) throw new Error(`Store desconhecido: ${storeName}`);

  const ensureAvailable = () => {
    const descriptor = describeRecordStore(storeName);
    if (descriptor.mode === 'upstash-redis-rest' || descriptor.mode === 'local-development') return descriptor;
    throw storageError(unavailableCode, unavailableMessage);
  };

  return {
    describe() {
      return describeRecordStore(storeName);
    },

    async list() {
      const descriptor = ensureAvailable();
      if (descriptor.mode === 'local-development') return readLocal(localFileName);
      try {
        const values = await executeRedis(resolveRemoteConfig(storeName), ['HVALS', descriptor.key]);
        return (Array.isArray(values) ? values : []).map(value => parseRecord(value, storeName)).filter(Boolean);
      } catch (error) {
        throw storageError(unavailableCode, unavailableMessage, error);
      }
    },

    async get(id) {
      const descriptor = ensureAvailable();
      if (descriptor.mode === 'local-development') {
        const records = await readLocal(localFileName);
        return records.find(record => record.id === id) || null;
      }
      try {
        const value = await executeRedis(resolveRemoteConfig(storeName), ['HGET', descriptor.key, id]);
        return parseRecord(value, storeName);
      } catch (error) {
        throw storageError(unavailableCode, unavailableMessage, error);
      }
    },

    async set(record) {
      if (!record?.id) throw storageError('INVALID_STORE_RECORD', `O registro de ${storeName} precisa de id.`);
      const descriptor = ensureAvailable();
      if (descriptor.mode === 'local-development') {
        const records = await readLocal(localFileName);
        const index = records.findIndex(item => item.id === record.id);
        if (index >= 0) records[index] = record;
        else records.push(record);
        await writeLocal(localFileName, records);
        return record;
      }
      try {
        await executeRedis(resolveRemoteConfig(storeName), ['HSET', descriptor.key, record.id, JSON.stringify(record)]);
        return record;
      } catch (error) {
        throw storageError(unavailableCode, unavailableMessage, error);
      }
    }
  };
}
