const fs = require('fs');
const content = fs.readFileSync('src/data/clients.js', 'utf8');

const idMatch = new RegExp(`id:\\s*['"]copirece['"]`).exec(content);
const clientStartIdx = idMatch.index;
const channelsStartIdx = content.indexOf(`channels: [`, clientStartIdx);
const issuesStartIdx = content.indexOf(`issues: [`, channelsStartIdx);

let bracketCount = 1;
let issuesEndIdx = -1;
let inString = false;
let stringChar = null;
let escapeNext = false;

for (let i = issuesStartIdx + 9; i < content.length; i++) {
  const char = content[i];
  if (escapeNext) { escapeNext = false; continue; }
  if (char === '\\\\') { escapeNext = true; continue; }
  if (inString) {
    if (char === stringChar) inString = false;
    continue;
  }
  if (char === '"' || char === "'" || char === '\\`') {
    inString = true;
    stringChar = char;
    continue;
  }
  
  if (char === '[') bracketCount++;
  if (char === ']') {
    bracketCount--;
    if (bracketCount === 0) {
      issuesEndIdx = i;
      break;
    }
  }
}

console.log('Stopped at index:', issuesEndIdx);
console.log('10 chars around stop:', content.substring(issuesEndIdx - 10, issuesEndIdx + 10));
