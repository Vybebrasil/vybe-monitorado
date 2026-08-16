import mondayIntegration from './api/integrations/monday.js';
import { getFutureMeetings } from './api/integrations/calendar.js';

async function test() {
  const logs = await mondayIntegration.getClientLogs();
  const future = await getFutureMeetings();
  
  logs.forEach(client => {
    const clientNameLower = client.name.toLowerCase();
    client.futureMeetings = future.filter(m => m.title.toLowerCase().includes(clientNameLower));
  });

  console.log(JSON.stringify(logs, null, 2));
}

test();
