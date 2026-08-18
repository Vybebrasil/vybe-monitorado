const DEFAULT_API_URL = 'https://vybepainel-v2.vercel.app/api/monday';
const BOARD_ID = 7829537690;
const PAGE_LIMIT = 200;
const REQUEST_TIMEOUT_MS = 20000;

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

async function panelQuery(query, variables = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
    if (error.name === 'AbortError') {
      throw new Error('A leitura do Vybe Painel excedeu 20 segundos.');
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
    boardId: String(BOARD_ID)
  };
}

export async function getVybePanelProductionSnapshot({ limit = PAGE_LIMIT } = {}) {
  const pageLimit = Math.min(Math.max(Number(limit) || PAGE_LIMIT, 1), PAGE_LIMIT);
  const items = [];
  let cursor = null;
  let pages = 0;

  while (true) {
    const query = cursor
      ? `query($cursor: String!) {
          next_items_page(limit: ${pageLimit}, cursor: $cursor) {
            cursor
            items { ${PRODUCTION_SELECTION} }
          }
        }`
      : `query {
          boards(ids: [${BOARD_ID}]) {
            items_page(limit: ${pageLimit}) {
              cursor
              items { ${PRODUCTION_SELECTION} }
            }
          }
        }`;

    const data = await panelQuery(query, cursor ? { cursor } : {});
    const page = cursor ? data.next_items_page : data.boards?.[0]?.items_page;
    if (!page) throw new Error('Vybe Painel não retornou a página de Produção.');

    pages += 1;
    items.push(...(page.items || []));
    cursor = page.cursor || null;
    if (!cursor) break;
  }

  return {
    source: 'Vybe Painel',
    boardId: String(BOARD_ID),
    items,
    pagination: { pages, count: items.length, complete: true }
  };
}

export { DEFAULT_API_URL, BOARD_ID, PRODUCTION_SELECTION };
