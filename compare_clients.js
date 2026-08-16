import monday from './server/integrations/monday.js';
import { clients as localClients } from './src/data/clients.js';

async function compareClients() {
  // 1. Get clients from Gestão de Clientes (Ativos)
  const qAtivos = `query {
    boards(ids: [7758256536]) {
      items_page(limit: 500) {
        items { name group { title } }
      }
    }
  }`;
  const resAtivos = await monday.query(qAtivos);
  const gestaoItems = resAtivos.boards[0]?.items_page?.items || [];
  const ativosGestao = gestaoItems
    .filter(i => i.group && i.group.title === 'Ativos')
    .map(i => i.name.trim());

  // 2. Get clients from Produção de Conteúdo
  const qConteudo = `query {
    boards(ids: [7829537690]) {
      items_page(limit: 500) {
        items {
          column_values {
            id
            text
          }
        }
      }
    }
  }`;
  const resConteudo = await monday.query(qConteudo);
  const conteudoItems = resConteudo.boards[0]?.items_page?.items || [];
  
  const clientsComConteudo = new Set();
  conteudoItems.forEach(item => {
    item.column_values.forEach(c => {
      if (c.id === 'lista_suspensa_mkmqnjbv' && c.text) {
        clientsComConteudo.add(c.text.trim());
      }
    });
  });

  // 3. Get clients from src/data/clients.js
  const clientsPainel = localClients.map(c => c.name.trim());

  console.log("=== ANÁLISE DE CLIENTES ===");
  console.log(`\nNo Grupo 'Ativos' (Gestão de Clientes): ${ativosGestao.length}`);
  console.log(`No Painel Antigo (Vercel/clients.js): ${clientsPainel.length}`);
  console.log(`Com Posts no Board de Conteúdo: ${clientsComConteudo.size}`);

  console.log("\n--- FALTANDO NOS 'ATIVOS' MAS ESTÃO NO PAINEL VERCEL ---");
  clientsPainel.forEach(c => {
    if (!ativosGestao.some(a => a.toLowerCase() === c.toLowerCase())) {
      console.log(`- ${c}`);
    }
  });

  console.log("\n--- FALTANDO NOS 'ATIVOS' MAS TEM POSTS CRIADOS NO MONDAY ---");
  Array.from(clientsComConteudo).forEach(c => {
    if (!ativosGestao.some(a => a.toLowerCase() === c.toLowerCase())) {
      console.log(`- ${c}`);
    }
  });

}
compareClients();
