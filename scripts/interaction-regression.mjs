import { chromium } from 'playwright';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?interaction-regression=1';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.jarvis-wake-screen', { state: 'detached', timeout: 30000 });
await page.waitForSelector('.app-header', { state: 'visible', timeout: 30000 });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const state = async () => page.evaluate(() => ({
  rootChildren: document.querySelector('#root')?.children.length || 0,
  rootText: (document.querySelector('#root')?.innerText || '').trim().slice(0, 120),
  cockpit: Boolean(document.querySelector('.app-header')),
  drawer: Boolean(document.querySelector('aside, [role="dialog"]')),
}));

const closeDrawer = async () => {
  const close = page.locator('button[aria-label="Fechar investigação"], .drawer-close').first();
  if (await close.count()) {
    await close.click();
    await wait(150);
  }
};

const results = [];
const failures = [];
const runGroup = async (name, selector) => {
  const count = await page.locator(selector).count();
  for (let index = 0; index < count; index += 1) {
    try {
      await page.locator(selector).nth(index).click();
      await wait(220);
      const current = await state();
      const result = { name, index: index + 1, ...current, pageErrors: pageErrors.length };
      results.push(result);
      if (!current.rootChildren || !current.rootText) failures.push({ ...result, reason: 'root vazio após interação' });
      await closeDrawer();
    } catch (error) {
      failures.push({ name, index: index + 1, reason: error.message });
    }
  }
};

await runGroup('kpi', '.executive-kpi-card');
await runGroup('mission', '.mission-card');
await runGroup('ledger', '.score-ledger-row');
await runGroup('owner-open', '.owner-bar-open');
await runGroup('readiness-chip', '.readiness-kpi-chip');

const runContext = async (name, tabPattern, expectedSelector, forbiddenSelector = null) => {
  try {
    await page.locator('.executive-view-tab').filter({ hasText: tabPattern }).first().click();
    await wait(180);
    const contextState = await page.evaluate(({ expected, forbidden }) => ({
      expected: Boolean(document.querySelector(expected)),
      forbidden: forbidden ? Boolean(document.querySelector(forbidden)) : false,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth
    }), { expected: expectedSelector, forbidden: forbiddenSelector });
    const result = { name, ...contextState, pageErrors: pageErrors.length };
    results.push(result);
    if (!contextState.expected || contextState.forbidden || contextState.bodyWidth > contextState.viewportWidth) failures.push({ ...result, reason: 'contexto inesperado, misturado ou com overflow' });
  } catch (error) {
    failures.push({ name, reason: error.message });
  }
};

await runContext('context-summary', /RESUMO EXECUTIVO/i, '.jarvis-decision-briefing', '.executive-module');
await runContext('context-portfolio', /CARTEIRA/i, '.readiness-kpi-band', '.executive-module');
await runContext('context-demands', /DEMANDAS/i, '.demand-module', '.mission-board');
await runContext('context-team', /TIME.*PERFORMANCE/i, '.performance-module', '.demand-module');

try {
  await page.getByRole('button', { name: /SAIR DO JARVIS.*ABRIR ANALISTA/i }).click();
  await wait(400);
  const analyst = await page.evaluate(() => ({
    rootChildren: document.querySelector('#root')?.children.length || 0,
    filterCount: document.querySelectorAll('.analyst-filter-grid select').length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  results.push({ name: 'analyst', ...analyst, pageErrors: pageErrors.length });
  if (!analyst.rootChildren || analyst.filterCount !== 5) failures.push({ name: 'analyst', reason: `estado inesperado: ${JSON.stringify(analyst)}` });
} catch (error) {
  failures.push({ name: 'analyst', reason: error.message });
}

const report = { pageErrors, tested: results.length, failures, results };
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (pageErrors.length || failures.length) process.exit(1);
console.log('INTERACTION_REGRESSION_PASS');
