const fs = require('fs');
const content = fs.readFileSync('src/data/clients.js', 'utf8');

const idMatch = new RegExp(`id:\\s*['"]copirece['"]`).exec(content);
const clientStartIdx = idMatch.index;
const channelsStartIdx = content.indexOf(`channels: [`, clientStartIdx);
const issuesStartIdx = content.indexOf(`issues: [`, channelsStartIdx);

console.log('Substring at +9:', content.substring(issuesStartIdx, issuesStartIdx + 15));
