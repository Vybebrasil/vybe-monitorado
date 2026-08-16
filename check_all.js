import monday from './server/integrations/monday.js';
async function test() {
  const q = `query {
    boards(ids: [7758256536]) {
      items_page(limit: 500) {
        items { id name group { title id } }
      }
    }
  }`;
  const res = await monday.query(q);
  const items = res.boards[0].items_page.items;
  console.log('All items in Gestao:');
  items.forEach(i => console.log(i.name, '| Group:', i.group?.title, '| GroupID:', i.group?.id));
}
test();
