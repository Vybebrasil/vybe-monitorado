import monday from './server/integrations/monday.js';
async function test() {
  const q = `query {
    boards(ids: [7758256536]) {
      items_page(limit: 100) {
        items { 
          id name group { title } 
          column_values { id text }
        }
      }
    }
  }`;
  const res = await monday.query(q);
  const items = res.boards[0].items_page.items;
  
  const ativos = items.filter(i => i.group && i.group.title === 'Ativos');
  console.log('Total no grupo Ativos:', ativos.length);
  
  ativos.forEach(i => {
    let status = i.column_values.find(c => c.id === 'status')?.text || '';
    let plan = i.column_values.find(c => c.id === 'link_mkzdvjjs')?.text || '';
    console.log(i.name, '| Status:', status, '| Plan:', plan);
  });
}
test();
