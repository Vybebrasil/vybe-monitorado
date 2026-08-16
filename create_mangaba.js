import monday from './server/integrations/monday.js';

async function createMangaba() {
  const clientsToCreate = ['Mangaba AI'];
  const boardId = 7758256536;
  const groupId = "topics"; // "Ativos" group ID

  const columnValues = JSON.stringify({
    "status": { "index": 1 },
    "color_mkzkgn5c": { "index": 2 },
    "link_mkzdvjjs": { "url": "http://#", "text": "Fazer planejamento de setembro" }
  });

  for (const clientName of clientsToCreate) {
    console.log(`Criando cliente: ${clientName}`);
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

createMangaba();
