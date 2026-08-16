const fs = require('fs');

async function exploreMonday() {
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjY0MTczMzQ1MiwiYWFpIjoxMSwidWlkIjo2ODAzNTUzNywiaWFkIjoiMjAyNi0wNC0wNVQxOTo1MzoxMy4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjYyNzU4MDgsInJnbiI6InVzZTEifQ.y_LPReLbDfSGr7cLvFIygz0P62ute_WuWT0lLwK5reY';
  
  const query = \`query {
    boards (limit: 50) {
      id
      name
      description
      columns {
        title
        type
      }
    }
  }\`;

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
    
    // Save to a file to inspect later if needed
    fs.writeFileSync('monday_boards_dump.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

exploreMonday();
