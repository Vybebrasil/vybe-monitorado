import { isBeforeToday, isWithinNextDays, daysOverdue, daysSince } from '../time.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { clients as activeClients } from '../../src/data/clients.js';
import { STATUS_COLORS } from '../../src/data/status-colors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ALIAS_MAP = {
  'Antonov Center': 'Antonov',
  'Copirecê Puro Milho': 'Copirecê',
  'DiaCenter (Hemodiálise)': 'DiaCenter',
  'DiaCenter Lab Prime': 'DiaCenter',
  'Brussolo Ristorante': 'Restaurante Brussolo',
  'Gonzalez Gastronomia': 'Gonzalez',
  'Dep. João Bacelar': 'João Bacelar',
  'Alpha 1 Consultoria (Algar)': 'Alpha1',
  'VÖA Sportswear': 'VOA',
  'Academia Lions Top': 'Academia Lions',
  'Menina dos Óculos': 'Oticas Menina dos Óculos',
  'Ace - Associação Comercial': 'ACE - Associação Comercial de Irecê (ACE)',
  'Serra Grande Bebidas': 'Grupo Serra Grande',
  'Conectasim': 'ConectaSim'
};

function normalizeClientName(name) {
  if (!name) return 'Sem Cliente';
  const trimmed = name.trim();
  return ALIAS_MAP[trimmed] || trimmed;
}

function percent(value, total) {
  return total ? Number(((value / total) * 100).toFixed(1)) : null;
}

function parsePeopleColumn(column) {
  if (!column?.value) return [];
  try {
    const parsed = JSON.parse(column.value);
    return (parsed.personsAndTeams || [])
      .filter(entry => entry?.kind === 'person' && entry.id)
      .map(entry => ({ id: String(entry.id) }));
  } catch {
    return [];
  }
}

function fallbackPeople(text = '', refs = []) {
  const names = String(text || '').split(',').map(name => name.trim()).filter(Boolean);
  return refs.map((ref, index) => ({ id: String(ref.id), name: names[index] || `Pessoa ${ref.id}`, avatarUrl: null }));
}

function parseDateValue(value) {
  if (!value) return '';
  try {
    return JSON.parse(value)?.date || '';
  } catch {
    return '';
  }
}

// Teto de itens por página da API do Monday.
const PAGE_LIMIT = 500;
const PRIORITY_COLUMN_ID = process.env.MONDAY_PRODUCTION_PRIORITY_COLUMN_ID || 'color_mm164yv8';
const EDITOR_DESIGNER_COLUMN_ID = process.env.MONDAY_PRODUCTION_EDITOR_DESIGNER_COLUMN_ID || 'multiple_person_mm18b2p0';

class MondayIntegration {
  constructor() {
    this.apiUrl = 'https://api.monday.com/v2';
  }

  getToken() {
    // A variável de ambiente é a fonte oficial: é o que a Vercel injeta e o que
    // o dotenv carrega em desenvolvimento. A leitura direta do .env fica só como
    // resgate para scripts que rodam sem dotenv.
    if (process.env.MONDAY_API_TOKEN) return process.env.MONDAY_API_TOKEN.trim();

    try {
      const envPath = join(__dirname, '..', '..', '.env');
      const envContent = readFileSync(envPath, 'utf8');
      const tokenLine = envContent.split('\n').find(l => l.startsWith('MONDAY_API_TOKEN='));
      // slice em vez de split: o token pode conter '='.
      if (tokenLine) return tokenLine.slice('MONDAY_API_TOKEN='.length).trim();
    } catch (e) {
      console.warn('Could not read MONDAY_API_TOKEN from .env');
    }
    return '';
  }

  async getPeopleDirectory(ids = []) {
    const uniqueIds = [...new Set(ids.map(String).filter(Boolean))];
    if (!uniqueIds.length) return {};
    try {
      const data = await this.query(`query { users(ids: [${uniqueIds.join(',')}]) { id name photo_small } }`);
      return Object.fromEntries((data.users || []).map(user => [String(user.id), {
        id: String(user.id),
        name: user.name || '',
        avatarUrl: user.photo_small || null
      }]));
    } catch (error) {
      console.warn(`Monday não retornou fotos de pessoas; usando fallback por iniciais: ${error.message}`);
      return {};
    }
  }

  async query(graphqlQuery, variables = {}) {
    const token = this.getToken();
    if (!token) throw new Error("MONDAY_API_TOKEN not found.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'API-Version': '2024-01'
        },
        body: JSON.stringify({ query: graphqlQuery, variables }),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Monday respondeu com HTTP ${response.status}.`);
      if (data.errors) {
        console.error("Monday GraphQL Error:", JSON.stringify(data.errors, null, 2));
        throw new Error("Erro na query do Monday.");
      }
      return data.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A sincronização com o Monday excedeu 20 segundos.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAllBoardItems({ boardId, selection, queryParams = '', limit = PAGE_LIMIT }) {
    const pageLimit = Math.min(Math.max(Number(limit) || PAGE_LIMIT, 1), PAGE_LIMIT);
    const items = [];
    let cursor = null;
    let pages = 0;

    while (true) {
      const query = cursor
        ? `query($cursor: String!) {
            next_items_page(limit: ${pageLimit}, cursor: $cursor) {
              cursor
              items { ${selection} }
            }
          }`
        : `query {
            boards(ids: [${boardId}]) {
              items_page(limit: ${pageLimit}${queryParams}) {
                cursor
                items { ${selection} }
              }
            }
          }`;

      const data = await this.query(query, cursor ? { cursor } : {});
      const page = cursor ? data.next_items_page : data.boards?.[0]?.items_page;
      if (!page) throw new Error(`Monday não retornou a página do board ${boardId}.`);

      pages += 1;
      items.push(...(page.items || []));
      cursor = page.cursor || null;
      if (!cursor) break;
    }

    return { items, pagination: { pages, count: items.length, complete: true } };
  }

  // 1. Clientes sem planejamento ou com dashboard atrasado
  async getClientBottlenecks() {
    // Board: 7758256536 (Gestão de Clientes)
    // Columns: link_mkzdvjjs (Planejamento), color_mkzkgn5c (Dashboard), status (Status)
    const { items, pagination } = await this.getAllBoardItems({
      boardId: 7758256536,
      limit: 500,
      selection: `
        name
        created_at
        column_values { id text }
      `
    });

    const missingPlanning = [];
    const missingDashboard = [];
    const calendarMonthColumnIds = (process.env.MONDAY_CALENDAR_MONTH_COLUMN_IDS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, 3);
    // Carteira ativa com a data de entrada de cada cliente: é o que permite
    // separar quem parou de quem acabou de chegar.
    const activePortfolio = [];
    let eligibleClients = 0;
    let clientsWithPlanning = 0;
    let clientsWithDashboard = 0;

    items.forEach(item => {
      let status = '';
      let planejamento = '';
      let dashboard = '';

      item.column_values.forEach(c => {
        if (c.id === 'status') status = c.text || '';
        if (c.id === 'link_mkzdvjjs') planejamento = c.text || '';
        if (c.id === 'color_mkzkgn5c') dashboard = c.text || '';
      });

      // Se o cliente não estiver "Inativo" ou "Pausado" (ajuste conforme o status real de vocês)
      if (status && !status.toLowerCase().includes('inativo')) {
        eligibleClients += 1;
        activePortfolio.push({
          name: item.name,
          since: item.created_at || null,
          calendarMonths: calendarMonthColumnIds.map(columnId => ({ columnId, value: item.column_values.find(column => column.id === columnId)?.text || '' }))
        });
        // Planejamento: se estiver vazio ou se tiver o texto padrão de "Fazer planejamento"
        const planningMissing = !planejamento || planejamento.toLowerCase().includes('fazer planejamento');
        if (planningMissing) {
          missingPlanning.push(item.name);
        } else {
          clientsWithPlanning += 1;
        }

        // Dashboard status: "Atrasado", "Pendente", "Desatualizado", ou vazio
        const dbLower = dashboard.toLowerCase();
        const dashboardMissing = dbLower.includes('atrasado') || dbLower.includes('pendente') || dbLower.includes('desatualizado') || dbLower.includes('dasatualizado') || dbLower === '';
        if (dashboardMissing) {
          missingDashboard.push(item.name);
        } else {
          clientsWithDashboard += 1;
        }
      }
    });

    return {
      missingPlanning,
      missingDashboard,
      activePortfolio,
      quantitative: {
        eligibleClients,
        clientsWithPlanning,
        planningCoveragePct: percent(clientsWithPlanning, eligibleClients),
        clientsWithDashboard,
        dashboardCoveragePct: percent(clientsWithDashboard, eligibleClients)
      },
      calendar3MonthCoverage: calendarMonthColumnIds.length === 3 ? (() => {
        const completeClients = activePortfolio.filter(client => client.calendarMonths.every(month => month.value && !['-', 'n/a', 'não'].includes(month.value.trim().toLowerCase()))).map(client => client.name);
        const missingClients = activePortfolio.filter(client => !completeClients.includes(client.name)).map(client => client.name);
        return { mapped: true, columnIds: calendarMonthColumnIds, completeClients, missingClients, completeCount: completeClients.length, missingCount: missingClients.length, coveragePct: percent(completeClients.length, eligibleClients) };
      })() : { mapped: false, columnIds: calendarMonthColumnIds, completeClients: null, missingClients: null, completeCount: null, missingCount: null, coveragePct: null, message: 'Mapeie MONDAY_CALENDAR_MONTH_COLUMN_IDS com três IDs de colunas mensais do Monday para ativar esta leitura.' },
      readinessQuality: {
        planning: {
          columnId: 'link_mkzdvjjs',
          eligibleClients,
          populatedClients: clientsWithPlanning,
          missingClients: missingPlanning.length,
          coveragePct: percent(clientsWithPlanning, eligibleClients),
          classification: eligibleClients > 0 && clientsWithPlanning === 0 ? 'source-empty-or-unmapped' : clientsWithPlanning < eligibleClients ? 'partial-coverage' : 'complete-coverage'
        },
        dashboard: {
          columnId: 'color_mkzkgn5c',
          eligibleClients,
          populatedClients: clientsWithDashboard,
          missingClients: missingDashboard.length,
          coveragePct: percent(clientsWithDashboard, eligibleClients),
          classification: eligibleClients > 0 && clientsWithDashboard === 0 ? 'source-empty-or-unmapped' : clientsWithDashboard < eligibleClients ? 'partial-coverage' : 'complete-coverage'
        }
      },
      pagination
    };
  }

  // 2. Posts Atrasados / Acumulados
  async getOpenPosts({ mirrorSnapshot = null } = {}) {
    // Board: 7829537690 (Produção de Conteúdo)
    //
    // Quando o espelho operacional do Vybe Painel está pronto, ele entrega o
    // board completo e versionado. O Nexus processa essa mesma base sem fazer
    // uma segunda consulta ao Monday. O caminho direto permanece como fallback
    // controlado para não interromper a leitura executiva quando o espelho estiver
    // indisponível.
    const mirrorItems = Array.isArray(mirrorSnapshot?.items) ? mirrorSnapshot.items : null;
    let items;
    let pagination;
    if (mirrorItems) {
      items = mirrorItems;
      pagination = {
        pages: null,
        count: null,
        rawCount: items.length,
        complete: true,
        source: 'Vybe Painel · espelho operacional',
        version: Number(mirrorSnapshot.version) || null
      };
    } else {
      const result = await this.getAllBoardItems({
        boardId: 7829537690,
        limit: PAGE_LIMIT,
        // O recorte executivo precisa conhecer também os concluídos por pessoa,
        // cliente, etapa e status. A paginação completa substitui o antigo filtro
        // de status na origem; os KPIs continuam excluindo os status concluídos
        // apenas no domínio, sem perder a dimensão necessária para os filtros.
        selection: `
          id
          name
          group { title }
          column_values { id text value }
        `
      });
      items = result.items;
      pagination = result.pagination;
    }

    const boardItemsCount = mirrorItems
      ? items.length
      : Number((await this.query(`query {
        boards(ids: [7829537690]) { items_count }
      }`)).boards?.[0]?.items_count) || items.length;

    const postsByClient = {};
    let totalDelayed = 0;
    const today = new Date();
    const statusCounts = {};
    const clientCounts = {};
    const groupCounts = {};
    const priorityCounts = {};
    const formatCounts = {};
    const personIds = new Set();
    const itemRows = [];
    const availableColumnIds = new Set(items.flatMap(item => (item.column_values || []).map(column => column?.id).filter(Boolean)));
    const fieldCoverage = {
      priority: { columnId: PRIORITY_COLUMN_ID, available: availableColumnIds.has(PRIORITY_COLUMN_ID) },
      editorDesigner: { columnId: EDITOR_DESIGNER_COLUMN_ID, available: availableColumnIds.has(EDITOR_DESIGNER_COLUMN_ID) }
    };
    fieldCoverage.missing = Object.entries(fieldCoverage).filter(([, value]) => value && value.available === false).map(([field]) => field);
    fieldCoverage.complete = fieldCoverage.missing.length === 0;
    let totalItems = 0;
    // A leitura atual traz o board completo (espelho ou fallback paginado),
    // então os concluídos são contados item a item dentro do mesmo loop. Não
    // somar a diferença entre items_count e items.length, pois isso duplicaria
    // o total quando a consulta já não filtra status.
    let completedItems = 0;
    let itemsWithClient = 0;
    let itemsWithInternalDeadline = 0;
    let itemsWithPublicationDate = 0;
    let overdueInternal = 0;
    let overduePublication = 0;
    let dueWithin7Internal = 0;
    let dueWithin7Publication = 0;
    let classifiedPriority = 0;

    items.forEach(item => {
      let cliente = 'Sem Cliente';
      let status = '';
      let prazoStr = '';
      let veiculacaoStr = '';
      let responsavel = '';
      let editorDesigner = '';
      let responsavelRefs = [];
      let editorDesignerRefs = [];
      let statusChangedAt = null;

      item.column_values.forEach(c => {
        if (c.id === 'lista_suspensa_mkmqnjbv') cliente = normalizeClientName(c.text);
        if (c.id === 'status') {
          status = c.text || '';
          statusChangedAt = c.updated_at || null;
        }
        if (c.id === 'person') {
          responsavel = c.text || '';
          responsavelRefs = parsePeopleColumn(c);
          responsavelRefs.forEach(person => personIds.add(person.id));
        }
        if (c.id === EDITOR_DESIGNER_COLUMN_ID) {
          editorDesigner = c.text || '';
          editorDesignerRefs = parsePeopleColumn(c);
          editorDesignerRefs.forEach(person => personIds.add(person.id));
        }
        if (c.id === 'data') {
          try {
            if (c.value) {
              const val = JSON.parse(c.value);
              prazoStr = val.date || '';
            }
          } catch(e) {}
        }
        if (c.id === 'data__1') {
          try {
            if (c.value) {
              const val = JSON.parse(c.value);
              veiculacaoStr = val.date || '';
            }
          } catch(e) {}
        }
      });

      const normalizedStatus = status.trim() || 'Sem status';
      const normalizedClient = normalizeClientName(cliente);
      const groupName = item.group ? item.group.title : 'Sem Quadro';
      const priority = item.column_values.find(column => column.id === PRIORITY_COLUMN_ID)?.text || '';
      const format = item.column_values.find(column => column.id === 'lista_suspensa0__1')?.text || '';
      const statusLower = status.toLowerCase();
      const isDone = statusLower.includes('finalizado') || statusLower.includes('publicado') || statusLower.includes('cancelado');
      const isReady = statusLower.includes('agendado') || statusLower.includes('para agendar');
      const itemRow = {
        id: item.id,
        name: item.name,
        client: normalizedClient,
        cliente: normalizedClient,
        stage: groupName,
        etapa: groupName,
        status: normalizedStatus,
        responsible: responsavel,
        responsavel,
        responsavelRefs,
        editorDesigner,
        editorDesignerRefs,
        prazo: prazoStr,
        dueDate: prazoStr,
        veiculacao: veiculacaoStr,
        isCompleted: isDone,
        isReady,
        isDelayed: false,
        isDelayedPrazo: false,
        isDelayedVeiculacao: false,
        source: 'Produção de Conteúdo'
      };
      itemRows.push(itemRow);

      if (status !== '' && !isDone) {
        totalItems += 1;
        statusCounts[normalizedStatus] = (statusCounts[normalizedStatus] || 0) + 1;
        clientCounts[normalizedClient] = (clientCounts[normalizedClient] || 0) + 1;
        if (normalizedClient !== 'Sem Cliente') itemsWithClient += 1;
        groupCounts[groupName] = (groupCounts[groupName] || 0) + 1;
        if (priority) {
          classifiedPriority += 1;
          priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
        }
        if (format) formatCounts[format] = (formatCounts[format] || 0) + 1;
        if (prazoStr) itemsWithInternalDeadline += 1;
        if (veiculacaoStr) itemsWithPublicationDate += 1;
      }

      // Finalizado/Publicado/Cancelado sai dos KPIs; Agendado e Para agendar permanecem no recorte ativo.
      // Aqui só entram os concluídos que escaparam do filtro da query (Publicado,
      // Cancelado); os Finalizados já foram contados via items_count.
      if (isDone) completedItems += 1;

      if (!isDone && status !== '') {
        if (!postsByClient[cliente]) {
          postsByClient[cliente] = { open: 0, delayedPrazo: 0, delayedVeiculacao: 0, details: [] };
        }
        postsByClient[cliente].open += 1;

        let isDelayedPrazo = false;
        let isDelayedVeiculacao = false;

        // Agendado/Para agendar continua no recorte, mas não é atraso operacional.
        // KPI agregado e ranking por cliente usam a mesma régua (isBeforeToday):
        // item com prazo hoje ainda não está atrasado.
        if (!isReady) {
          if (isBeforeToday(prazoStr, today)) {
            overdueInternal += 1;
            postsByClient[cliente].delayedPrazo += 1;
            isDelayedPrazo = true;
          }
          if (isBeforeToday(veiculacaoStr, today)) {
            overduePublication += 1;
            postsByClient[cliente].delayedVeiculacao += 1;
            isDelayedVeiculacao = true;
          }
        }
        if (prazoStr && isWithinNextDays(prazoStr, today)) {
          dueWithin7Internal += 1;
        }
        if (veiculacaoStr && isWithinNextDays(veiculacaoStr, today)) {
          dueWithin7Publication += 1;
        }

        if (isDelayedPrazo || isDelayedVeiculacao) {
          totalDelayed += 1;
        }
        itemRow.isDelayedPrazo = isDelayedPrazo;
        itemRow.isDelayedVeiculacao = isDelayedVeiculacao;
        itemRow.isDelayed = isDelayedPrazo || isDelayedVeiculacao;

        const daysInStatus = statusChangedAt ? daysSince(statusChangedAt, today) : null;
        postsByClient[cliente].details.push({
          id: item.id,
          name: item.name,
          quadro: item.group ? item.group.title : 'Sem Quadro',
          status,
          statusChangedAt,
          daysInStatus,
          prazo: prazoStr,
          veiculacao: veiculacaoStr,
          responsavel,
          editorDesigner,
          responsavelRefs,
          editorDesignerRefs,
          isDelayedPrazo,
          isDelayedVeiculacao,
          daysOverdue: Math.max(daysOverdue(prazoStr, today), daysOverdue(veiculacaoStr, today))
        });
      }
    });

    const peopleDirectory = await this.getPeopleDirectory([...personIds]);
    const enrichPeople = row => {
      row.responsavelPeople = (row.responsavelRefs?.length ? row.responsavelRefs : fallbackPeople(row.responsavel)).map(person => ({
        ...person,
        ...(peopleDirectory[person.id] || {}),
        name: peopleDirectory[person.id]?.name || person.name || row.responsavel || 'Pessoa não identificada'
      }));
      row.editorDesignerPeople = (row.editorDesignerRefs?.length ? row.editorDesignerRefs : fallbackPeople(row.editorDesigner)).map(person => ({
        ...person,
        ...(peopleDirectory[person.id] || {}),
        name: peopleDirectory[person.id]?.name || person.name || row.editorDesigner || 'Pessoa não identificada'
      }));
      return row;
    };
    itemRows.forEach(enrichPeople);
    Object.values(postsByClient).forEach(clientData => clientData.details.forEach(enrichPeople));

    // Ordenar por clientes com mais atrasos/abertos, e ordenar posts do mais antigo para mais novo
    const ranking = Object.keys(postsByClient).map(cliente => {
      const data = postsByClient[cliente];
      data.details.sort((a, b) => {
        const dateA = a.veiculacao || a.prazo;
        const dateB = b.veiculacao || b.prazo;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA) - new Date(dateB);
      });
      return {
        name: cliente,
        ...data
      };
    }).sort((a, b) => (b.delayedVeiculacao + b.delayedPrazo) - (a.delayedVeiculacao + a.delayedPrazo) || b.open - a.open);

    // Ranking de responsaveis com mais atrasos
    const responsavelMap = {};
    Object.entries(postsByClient).forEach(([clienteName, clientData]) => {
      clientData.details.forEach(post => {
        if (!post.isDelayedPrazo && !post.isDelayedVeiculacao) return;
        const people = [];
        if (post.responsavel) post.responsavel.split(',').forEach(p => people.push({ name: p.trim(), tipo: 'Responsável' }));
        if (post.editorDesigner) post.editorDesigner.split(',').forEach(p => people.push({ name: p.trim(), tipo: 'Editor/Designer' }));
        if (people.length === 0) people.push({ name: 'Sem responsável', tipo: '' });
        people.forEach(({ name, tipo }) => {
          if (!name) return;
          if (!responsavelMap[name]) responsavelMap[name] = { name, tipo, delayedPrazo: 0, delayedVeiculacao: 0, posts: [] };
          if (post.isDelayedPrazo) responsavelMap[name].delayedPrazo++;
          if (post.isDelayedVeiculacao) responsavelMap[name].delayedVeiculacao++;
          responsavelMap[name].posts.push({
            id: post.id,
            postName: post.name,
            cliente: clienteName,
            status: post.status,
            prazo: post.prazo,
            veiculacao: post.veiculacao,
            isDelayedPrazo: post.isDelayedPrazo,
            isDelayedVeiculacao: post.isDelayedVeiculacao
          });
        });
      });
    });

    const responsavelRanking = Object.values(responsavelMap)
      .sort((a, b) => (b.delayedPrazo + b.delayedVeiculacao) - (a.delayedPrazo + a.delayedVeiculacao));

    const delayDetails = ranking
      .flatMap(row => row.details
        .filter(post => post.isDelayedPrazo || post.isDelayedVeiculacao)
        .map(post => ({
          id: post.id,
          client: row.name,
          name: post.name,
          stage: post.quadro,
          status: post.status,
          statusChangedAt: post.statusChangedAt,
          daysInStatus: post.daysInStatus,
          prazo: post.prazo,
          veiculacao: post.veiculacao,
          responsavel: post.responsavel,
          editorDesigner: post.editorDesigner,
          responsavelPeople: post.responsavelPeople || [],
          editorDesignerPeople: post.editorDesignerPeople || [],
          delayType: [post.isDelayedPrazo ? 'prazo interno' : '', post.isDelayedVeiculacao ? 'veiculação' : ''].filter(Boolean).join(' + '),
          daysOverdue: Math.max(daysOverdue(post.prazo, today), daysOverdue(post.veiculacao, today))
        })))
      .sort((a, b) => b.daysOverdue - a.daysOverdue || new Date(a.prazo || a.veiculacao || 0) - new Date(b.prazo || b.veiculacao || 0));

    const totalScope = totalItems + completedItems;
    const readyToSchedule = ['Para agendar', 'Agendado'].reduce((sum, label) => sum + (statusCounts[label] || 0), 0);
    pagination = {
      ...pagination,
      count: Number.isFinite(Number(pagination?.count)) && Number(pagination.count) > 0 ? Number(pagination.count) : items.length,
      rawCount: items.length,
      activeCount: totalItems,
      completedCount: completedItems,
      complete: pagination?.complete !== false
    };
    const productivity = {
      activeItems: totalItems,
      completedItems,
      activePct: percent(totalItems, totalScope),
      completionPct: percent(completedItems, totalScope),
      readyToSchedule,
      readyToSchedulePct: percent(readyToSchedule, totalItems),
      delayedItems: delayDetails.length,
      delayedPctOfActive: percent(delayDetails.length, totalItems),
      byStage: Object.entries(groupCounts)
        .map(([stage, count]) => ({ stage, count, pctOfActive: percent(count, totalItems) }))
        .sort((a, b) => b.count - a.count),
      topResponsibles: responsavelRanking.slice(0, 5).map(row => ({
        name: row.name,
        delayedPrazo: row.delayedPrazo,
        delayedVeiculacao: row.delayedVeiculacao,
        delayedTotal: row.delayedPrazo + row.delayedVeiculacao,
        posts: Array.isArray(row.posts) ? row.posts.length : Number(row.posts) || 0,
        itemIds: Array.isArray(row.posts) ? row.posts.map(item => item.id).filter(Boolean).slice(0, 100) : []
      }))
    };

    return {
      ranking,
      // activeItems preserva o contrato histórico: apenas itens em fluxo.
      activeItems: itemRows.filter(item => !item.isCompleted && item.status !== 'Sem status'),
      // itemRows é a coorte atual completa e serve aos recortes executivos
      // sem ser necessário consultar o Monday novamente no frontend.
      itemRows,
      totalDelayed,
      delayDetails,
      productivity,
      responsavelRanking,
      quantitative: {
        totalItems,
        itemsWithClient,
        clientCoveragePct: percent(itemsWithClient, totalItems),
        activeItems: totalItems,
        completedItems,
        activePct: percent(totalItems, totalItems + completedItems),
        itemsWithInternalDeadline,
        internalDeadlineCoveragePct: percent(itemsWithInternalDeadline, totalItems),
        itemsWithPublicationDate,
        publicationDateCoveragePct: percent(itemsWithPublicationDate, totalItems),
        overdueInternal,
        overdueInternalPctOfActive: percent(overdueInternal, totalItems),
        overduePublication,
        overduePublicationPctOfActive: percent(overduePublication, totalItems),
        dueWithin7Internal,
        dueWithin7Publication,
        classifiedPriority,
        priorityCoveragePct: percent(classifiedPriority, totalItems),
        statusCounts,
        statusColors: STATUS_COLORS,
        clientCounts,
        groupCounts,
        priorityCounts,
        formatCounts,
        fieldCoverage
      },
      pagination
    };
  }

  // 3. Demandas Travadas / Atrasadas
  async getDelayedDemands() {
    // Board: 8385559107 (Solicitações de Demandas)
    // Columns: lista_suspensa_mkmet5gs (Cliente), status (Status), data (Prazo)
    const { items, pagination } = await this.getAllBoardItems({
      boardId: 8385559107,
      limit: 500,
      selection: `
        id
        name
        group { title }
        column_values { id text value }
      `
    });

    const delayedDemands = [];
    const openDemandItems = [];
    const demandRows = [];
    // Demanda aberta é diferente de demanda atrasada: um cliente com demandas no
    // prazo está sendo atendido, e não pode ser lido como parado só porque nada
    // dele venceu ainda.
    const clientsWithOpenDemand = new Set();
    const today = new Date();

    items.forEach(item => {
      let cliente = '';
      let status = '';
      let prazoStr = '';
      let responsavel = '';

      item.column_values.forEach(c => {
        if (c.id === 'lista_suspensa_mkmet5gs') cliente = normalizeClientName(c.text);
        if (c.id === 'status') status = c.text || '';
        if (c.id === 'person' || c.id === 'responsavel') responsavel = c.text || '';
        if (c.id === 'data') {
          try {
            if (c.value) {
              const val = JSON.parse(c.value);
              prazoStr = val.date || '';
            }
          } catch(e) {}
        }
      });

      const isDone = status.toLowerCase().includes('feito') || status.toLowerCase().includes('concluído') || status.toLowerCase().includes('entregue') || status.toLowerCase().includes('cancelado');
      const demandRow = {
        id: item.id,
        name: item.name,
        client: cliente || 'Sem Cliente',
        cliente: cliente || 'Sem Cliente',
        stage: item.group?.title || 'Sem Quadro',
        etapa: item.group?.title || 'Sem Quadro',
        status: status || 'Sem status',
        responsible: responsavel,
        responsavel,
        prazo: prazoStr,
        dueDate: prazoStr,
        isCompleted: isDone,
        isDelayed: !isDone && isBeforeToday(prazoStr, today),
        source: 'Solicitações de Demandas'
      };
      demandRows.push(demandRow);

      if (!isDone && status !== '') {
        if (cliente) clientsWithOpenDemand.add(cliente);
        const openDemand = {
          id: item.id,
          name: item.name,
          quadro: item.group ? item.group.title : 'Sem Quadro',
          cliente,
          status,
          prazo: prazoStr,
          isDelayed: isBeforeToday(prazoStr, today)
        };
        openDemandItems.push(openDemand);
        // Mesma régua dos posts: demanda com prazo hoje ainda não está atrasada.
        if (openDemand.isDelayed) delayedDemands.push(openDemand);
      }
    });

    // O array continua sendo o retorno principal para não quebrar quem só conta
    // atrasos; a carteira com demanda aberta viaja junto como propriedade.
    delayedDemands.clientsWithOpenDemand = [...clientsWithOpenDemand];
    delayedDemands.openDemandItems = openDemandItems;
    delayedDemands.itemRows = demandRows;
    delayedDemands.pagination = pagination;
    return delayedDemands;
  }

  // 4. Client Logs (Histórico de Reuniões)
  async getClientLogs() {
    // Board: 9918871233 (Reuniões)
    const { items, pagination } = await this.getAllBoardItems({
      boardId: 9918871233,
      limit: 500,
      selection: `
        id
        name
        column_values { id text value }
      `
    });
    const clientLogs = {};

    // 1. Preenche apenas com os Clientes Ativos
    activeClients.forEach(c => {
      clientLogs[c.name] = {
        name: c.name,
        meetings: [],
        lastMeetingDate: null,
        daysSinceLastMeeting: null,
        futureMeetings: []
      };
    });

    // Função auxiliar para tentar encontrar o cliente ativo equivalente
    const findActiveClientName = (mondayName) => {
      const normalized = normalizeClientName(mondayName);
      if (clientLogs[normalized]) return normalized; // Bateu exato

      // Busca fuzzy (ex: "experimente" contido em "Experimente Papelaria")
      const lower = normalized.toLowerCase();
      for (const activeName of Object.keys(clientLogs)) {
        if (activeName.toLowerCase().includes(lower) || lower.includes(activeName.toLowerCase())) {
          return activeName;
        }
      }
      return null;
    };

    items.forEach(item => {
      let clienteRaw = '';
      let dataReuniao = '';
      let status = '';
      let pautaLink = '';
      let ataLink = '';

      item.column_values.forEach(c => {
        if (c.id === 'dropdown_mkv8tcm2') clienteRaw = c.text;
        if (c.id === 'data') {
          try {
            if (c.value) {
              const val = JSON.parse(c.value);
              dataReuniao = val.date || '';
            }
          } catch(e) {}
        }
        if (c.id === 'status') status = c.text || '';
        if (c.id === 'file_mkv8nqhd') pautaLink = c.text || '';
        if (c.id === 'file_mkw9a4kq') ataLink = c.text || '';
      });

      if (!clienteRaw || clienteRaw === 'Sem Cliente') return;
      if (!dataReuniao) return;

      const matchedClient = findActiveClientName(clienteRaw);

      // SE NÃO FOR UM CLIENTE ATIVO, IGNORA.
      if (!matchedClient) return;

      clientLogs[matchedClient].meetings.push({
        id: item.id,
        name: item.name,
        date: dataReuniao,
        status: status,
        pauta: pautaLink,
        ata: ataLink
      });
    });

    // Processamento pós-agrupamento (ordenação e dias sem reunião)
    const hoje = new Date();

    Object.values(clientLogs).forEach(client => {
      // Ordena reuniões da mais recente para a mais antiga
      client.meetings.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Busca a última reunião que já aconteceu (data <= hoje)
      const pastMeetings = client.meetings.filter(m => new Date(m.date) <= hoje);

      if (pastMeetings.length > 0) {
        client.lastMeetingDate = pastMeetings[0].date;
        // Dias de calendário na régua da agência: reunião de hoje é 0 dia,
        // não 1 como resultava do arredondamento sobre a diferença bruta.
        client.daysSinceLastMeeting = daysSince(client.lastMeetingDate, hoje);
      }
    });

    const sortedLogs = Object.values(clientLogs).sort((a, b) => {
      const daysA = a.daysSinceLastMeeting === null ? Infinity : a.daysSinceLastMeeting;
      const daysB = b.daysSinceLastMeeting === null ? Infinity : b.daysSinceLastMeeting;
      return daysB - daysA;
    });

    sortedLogs.pagination = pagination;
    return sortedLogs;
  }
}

export default new MondayIntegration();
