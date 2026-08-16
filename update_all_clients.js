import monday from './server/integrations/monday.js';

async function runBulkUpdate() {
  console.log("Iniciando Bulk Update...");

  const queryItems = `query {
    boards(ids: [7758256536]) {
      items_page(limit: 500) {
        items { 
          id 
          name 
          column_values {
            id
            text
          }
        }
      }
    }
  }`;

  const res = await monday.query(queryItems);
  const items = res.boards[0]?.items_page?.items || [];
  
  console.log(`Total de clientes encontrados: ${items.length}`);

  let updatedCount = 0;

  for (const item of items) {
    let status = '';
    item.column_values.forEach(c => {
      if (c.id === 'status') status = c.text || '';
    });

    if (status.toLowerCase().includes('inativo')) {
      console.log(`Ignorando inativo: ${item.name}`);
      continue;
    }

    console.log(`Atualizando ativo: ${item.name}`);
    
    const mutation = `mutation {
      change_multiple_column_values(
        item_id: ${item.id}, 
        board_id: 7758256536, 
        column_values: "{\\"color_mkzkgn5c\\":{\\"index\\":2},\\"link_mkzdvjjs\\":{\\"url\\":\\"http://#\\", \\"text\\":\\"Fazer planejamento de setembro\\"}}"
      ) {
        id
      }
    }`;

    try {
      await monday.query(mutation);
      updatedCount++;
    } catch (e) {
      console.error(`Erro ao atualizar ${item.name}:`, e.message);
    }
  }

  console.log(`\nBulk Update Concluído! ${updatedCount} clientes atualizados.`);
}

runBulkUpdate();
