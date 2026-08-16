const fs = require('fs');
let c = fs.readFileSync('server/index.js', 'utf8');
c = c.replace(/join\(\',\\\\n              \'\)/g, "join(',\\n              ')");
fs.writeFileSync('server/index.js', c);
