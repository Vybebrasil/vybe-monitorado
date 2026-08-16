import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { clients as activeClients } from '../../src/data/clients.js';

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

class MondayIntegration {
  constructor() {
    this.apiUrl = 'https://api.monday.com/v2';
  }

  getToken() {
    try {
      const envPath = join(__dirname, '..', '..', '.env');
      const envContent = readFileSync(envPath, 'utf8');
      const tokenLine = envContent.split('\n').find(l => l.startsWith('MONDAY_API_TOKEN='));
      if (tokenLine) return tokenLine.split('=')[1].trim();
    } catch (e) {
      console.warn("Could not read MONDAY_API_TOKEN from .env");
    }
    return process.env.MONDAY_API_TOKEN || '';
  }

  async query(graphqlQuery) {
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
        body: JSON.stringify({ query: graphqlQuery }),
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

  // 1. Clientes sem planejamento ou com dashboard atrasado
  async getClientBottlenecks() {
    // Board: 7758256536 (Gestão de Clientes)
    // Columns: link_mkzdvjjs (Planejamento), color_mkzkgn5c (Dashboard), status (Status)
    const q = `query {
      boards(ids: [7758256536]) {
        items_page(limit: 100) {
          items {
            name
            column_values {
              id
              text
            }
          }
        }
      }
    }`;

    const result = await this.query(q);
    const items = result.boards[0]?.items_page?.items || [];

    const missingPlanning = [];
    const missingDashboard = [];

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
        // Planejamento: se estiver vazio ou se tiver o texto padrão de "Fazer planejamento"
        if (!planejamento || planejamento.toLowerCase().includes('fazer planejamento')) {
          missingPlanning.push(item.name);
        }
        
        // Dashboard status: "Atrasado", "Pendente", "Dasatualizado", "Desatualizado", ou vazio
        const dbLower = dashboard.toLowerCase();
        if (dbLower.includes('atrasado') || dbLower.includes('pendente') || dbLower.includes('desatualizado') || dbLower.includes('dasatualizado') || dbLower === '') {
           missingDashboard.push(item.name);
        }
      }
    });

    return { missingPlanning, missingDashboard };
  }

  // 2. Posts Atrasados / Acumulados
  async getOpenPosts() {
    // Board: 7829537690 (Produção de Conteúdo)
    const q = `query {
      boards(ids: [7829537690]) {
        items_page(limit: 500) {
          items {
            id
            name
            group {
              title
            }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }`;

    const result = await this.query(q);
    const items = result.boards[0]?.items_page?.items || [];

    const postsByClient = {};
    let totalDelayed = 0;

    items.forEach(item => {
      let cliente = 'Sem Cliente';
      let status = '';
      let prazoStr = '';
      let veiculacaoStr = '';
      let responsavel = '';
      let editorDesigner = '';

      item.column_values.forEach(c => {
        if (c.id === 'lista_suspensa_mkmqnjbv') cliente = normalizeClientName(c.text);
        if (c.id === 'status') status = c.text || '';
        if (c.id === 'person') responsavel = c.text || '';
        if (c.id === 'multiple_person_mm18b2p0') editorDesigner = c.text || '';
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

      // Ignora finalizados/cancelados
      const isDone = status.toLowerCase().includes('finalizado') || status.toLowerCase().includes('publicado') || status.toLowerCase().includes('cancelado');
      
      if (!isDone && status !== '') {
        if (!postsByClient[cliente]) {
          postsByClient[cliente] = { open: 0, delayedPrazo: 0, delayedVeiculacao: 0, details: [] };
        }
        postsByClient[cliente].open += 1;

        let isDelayedPrazo = false;
        let isDelayedVeiculacao = false;
        
        const hoje = new Date();
        hoje.setHours(0,0,0,0);

        // REGRA: status "Agendado" ou "Para Agendar" = conteúdo pronto, NÃO é atraso
        const statusLower = status.toLowerCase();
        const isReady = statusLower.includes('agendado') || statusLower.includes('para agendar');

        if (!isReady) {
          if (prazoStr) {
            const prazoDate = new Date(prazoStr);
            if (prazoDate < hoje) {
              postsByClient[cliente].delayedPrazo += 1;
              isDelayedPrazo = true;
            }
          }

          if (veiculacaoStr) {
            const veicDate = new Date(veiculacaoStr);
            if (veicDate < hoje) {
              postsByClient[cliente].delayedVeiculacao += 1;
              isDelayedVeiculacao = true;
            }
          }
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
          isDelayedPrazo,
          isDelayedVeiculacao
        });
      }
    });

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

    return { ranking, totalDelayed, responsavelRanking };
  }

  // 3. Demandas Travadas / Atrasadas
  async getDelayedDemands() {
    // Board: 8385559107 (Solicitações de Demandas)
    // Columns: lista_suspensa_mkmet5gs (Cliente), status (Status), data (Prazo)
    const q = `query {
      boards(ids: [8385559107]) {
        items_page(limit: 500) {
          items {
            id
            name
            group {
              title
            }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }`;

    const result = await this.query(q);
    const items = result.boards[0]?.items_page?.items || [];

    const delayedDemands = [];

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
      
      if (!isDone && status !== '' && prazoStr) {
        const prazoDate = new Date(prazoStr);
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        if (prazoDate < hoje) {
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

    return delayedDemands;
  }

  // 4. Client Logs (Histórico de Reuniões)
  async getClientLogs() {
    // Board: 9918871233 (Reuniões)
    const q = `query {
      boards(ids: [9918871233]) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }`;

    const result = await this.query(q);
    const items = result.boards[0]?.items_page?.items || [];
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

    return sortedLogs;
  }
}

export default new MondayIntegration();
