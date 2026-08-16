import monday from './server/integrations/monday.js';

async function createMissingClients() {
  const clientsToCreate = ['João Bacelar', 'Academia Lions'];
  const boardId = 7758256536;
  const groupId = "topics"; // "Ativos" group ID

  // Status "Ativo" is index 1. Dashboard "Desatualizado" is index 2.
  const columnValues = JSON.stringify({
    "status": { "index": 1 },
    "color_mkzkgn5c": { "index": 2 },
    "link_mkzdvjjs": { "url": "http://#", "text": "Fazer planejamento de setembro" }
  });

  for (const clientName of clientsToCreate) {
    console.log(`Criando cliente: ${clientName}`);
    
    // GraphQL variables are better, but we can interpolate safely here since there are no quotes in the names
    const mutation = `mutation {
      create_item (
        board_id: ${boardId}, 
        group_id: "${groupId}", 
        item_name: "${clientName}",
        column_values: ${JSON.stringify(columnValues)}
      ) {
        id
      }
    }`;

    try {
      const res = await monday.query(mutation);
      console.log(`Sucesso! ID: ${res.create_item.id}`);
    } catch(e) {
      console.error(`Erro ao criar ${clientName}:`, e.message);
    }
  }
}

createMissingClients();
