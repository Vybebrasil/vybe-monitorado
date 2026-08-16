const fs = require('fs');
const content = fs.readFileSync('src/data/clients.js', 'utf8');

function replaceFirstChannelIssues(content, clientId, newIssuesJs) {
  const idMatch = new RegExp(`id:\\s*["']${clientId}["']`).exec(content);
  if (!idMatch) return content;
  const clientStartIdx = idMatch.index;
  
  const channelsStartIdx = content.indexOf(`channels: [`, clientStartIdx);
  if (channelsStartIdx === -1) return content;
  
  const issuesStartIdx = content.indexOf(`issues: [`, channelsStartIdx);
  if (issuesStartIdx === -1) return content;
  
  let bracketCount = 0;
  let issuesEndIdx = -1;
  let inString = false;
  let stringChar = null;
  let escapeNext = false;
  
  for (let i = issuesStartIdx + 8; i < content.length; i++) {
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
  
  if (issuesEndIdx !== -1) {
    return content.substring(0, issuesStartIdx + 9) + '\\n' + newIssuesJs + '\\n        ' + content.substring(issuesEndIdx);
  }
  
  return content;
}

const res = replaceFirstChannelIssues(content, 'copirece', 'NEW_ISSUES');
console.log('Result length:', res.length);
console.log('Original length:', content.length);
fs.writeFileSync('test_output.js', res);
