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
// Índice do rótulo "Finalizado" na coluna `status` do board de Produção de Conteúdo.
// É o único status concluído existente lá hoje; Publicado e Cancelado seguem
// tratados por texto em `isDone`, caso passem a existir.
const DONE_STATUS_INDEX = 3;

function isBeforeToday(dateString, today) {
  return Boolean(dateString) && new Date(`${dateString}T23:59:59Z`) < today;
}

function isWithinNextDays(dateString, today, days = 7) {
  if (!dateString) return false;
  const date = new Date(`${dateString}T00:00:00Z`);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + days);
  return date >= today && date <= end;
}

function daysOverdue(dateString, today = new Date()) {
  if (!dateString) return 0;
  const due = new Date(`${dateString}T00:00:00Z`);
  const base = new Date(today);
  base.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((base.getTime() - due.getTime()) / 86400000));
}

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
        activePortfolio.push({ name: item.name, since: item.created_at || null });
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
  async getOpenPosts() {
    // Board: 7829537690 (Produção de Conteúdo)
    //
    // O board acumula todo o histórico (milhares de itens) e o grupo Finalizados
    // responde pela maior parte. Pedir a página inteira e descartar os concluídos
    // em memória esbarraria no limite de 500 itens por página: bastaria a operação
    // ativa crescer para que itens sumissem em silêncio, sem erro nenhum.
    // Por isso o corte é feito na origem, filtrando o status concluído. O total
    // do board vem por items_count, que é o denominador correto de conclusão.
    const { items, pagination } = await this.getAllBoardItems({
      boardId: 7829537690,
      limit: PAGE_LIMIT,
      queryParams: `, query_params: { rules: [{ column_id: "status", compare_value: [${DONE_STATUS_INDEX}], operator: not_any_of }] }`,
      selection: `
        id
        name
        group { title }
        column_values { id text value }
      `
    });

    const countResult = await this.query(`query {
      boards(ids: [7829537690]) { items_count }
    }`);
    const boardItemsCount = Number(countResult.boards?.[0]?.items_count) || items.length;

    const postsByClient = {};
    let totalDelayed = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const statusCounts = {};
    const clientCounts = {};
    const groupCounts = {};
    const priorityCounts = {};
    const formatCounts = {};
    const personIds = new Set();
    let totalItems = 0;
    // Concluídos filtrados na origem: o board inteiro menos o que a query devolveu.
    // Antes isto contava apenas os concluídos que coubessem na página lida.
    let completedItems = Math.max(0, boardItemsCount - items.length);
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

      item.column_values.forEach(c => {
        if (c.id === 'lista_suspensa_mkmqnjbv') cliente = normalizeClientName(c.text);
        if (c.id === 'status') status = c.text || '';
        if (c.id === 'person') {
          responsavel = c.text || '';
          responsavelRefs = parsePeopleColumn(c);
          responsavelRefs.forEach(person => personIds.add(person.id));
        }
        if (c.id === 'multiple_person_mm18b2p0') {
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
      const priority = item.column_values.find(column => column.id === 'color_mm164yv8')?.text || '';
      const format = item.column_values.find(column => column.id === 'lista_suspensa0__1')?.text || '';
      const statusLower = status.toLowerCase();
      const isDone = statusLower.includes('finalizado') || statusLower.includes('publicado') || statusLower.includes('cancelado');
      const isReady = statusLower.includes('agendado') || statusLower.includes('para agendar');

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

        postsByClient[cliente].details.push({
          id: item.id,
          name: item.name,
          quadro: item.group ? item.group.title : 'Sem Quadro',
          status,
          prazo: prazoStr,
          veiculacao: veiculacaoStr,
          responsavel,
          editorDesigner,
          responsavelRefs,
          editorDesignerRefs,
          isDelayedPrazo,
          isDelayedVeiculacao
        });
      }
    });

    const peopleDirectory = await this.getPeopleDirectory([...personIds]);
    Object.values(postsByClient).forEach(clientData => clientData.details.forEach(post => {
      post.responsavelPeople = (post.responsavelRefs?.length ? post.responsavelRefs : fallbackPeople(post.responsavel)).map(person => ({
        ...person,
        ...(peopleDirectory[person.id] || {}),
        name: peopleDirectory[person.id]?.name || person.name || post.responsavel || 'Pessoa não identificada'
      }));
      post.editorDesignerPeople = (post.editorDesignerRefs?.length ? post.editorDesignerRefs : fallbackPeople(post.editorDesigner)).map(person => ({
        ...person,
        ...(peopleDirectory[person.id] || {}),
        name: peopleDirectory[person.id]?.name || person.name || post.editorDesigner || 'Pessoa não identificada'
      }));
    }));

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
        posts: row.posts
      }))
    };

    return {
      ranking,
      activeItems: ranking.flatMap(row => row.details || []),
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
        formatCounts
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
    // Demanda aberta é diferente de demanda atrasada: um cliente com demandas no
    // prazo está sendo atendido, e não pode ser lido como parado só porque nada
    // dele venceu ainda.
    const clientsWithOpenDemand = new Set();
    const today = new Date();

    items.forEach(item => {
      let cliente = '';
      let status = '';
      let prazoStr = '';

      item.column_values.forEach(c => {
        if (c.id === 'lista_suspensa_mkmet5gs') cliente = normalizeClientName(c.text);
        if (c.id === 'status') status = c.text || '';
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

      if (!isDone && status !== '') {
        if (cliente) clientsWithOpenDemand.add(cliente);
        // Mesma régua dos posts: demanda com prazo hoje ainda não está atrasada.
        if (isBeforeToday(prazoStr, today)) {
          delayedDemands.push({
            id: item.id,
            name: item.name,
            quadro: item.group ? item.group.title : 'Sem Quadro',
            cliente,
            status,
            prazo: prazoStr
          });
        }
      }
    });

    // O array continua sendo o retorno principal para não quebrar quem só conta
    // atrasos; a carteira com demanda aberta viaja junto como propriedade.
    delayedDemands.clientsWithOpenDemand = [...clientsWithOpenDemand];
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
    hoje.setHours(0, 0, 0, 0);

    Object.values(clientLogs).forEach(client => {
      // Ordena reuniões da mais recente para a mais antiga
      client.meetings.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Busca a última reunião que já aconteceu (data <= hoje)
      const pastMeetings = client.meetings.filter(m => new Date(m.date) <= hoje);

      if (pastMeetings.length > 0) {
        client.lastMeetingDate = pastMeetings[0].date;
        const lastDate = new Date(client.lastMeetingDate);
        const diffTime = Math.abs(hoje - lastDate);
        client.daysSinceLastMeeting = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
