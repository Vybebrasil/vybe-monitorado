// Script para descobrir as colunas do board de produção de conteúdo
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getToken() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const tokenLine = envContent.split('\n').find(l => l.startsWith('MONDAY_API_TOKEN='));
    if (tokenLine) return tokenLine.split('=')[1].trim();
  } catch (e) {}
  return process.env.MONDAY_API_TOKEN || '';
}

const token = getToken();

// Pegar apenas 1 item para ver todas as colunas disponíveis
const q = `query {
  boards(ids: [7829537690]) {
    columns {
      id
      title
      type
    }
  }
}`;

const resp = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: token },
  body: JSON.stringify({ query: q })
});

const data = await resp.json();
console.log('COLUNAS DO BOARD DE PRODUÇÃO:');
data.data.boards[0].columns.forEach(c => console.log(`  id: ${c.id} | tipo: ${c.type} | título: ${c.title}`));
