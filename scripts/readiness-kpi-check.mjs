import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?readiness-kpis=fixture';
const fixture = JSON.parse(readFileSync('/tmp/vybe-metrics-fixture.json', 'utf8'));
fixture.metrics.executiveSnapshot.portfolioReadiness.kpis = {
  eligibleClients: 4,
  planning: { withCount: 2, withoutCount: 2, withClients: ['Cliente A', 'Cliente B'], withoutClients: ['Cliente C', 'Cliente D'], coveragePct: 50, source: 'Monday.com · Gestão de Clientes · Planejamento' },
  meetingsCurrentMonth: { month: '2026-08', withCount: 2, withoutCount: 2, withClients: ['Cliente A', 'Cliente C'], withoutClients: ['Cliente B', 'Cliente D'], coveragePct: 50, source: 'Monday.com · Reuniões · data' },
  onboarding: { withCount: 1, withoutCount: 3, withClients: ['Cliente D'], withoutClients: ['Cliente A', 'Cliente B', 'Cliente C'], windowDays: 30, source: 'Monday.com · created_at + ausência de execução' },
  agendaNext30Days: { mapped: true, withCount: 2, withoutCount: 2, withClients: ['Cliente B', 'Cliente D'], withoutClients: ['Cliente A', 'Cliente C'], coveragePct: 50, period: '2026-08-18 → 2026-09-17', source: 'Google Calendar · iCal · próximos 30 dias' },
  calendar3Months: { mapped: false, columnIds: [], completeCount: null, missingCount: null, completeClients: null, missingClients: null, coveragePct: null, message: 'Mapeie três IDs de colunas mensais.' }
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/dashboard/metrics**', async route => { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }); });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.jarvis-wake-screen', { state: 'detached', timeout: 30000 });
await page.waitForSelector('.nexus-dashboard-shell', { state: 'visible', timeout: 30000 });
await page.locator('.nexus-sidebar-link').filter({ hasText: /CARTEIRA/i }).first().click();
await page.waitForSelector('.readiness-kpi-band', { state: 'visible', timeout: 30000 });
await page.waitForSelector('.readiness-kpi-chip, .readiness-kpi-grid .executive-kpi-card', { state: 'visible', timeout: 30000 });

const ids = [
  ['PLANEJAMENTO', 'Quais clientes têm ou não têm planejamento?', '2'],
  ['REUNIÕES NO MÊS ATUAL', 'Quais clientes tiveram reunião no mês atual?', '2'],
  ['AGENDA · PRÓXIMOS 30 DIAS', 'Quais clientes têm reunião na Agenda nos próximos 30 dias?', '2'],
  ['FASE DE ENTRADA', 'Quais clientes estão em fase de entrada?', '1'],
  ['CALENDÁRIO · 3 MESES', 'Quais clientes têm três meses de calendário?', 'N/D']
];
const results = [];
for (const [label, title, expectedWith] of ids) {
  const card = page.locator('.readiness-kpi-chip, .readiness-kpi-grid .executive-kpi-card').filter({ hasText: label }).first();
  if (!(await card.count())) throw new Error(`KPI não encontrado: ${label}`);
  await card.click();
  await page.waitForSelector('.kpi-investigation-drawer .investigation-hero h4', { state: 'visible', timeout: 10000 });
  const drawerTitle = await page.locator('.kpi-investigation-drawer .investigation-hero h4').textContent();
  const withValue = await page.locator('.kpi-investigation-drawer .kpi-score-explanation > div').first().locator('strong').textContent();
  const source = await page.locator('.kpi-investigation-drawer .readiness-quality-callout strong').first().textContent();
  const qualityLocator = page.locator('.kpi-investigation-drawer .investigation-callout p').first();
  const qualityMessage = await qualityLocator.count() ? await qualityLocator.textContent() : '';
  results.push({ label, drawerTitle: drawerTitle?.trim(), withValue: withValue?.trim(), source: source?.trim(), qualityMessage: qualityMessage?.trim() });
  await page.locator('.kpi-investigation-drawer .drawer-close').click();
  await page.waitForSelector('.kpi-investigation-drawer', { state: 'hidden', timeout: 5000 });
}
const failures = [];
for (const [label, title, expectedWith] of ids) {
  const result = results.find(item => item.label === label);
  if (!result.drawerTitle?.includes(title)) failures.push(`${label}: drawer incorreto`);
  if (result.withValue !== expectedWith) failures.push(`${label}: valor esperado ${expectedWith}, obtido ${result.withValue}`);
  if (label === 'CALENDÁRIO · 3 MESES' && !result.qualityMessage?.includes('Mapeie')) failures.push('calendário sem mensagem de fonte não mapeada');
}
if (errors.length) failures.push(`pageerrors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ results, failures }, null, 2));
await browser.close();
if (failures.length) process.exit(1);
console.log('READINESS_KPI_PASS');
