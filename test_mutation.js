import monday from './server/integrations/monday.js';
async function test() {
  const mutation = `mutation {
    change_multiple_column_values(
      item_id: 7763777217, 
      board_id: 7758256536, 
      column_values: "{\\"color_mkzkgn5c\\":{\\"index\\":2},\\"link_mkzdvjjs\\":{\\"url\\":\\"http://#\\", \\"text\\":\\"Fazer planejamento de setembro\\"}}"
    ) {
      id
    }
  }`;
  const mutRes = await monday.query(mutation);
  console.log("Mutation response:", mutRes);
}
test();
