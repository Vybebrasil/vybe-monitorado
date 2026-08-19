import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?status-investigation=fixture';
const fixture = JSON.parse(readFileSync('/tmp/vybe-metrics-fixture.json', 'utf8'));
const snapshot = fixture.metrics.executiveSnapshot;
const statusCounts = snapshot.quantitative.statusCounts || {};
let itemIndex = 0;
snapshot.activeItems = Object.entries(statusCounts).flatMap(([status, count]) => Array.from({ length: Number(count) }, (_, index) => ({
  id: `fixture-${itemIndex++}`,
  name: `${status} · item ${index + 1}`,
  status,
  client: `Cliente fixture ${index + 1}`,
  stage: 'Produção',
  prazo: '2026-08-30',
  veiculacao: '2026-09-10',
  responsavel: 'Responsável fixture',
  responsavelPeople: []
})));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/dashboard/metrics**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);

const activeKpi = page.locator('.executive-kpi-card').filter({ hasText: /ITENS ATIVOS/i }).first();
await activeKpi.click();
await page.waitForTimeout(250);

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
const results = {};
for (const [statusIndex, status] of ['Aguardo', 'Em andamento'].entries()) {
  if (statusIndex > 0) {
    await page.getByRole('button', { name: 'Fechar investigação' }).click();
    await page.waitForTimeout(150);
    await activeKpi.click();
    await page.waitForTimeout(200);
  }
  const expected = Number(statusCounts[status] || 0);
  const button = page.getByRole('button', { name: new RegExp(escapeRegExp(status) + '.*ABRIR', 'i') }).first();
  if (!(await button.count())) throw new Error(`Status não encontrado: ${status}`);
  await button.click();
  await page.waitForTimeout(200);
  const visibleBeforeExpand = await page.locator('.kpi-status-item-card').count();
  const more = page.locator('.investigation-drawer .list-expand').first();
  if (expected > 5 && await more.count()) {
    await more.click();
    await page.waitForTimeout(100);
  }
  const visibleAfterExpand = await page.locator('.kpi-status-item-card').count();
  const statusHeader = await page.locator('.kpi-investigation-section-title').filter({ hasText: 'ITENS COM STATUS' }).textContent();
  const mondayLinks = await page.locator('.kpi-status-item-card a[href*="monday.com/boards/7829537690/pulses/"]').count();
  results[status] = { expected, visibleBeforeExpand, visibleAfterExpand, statusHeader: statusHeader?.trim() || '', mondayLinks };
}

const failures = [];
for (const [status, result] of Object.entries(results)) {
  if (result.expected !== result.visibleAfterExpand) failures.push(`${status}: esperados ${result.expected}, exibidos ${result.visibleAfterExpand}`);
  if (result.mondayLinks !== result.visibleAfterExpand) failures.push(`${status}: links Monday ${result.mondayLinks}/${result.visibleAfterExpand}`);
}
if (errors.length) failures.push(`pageerrors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ statusCounts, results, failures }, null, 2));
await browser.close();
if (failures.length) process.exit(1);
console.log('STATUS_INVESTIGATION_PASS');
