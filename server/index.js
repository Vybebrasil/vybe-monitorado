// Compatibilidade legada: o runtime oficial do VYBE NEXUS está em api/index.js.
// O deploy da Vercel usa vercel.json -> /api/index.js.
export { default } from '../api/index.js';
