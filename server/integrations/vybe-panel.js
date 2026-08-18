const DEFAULT_API_URL = 'https://vybepainel-v2.vercel.app/api/monday';
const BOARD_ID = 7829537690;
const PAGE_LIMIT = 200;
const SUMMARY_PAGE_LIMIT = 200;
const REQUEST_TIMEOUT_MS = Number(process.env.VYBE_PANEL_REQUEST_TIMEOUT_MS) || 8_000;
const SUMMARY_BUDGET_MS = Number(process.env.VYBE_PANEL_SUMMARY_BUDGET_MS) || 12_000;
const SUMMARY_CACHE_MS = Number(process.env.VYBE_PANEL_SUMMARY_CACHE_MS) || 60_000;

const PRODUCTION_SELECTION = `
  id
  name
  group { id title }
  updates(limit: 3) { id body created_at creator { name } }
  column_values {
    id
    text
    value
  }
`;

const PANEL_SUMMARY_SELECTION = `
  id
  name
  group { id title }
  column_values { id text }
`;

// Chaveado pelos parâmetros: limit, maxPages e budgetMs vêm da query string, e
// sem chave o primeiro que chamasse definia o que todos receberiam por um minuto.
const summaryCache = new Map();

function summaryCacheKey({ limit, maxPages, budgetMs }) {
  return `${limit}:${maxPages}:${budgetMs}`;
}

function getApiUrl() {
  return (process.env.VYBE_PANEL_API_URL || DEFAULT_API_URL).trim();
}

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'API-Version': process.env.VYBE_PANEL_API_VERSION || '2024-01'
  };
  if (process.env.VYBE_PANEL_API_TOKEN) {
    headers.Authorization = process.env.VYBE_PANEL_API_TOKEN.trim();
  }
  return headers;
}

function safeLimit(value, fallback = PAGE_LIMIT) {
  return Math.min(Math.max(Number(value) || fallback, 1), PAGE_LIMIT);
}

function safeBudget(value, fallback = SUMMARY_BUDGET_MS) {
  return Math.max(Number(value) || fallback, 1_000);
}

async function panelQuery(query, variables = {}, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Vybe Painel respondeu com HTTP ${response.status}.`);
    }
    if (payload.errors?.length) {
      throw new Error(payload.errors[0].message || 'Erro GraphQL no Vybe Painel.');
    }
    return payload.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error(`A leitura do Vybe Painel excedeu ${Math.ceil(timeoutMs / 1000)} segundos.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function describeVybePanelSource() {
  const url = new URL(getApiUrl());
  return {
    configured: true,
    host: url.host,
    path: url.pathname,
    mode: 'read-only-graphql-proxy',
    boardId: String(BOARD_ID),
    summaryCacheSeconds: Math.round(SUMMARY_CACHE_MS / 1000),
    summaryBudgetSeconds: Math.round(SUMMARY_BUDGET_MS / 1000)
  };
}

async function readPanelPage({ cursor = null, limit = PAGE_LIMIT, selection = PRODUCTION_SELECTION, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const pageLimit = safeLimit(limit);
  const query = cursor
    ? `query($cursor: String!) {
        next_items_page(limit: ${pageLimit}, cursor: $cursor) {
          cursor
          items { ${selection} }
        }
      }`
    : `query {
        boards(ids: [${BOARD_ID}]) {
          items_page(limit: ${pageLimit}) {
            cursor
            items { ${selection} }
          }
        }
      }`;

  const data = await panelQuery(query, cursor ? { cursor } : {}, { timeoutMs });
  const page = cursor ? data.next_items_page : data.boards?.[0]?.items_page;
  if (!page) throw new Error('Vybe Painel não retornou a página de Produção.');

  return {
    items: Array.isArray(page.items) ? page.items : [],
    cursor: page.cursor || null
  };
}

async function collectPanelSnapshot({ limit = PAGE_LIMIT, maxPages = 100, budgetMs = SUMMARY_BUDGET_MS, selection = PRODUCTION_SELECTION } = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + safeBudget(budgetMs);
  const items = [];
  let cursor = null;
  let pages = 0;
  let warning = null;

  while (pages < maxPages) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1_000) {
      warning = 'A leitura do Vybe Painel atingiu o orçamento global de tempo.';
      break;
    }

    try {
      const page = await readPanelPage({
        cursor,
        limit,
        selection,
        timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remainingMs)
      });
      pages += 1;
      items.push(...page.items);
      cursor = page.cursor;
      if (!cursor) break;
    } catch (error) {
      if (!items.length) throw error;
      warning = error.message;
      break;
    }
  }

  if (cursor && !warning && pages >= maxPages) {
    warning = `Leitura limitada a ${maxPages} páginas para preservar a resposta executiva.`;
  }

  return {
    source: 'Vybe Painel',
    boardId: String(BOARD_ID),
    items,
    pagination: {
      pages,
      count: items.length,
      complete: !cursor && !warning,
      truncated: Boolean(cursor || warning),
      nextCursor: cursor,
      budgetMs: safeBudget(budgetMs),
      elapsedMs: Date.now() - startedAt
    },
    warning
  };
}

export async function getVybePanelProductionSnapshot({ limit = PAGE_LIMIT, maxPages = 100, budgetMs = SUMMARY_BUDGET_MS } = {}) {
  return collectPanelSnapshot({ limit, maxPages, budgetMs, selection: PRODUCTION_SELECTION });
}

export async function getVybePanelExecutiveSnapshot({ limit = SUMMARY_PAGE_LIMIT, maxPages = 10, budgetMs = SUMMARY_BUDGET_MS } = {}) {
  const key = summaryCacheKey({ limit, maxPages, budgetMs });
  const entry = summaryCache.get(key);
  const now = Date.now();
  if (entry?.value && entry.expiresAt > now) {
    return { ...entry.value, cache: { hit: true, expiresAt: new Date(entry.expiresAt).toISOString() } };
  }
  if (!entry?.promise) {
    const promise = collectPanelSnapshot({ limit, maxPages, budgetMs, selection: PANEL_SUMMARY_SELECTION })
      .then(snapshot => {
        summaryCache.set(key, { value: snapshot, expiresAt: Date.now() + SUMMARY_CACHE_MS, promise: null });
        return snapshot;
      })
      .catch(error => {
        summaryCache.delete(key);
        throw error;
      });
    summaryCache.set(key, { ...(entry || { value: null, expiresAt: 0 }), promise });
  }
  const snapshot = await summaryCache.get(key).promise;
  const stored = summaryCache.get(key);
  return { ...snapshot, cache: { hit: false, expiresAt: new Date(stored?.expiresAt || Date.now()).toISOString() } };
}

// Busca dirigida: a estação Analista precisa do contexto de alguns itens
// específicos, não do board inteiro. Evita baixar centenas de KB e, sobretudo,
// evita que uma leitura parcial esconda justamente a evidência procurada.
export async function getVybePanelItems(ids = []) {
  const unique = [...new Set(ids.map(id => String(id).trim()).filter(id => /^\d+$/.test(id)))];
  if (unique.length === 0) return { source: 'Vybe Painel', boardId: String(BOARD_ID), items: [] };

  const items = [];
  // O Monday limita a consulta por ids; lotes de 100 mantêm a chamada válida.
  for (let start = 0; start < unique.length; start += 100) {
    const lote = unique.slice(start, start + 100);
    const data = await panelQuery(`query { items(ids: [${lote.join(',')}]) { ${PRODUCTION_SELECTION} } }`);
    items.push(...(data?.items || []));
  }
  return { source: 'Vybe Painel', boardId: String(BOARD_ID), items, requested: unique.length };
}

export async function getVybePanelPage({ cursor = null, limit = 50 } = {}) {
  const page = await readPanelPage({ cursor: cursor || null, limit, selection: PRODUCTION_SELECTION });
  return {
    source: 'Vybe Painel',
    boardId: String(BOARD_ID),
    items: page.items,
    pagination: { count: page.items.length, complete: !page.cursor, nextCursor: page.cursor }
  };
}

export { DEFAULT_API_URL, BOARD_ID, PRODUCTION_SELECTION, PANEL_SUMMARY_SELECTION };
