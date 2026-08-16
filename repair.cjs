const fs = require('fs');
let content = fs.readFileSync('server/index.js', 'utf8');
content = content.replace("if (char === '\\\\\\\\') { escapeNext = true; continue; }", "if (char === '\\\\') { escapeNext = true; continue; }");
content = content.replace("return content.substring(0, issuesStartIdx + 9) + '\\\\n' + newIssuesJs + '\\\\n        ' + content.substring(issuesEndIdx);", "return content.substring(0, issuesStartIdx + 9) + '\\n' + newIssuesJs + '\\n        ' + content.substring(issuesEndIdx);");
fs.writeFileSync('server/index.js', content);
