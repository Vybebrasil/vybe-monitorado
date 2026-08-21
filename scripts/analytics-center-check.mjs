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
const overflow = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
if (kpis !== 6) failures.push(`esperava 6 KPIs, encontrou ${kpis}`);
if (panels !== 5) failures.push(`esperava 5 painéis analíticos, encontrou ${panels}`);
if (overflow.body > overflow.viewport) failures.push(`overflow horizontal: ${overflow.body} > ${overflow.viewport}`);

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

const report = { pageErrors, kpis, panels, ownerRows, overflow, failures };
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (pageErrors.length || failures.length) process.exit(1);
console.log('ANALYTICS_CENTER_PASS');
