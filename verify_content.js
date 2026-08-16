import monday from './server/integrations/monday.js';

async function verifyContent() {
  // 1. Get Gestão board items
  const qGestao = `query {
    boards(ids: [7758256536]) {
      items_page(limit: 500) {
        items { name group { title } }
      }
    }
  }`;
  const resGestao = await monday.query(qGestao);
  const gestaoItems = resGestao.boards[0]?.items_page?.items || [];
  
  const statusMap = {};
  gestaoItems.forEach(i => {
    statusMap[i.name.trim()] = i.group?.title || 'Sem Grupo';
  });

  // 2. Get Open Posts from Monday.js
  const postsData = await monday.getOpenPosts();
  const ranking = postsData.ranking;

  console.log("=== RELATÓRIO DE CONTEÚDO vs STATUS ===");

  console.log("\n[CLIENTES ATIVOS NO MONDAY COM CONTEÚDO]");
  ranking.forEach(c => {
    // Normalization mapping idea
    let name = c.name;
    let mappedName = name;
    if (name === 'Brussolo Ristorante') mappedName = 'Restaurante Brussolo';
    if (name === 'Gonzalez Gastronomia') mappedName = 'Gonzalez';
    if (name === 'Serra Grande Bebidas') mappedName = 'Grupo Serra Grande';
    if (name === 'Menina dos Óculos') mappedName = 'Oticas Menina dos Óculos';
    if (name === 'Antonov Center') mappedName = 'Antonov';
    if (name === 'Copirecê Puro Milho') mappedName = 'Copirecê';
    if (name === 'Ace - Associação Comercial') mappedName = 'ACE - Associação Comercial de Irecê (ACE)';

    const group = statusMap[mappedName] || statusMap[name];
    
    if (group === 'Ativos') {
      console.log(`- ${mappedName} (${c.open} posts abertos)`);
    }
  });

  console.log("\n[CLIENTES INATIVOS NO MONDAY **MAS COM CONTEÚDO ABERTO**]");
  ranking.forEach(c => {
    let name = c.name;
    let mappedName = name;
    if (name === 'Brussolo Ristorante') mappedName = 'Restaurante Brussolo';
    if (name === 'Gonzalez Gastronomia') mappedName = 'Gonzalez';
    if (name === 'Serra Grande Bebidas') mappedName = 'Grupo Serra Grande';
    if (name === 'Menina dos Óculos') mappedName = 'Oticas Menina dos Óculos';
    if (name === 'Antonov Center') mappedName = 'Antonov';
    if (name === 'Copirecê Puro Milho') mappedName = 'Copirecê';
    if (name === 'Ace - Associação Comercial') mappedName = 'ACE - Associação Comercial de Irecê (ACE)';

    const group = statusMap[mappedName] || statusMap[name];
    
    if (group && group !== 'Ativos') {
      console.log(`\n> ${mappedName} (Grupo atual: ${group}) -> Tem ${c.open} post(s) aberto(s):`);
      c.details.forEach(p => console.log(`   * "${p.name}" (Status: ${p.status}, Prazo: ${p.prazo || 'Sem prazo'})`));
    }
  });

  console.log("\n[CLIENTES QUE NEM EXISTEM NO BOARD DE GESTÃO **MAS TÊM CONTEÚDO ABERTO**]");
  ranking.forEach(c => {
    let name = c.name;
    let mappedName = name;
    if (name === 'Brussolo Ristorante') mappedName = 'Restaurante Brussolo';
    if (name === 'Gonzalez Gastronomia') mappedName = 'Gonzalez';
    if (name === 'Serra Grande Bebidas') mappedName = 'Grupo Serra Grande';
    if (name === 'Menina dos Óculos') mappedName = 'Oticas Menina dos Óculos';
    if (name === 'Antonov Center') mappedName = 'Antonov';
    if (name === 'Copirecê Puro Milho') mappedName = 'Copirecê';
    if (name === 'Ace - Associação Comercial') mappedName = 'ACE - Associação Comercial de Irecê (ACE)';

    const group = statusMap[mappedName] || statusMap[name];
    
    if (!group) {
      console.log(`\n> ${name} (Não cadastrado na Gestão) -> Tem ${c.open} post(s) aberto(s):`);
      c.details.forEach(p => console.log(`   * "${p.name}" (Status: ${p.status}, Prazo: ${p.prazo || 'Sem prazo'})`));
    }
  });

}

verifyContent();
