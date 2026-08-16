import monday from './server/integrations/monday.js';
async function test() {
  const q = `query {
    boards(ids: [7829537690]) {
      columns { id title type }
    }
  }`;
  const res = await monday.query(q);
  console.log(res.boards[0].columns);
}
test();
