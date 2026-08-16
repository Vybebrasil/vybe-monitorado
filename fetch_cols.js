import monday from './server/integrations/monday.js';
async function test() {
  const q = `query {
    boards(ids: [7758256536]) {
      columns { id title type settings_str }
    }
  }`;
  const res = await monday.query(q);
  console.log(JSON.stringify(res.boards[0].columns, null, 2));
}
test();
