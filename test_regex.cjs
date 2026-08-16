const fs = require('fs');
let c = fs.readFileSync('src/data/clients.js', 'utf8');
const clientId = 'copirece';
const igStatsRegex = new RegExp(`(id:\\s*["']${clientId}["'][\\s\\S]*?igStats:\\s*)(["'\`][\\s\\S]*?["'\`])`);
console.log(c.match(igStatsRegex) ? 'Matched!' : 'Failed!');
