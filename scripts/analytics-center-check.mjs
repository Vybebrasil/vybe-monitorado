import { chromium } from 'playwright';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?analytics-check=1';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.jarvis-wake-screen', { state: 'detached', timeout: 30000 });
await page.waitForSelector('.nexus-dashboard-shell', { state: 'visible', timeout: 30000 });
await page.locator('.nexus-sidebar-link').filter({ hasText: /ANALYTICS/i }).first().click();
await page.waitForSelector('.analytics-center', { state: 'visible', timeout: 10000 });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const close = async () => {
  const button = page.locator('button[aria-label="Fechar análise"], button[aria-label="Fechar investigação"], .drawer-close').first();
  if (await button.count()) { await button.click(); await wait(120); }
};
const failures = [];
const kpis = await page.locator('.analytics-kpi').count();
const panels = await page.locator('.analytics-panel').count();
const trendPanel = await page.locator('.analytics-trend-panel').count();
const trendMetrics = await page.locator('.analytics-trend-metrics button').count();
const trendRanges = await page.locator('.analytics-trend-ranges button').count();
const overflow = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
if (kpis !== 6) failures.push(`esperava 6 KPIs, encontrou ${kpis}`);
if (panels !== 6) failures.push(`esperava 6 painéis analíticos incluindo a linha temporal, encontrou ${panels}`);
if (trendPanel !== 1) failures.push(`esperava 1 gráfico de linha, encontrou ${trendPanel}`);
if (trendMetrics !== 8) failures.push(`esperava 8 métricas temporais, encontrou ${trendMetrics}`);
if (trendRanges !== 3) failures.push(`esperava 3 janelas temporais, encontrou ${trendRanges}`);
if (overflow.body > overflow.viewport) failures.push(`overflow horizontal: ${overflow.body} > ${overflow.viewport}`);

const filterSelects = await page.locator('.analytics-filter-control select').count();
if (filterSelects !== 4) failures.push(`esperava 4 filtros cruzados, encontrou ${filterSelects}`);
if (filterSelects) {
  const firstSelect = page.locator('.analytics-filter-control select').first();
  if (await firstSelect.locator('option').count() > 1) {
    await firstSelect.selectOption({ index: 1 });
    if (!(await page.locator('.analytics-filter-clear').count())) failures.push('filtro aplicado sem ação LIMPAR FILTROS');
    await page.locator('.analytics-filter-clear').click();
  }
}

const ownerRows = await page.locator('.analytics-owner-row').count();
if (!ownerRows) failures.push('nenhum responsável no Analytics Center');
if (ownerRows) {
  await page.locator('.analytics-owner-row').first().click();
  await page.waitForSelector('.analytics-drilldown-drawer', { state: 'visible', timeout: 5000 });
  const text = await page.locator('.analytics-drilldown-drawer').innerText();
  if (!text.includes('PERFORMANCE OBSERVÁVEL')) failures.push('drilldown de responsável sem contexto analítico');
  if (text.includes('EVIDÊNCIAS · 27 ITEM')) failures.push('drilldown de responsável caiu em drawer genérico de atrasos');
  await close();
}

for (const selector of ['.analytics-stage-row', '.analytics-status-row']) {
  const count = await page.locator(selector).count();
  if (!count) failures.push(`nenhum elemento para filtro ${selector}`);
  if (count) {
    await page.locator(selector).first().click();
    await page.waitForSelector('.analytics-drilldown-drawer', { state: 'visible', timeout: 5000 });
    const text = await page.locator('.analytics-drilldown-drawer').innerText();
    if (!text.includes('PERFORMANCE OBSERVÁVEL')) failures.push(`filtro ${selector} sem drawer analítico`);
    await close();
  }
}

const report = { pageErrors, kpis, panels, trendPanel, trendMetrics, trendRanges, filterSelects, ownerRows, overflow, failures };
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (pageErrors.length || failures.length) process.exit(1);
console.log('ANALYTICS_CENTER_PASS');
