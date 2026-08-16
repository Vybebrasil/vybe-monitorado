import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query: graphqlQuery })
    });

    const data = await response.json();
    if (data.errors) {
      console.error("Monday GraphQL Error:", JSON.stringify(data.errors, null, 2));
      throw new Error("Erro na query do Monday");
    }
    return data.data;
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
    // Columns: lista_suspensa_mkmqnjbv (Cliente), status (Status), data (Data Prevista)
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

      item.column_values.forEach(c => {
        if (c.id === 'lista_suspensa_mkmqnjbv') cliente = normalizeClientName(c.text);
        if (c.id === 'status') status = c.text || '';
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

    return { ranking, totalDelayed };
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
}

export default new MondayIntegration();
