import m from './api/integrations/monday.js';

m.query(`query { boards(ids: [9918871233]) { items_page(limit: 5) { items { name column_values { id text value } } } } }`).then(res => console.log(JSON.stringify(res, null, 2))).catch(e => console.error(e));
