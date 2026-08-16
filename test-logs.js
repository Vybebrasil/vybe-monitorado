import fetch from 'node-fetch';

fetch('http://localhost:3001/api/dashboard/clients-logs')
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(e => console.error(e));
