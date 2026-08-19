const baseUrl = (process.argv[2] || process.env.NEXUS_DEPLOYMENT_URL || '').replace(/\/$/, '');
const expectedRepository = process.env.NEXUS_EXPECTED_GIT_REPOSITORY || 'Vybebrasil/vybe-monitorado';
const requireHistory = process.argv.includes('--require-history') || process.env.NEXUS_RELEASE_REQUIRE_HISTORY === 'true';

if (!baseUrl) {
  console.error('Uso: npm run verify:release -- https://seu-deploy.vercel.app');
  process.exit(2);
}

const healthUrl = `${baseUrl}/api/healthz?probe=true`;
let healthResponse;
try {
  healthResponse = await fetch(healthUrl, { headers: { accept: 'application/json' } });
} catch (error) {
  console.error(`[RELEASE] Falha ao consultar ${healthUrl}: ${error.message}`);
  process.exit(1);
}

let health;
try {
  health = await healthResponse.json();
} catch {
  console.error(`[RELEASE] O endpoint respondeu HTTP ${healthResponse.status} sem JSON.`);
  process.exit(1);
}

if (!healthResponse.ok || health.ok !== true) {
  console.error(`[RELEASE] healthz inválido: HTTP ${healthResponse.status}.`);
  process.exit(1);
}

const release = health.release || {};
const commit = release.commit || health.commit;
const repository = release.repository;
if (!/^[a-f0-9]{40}$/i.test(commit || '')) {
  console.error(`[RELEASE] SHA não rastreável no deploy: ${commit || 'ausente'}`);
  process.exit(1);
}
if (!repository || repository.toLowerCase() !== expectedRepository.toLowerCase()) {
  console.error(`[RELEASE] Repositório inesperado: ${repository || 'ausente'}; esperado ${expectedRepository}.`);
  process.exit(1);
}

let commitResponse;
try {
  commitResponse = await fetch(`https://api.github.com/repos/${repository}/commits/${commit}`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'vybe-nexus-release-check' }
  });
} catch (error) {
  console.error(`[RELEASE] Falha ao consultar o GitHub: ${error.message}`);
  process.exit(1);
}

if (!commitResponse.ok) {
  console.error(`[RELEASE] SHA ${commit} não encontrado em ${repository} (HTTP ${commitResponse.status}).`);
  process.exit(1);
}

const persistence = health.persistence || {};
const persistenceReady = Object.values(persistence).every(store => store.ready);
const liveReadReady = health.readiness?.liveReadReady === true || health.ready === true;
const historicalReady = health.readiness?.historicalReady === true && persistenceReady;
console.log(JSON.stringify({
  ok: true,
  healthUrl,
  commit,
  repository,
  branch: release.branch || null,
  deploymentId: release.deploymentId || null,
  ready: health.ready === true,
  liveReadReady,
  historicalReady,
  persistenceReady,
  historyRequired: requireHistory
}, null, 2));

if (!liveReadReady || (requireHistory && !historicalReady)) process.exitCode = 1;
