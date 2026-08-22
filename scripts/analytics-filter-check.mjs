import { chromium } from 'playwright';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?analytics=1';
const productionRows = [
  { id: 'p-1', name: 'Texto ativo', client: 'Cliente A', cliente: 'Cliente A', stage: 'Redação', etapa: 'Redação', status: 'Em andamento', responsible: 'Reriston Souza Silva', responsavel: 'Reriston Souza Silva', isCompleted: false, isReady: false, isDelayed: false, source: 'Produção de Conteúdo' },
  { id: 'p-2', name: 'Post pronto', client: 'Cliente A', cliente: 'Cliente A', stage: 'Gestão de publicações', etapa: 'Gestão de publicações', status: 'Para agendar', responsible: 'Reriston Souza Silva', responsavel: 'Reriston Souza Silva', isCompleted: false, isReady: true, isDelayed: false, source: 'Produção de Conteúdo' },
  { id: 'p-3', name: 'Post finalizado', client: 'Cliente A', cliente: 'Cliente A', stage: 'Design & Edição', etapa: 'Design & Edição', status: 'Finalizado', responsible: 'Reriston Souza Silva', responsavel: 'Reriston Souza Silva', isCompleted: true, isReady: false, isDelayed: false, source: 'Produção de Conteúdo' },
  { id: 'p-4', name: 'Post atrasado', client: 'Cliente B', cliente: 'Cliente B', stage: 'Redação', etapa: 'Redação', status: 'A Fazer', responsible: 'Ana Souza', responsavel: 'Ana Souza', isCompleted: false, isReady: false, isDelayed: true, isDelayedPrazo: true, source: 'Produção de Conteúdo' }
];
const demandRows = [
  { id: 'd-1', name: 'Demanda Reriston', client: 'Cliente A', cliente: 'Cliente A', stage: 'Solicitações', etapa: 'Solicitações', status: 'A Fazer', responsible: 'Reriston Souza Silva', responsavel: 'Reriston Souza Silva', isCompleted: false, isDelayed: true, source: 'Solicitações de Demandas' },
  { id: 'd-2', name: 'Demanda Ana', client: 'Cliente B', cliente: 'Cliente B', stage: 'Solicitações', etapa: 'Solicitações', status: 'A Fazer', responsible: 'Ana Souza', responsavel: 'Ana Souza', isCompleted: false, isDelayed: true, source: 'Solicitações de Demandas' }
];
const snapshot = {
  source: 'Fixture determinístico de contrato',
  sourceStatus: 'live',
  sourceQuality: { freshness: 'live', sync: { version: 1, state: 'fresh' } },
  portfolioStability: { score: -26, rawScore: -26, label: 'RISCO EXECUTIVO', scoreDeductions: [] },
  portfolioExecution: { stalled: [], eligibleClients: 2, clientsInExecution: 2, executionCoveragePct: 100 },
  itemRows: productionRows,
  itemRowsComplete: true,
  activeItems: productionRows.filter(item => !item.isCompleted),
  demandItems: demandRows,
  demandItemRows: demandRows,
  demandItemRowsComplete: true,
  delayedDemandItems: demandRows.filter(item => item.isDelayed),
  delayDetails: productionRows.filter(item => item.isDelayed).map(item => ({ ...item, delayType: 'prazo interno', daysOverdue: 2 })),
  clientRanking: [{ client: 'Cliente B', delayedItems: 1, riskPct: 100 }],
  quantitative: { activeItems: 3, completedItems: 1, activePct: 75, overdueInternal: 1, overduePublication: 0, statusCounts: { 'Em andamento': 1, 'Para agendar': 1, 'A Fazer': 1 }, statusColors: {} },
  productivity: { activeItems: 3, completedItems: 1, delayedItems: 1, readyToSchedule: 1, completionPct: 25, delayedPctOfActive: 33.3, byStage: [{ stage: 'Redação', count: 2, pctOfActive: 66.7 }], topResponsibles: [{ name: 'Ana Souza', delayedTotal: 1, posts: 1 }, { name: 'Reriston Souza Silva', delayedTotal: 0, posts: 3 }] },
  summary: { openItems: 3, delayedTeam: 1, delayedDemands: 2, stalledClients: 0, missingPlanning: 0, missingDashboard: 0, executiveRisks: 0, decisionsNeeded: 0 },
  executiveRisks: [],
  decisionsNeeded: [],
  capacitySignals: [],
  portfolioReadiness: { kpis: [] },
  calendarSignals: null
};
const payload = { success: true, metrics: { executiveSnapshot: snapshot }, meta: { sync: { version: 1 }, history: { available: false }, timeSeries: { available: false, points: [], windows: {}, message: 'fixture' }, freshness: 'live' } };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const failures = [];
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
await page.route('**/api/dashboard/metrics**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
await page.route('**/api/executive/operational-mirror**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, ready: true, version: 1, sync: { state: 'fresh', version: 1 } }) }));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.jarvis-wake-screen', { state: 'detached', timeout: 30000 });
const analyticsNav = page.locator('.nexus-sidebar-link, .nexus-mobile-context-nav button').filter({ hasText: /ANALYTICS/i }).first();
if (await analyticsNav.count()) await analyticsNav.click();
await page.waitForSelector('.analytics-center', { state: 'visible', timeout: 10000 });
const readKpis = async () => page.locator('.analytics-kpi strong').allTextContents();
const before = await readKpis();
const ownerSelect = page.locator('.analytics-filter-control select').first();
await ownerSelect.selectOption({ label: 'Reriston Souza Silva' });
await page.waitForTimeout(120);
const after = await readKpis();
if (before.join('|') === after.join('|')) failures.push(`KPIs não mudaram após o filtro: ${before.join('|')}`);
const expected = ['2', '1', '0', '1', '1', 'N/D'];
if (after.join('|') !== expected.join('|')) failures.push(`recorte inesperado: ${after.join('|')} (esperado ${expected.join('|')})`);
  if (!(await page.locator('.analytics-filter-active-badge').count())) failures.push('selo RECORTE ATIVO ausente');

  const ownerRow = page.getByRole('button', { name: /Reriston Souza Silva/ }).first();
  if (!(await ownerRow.count())) {
    failures.push('responsável do fixture não encontrado para testar finalizados');
  } else {
    await ownerRow.click();
    await page.waitForSelector('.analytics-drilldown-drawer', { state: 'visible', timeout: 5000 });
    const drawer = page.locator('.analytics-drilldown-drawer');
    const hiddenText = await drawer.innerText();
    if (hiddenText.includes('Post finalizado')) failures.push('finalizado apareceu antes do comando explícito');
    const toggle = drawer.getByRole('button', { name: /Mostrar finalizados/i });
    if (!(await toggle.count())) failures.push('controle Mostrar finalizados ausente');
    if (await toggle.count()) {
      await toggle.click();
      const shownText = await drawer.innerText();
      if (!shownText.includes('Post finalizado')) failures.push('finalizado não apareceu após Mostrar finalizados');
    }
  }
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.join('; ')}`);
  console.log(JSON.stringify({ before, after, expected, pageErrors, failures }, null, 2));
await browser.close();
if (failures.length) process.exit(1);
console.log('ANALYTICS_FILTER_PASS');
