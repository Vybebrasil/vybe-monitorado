import { chromium } from 'playwright';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?functional-completeness=1';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const failures = [];
const results = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.jarvis-wake-screen', { state: 'detached', timeout: 30000 });
await page.waitForSelector('.nexus-dashboard-shell', { state: 'visible', timeout: 30000 });

async function check(name, selector, expectedText = null) {
  const node = page.locator(selector).first();
  const found = await node.count() > 0;
  const text = found ? (await node.innerText()).slice(0, 180) : '';
  const matches = expectedText ? text.toLowerCase().includes(expectedText.toLowerCase()) : found;
  const result = { name, found, text, matches, pageErrors: pageErrors.length };
  results.push(result);
  if (!found || !matches) failures.push({ ...result, reason: `seletor/texto não encontrado: ${selector} / ${expectedText || ''}` });
  return result;
}

await page.getByRole('button', { name: /Carteira capacidade/i }).click();
await wait(160);
await check('operations-explorer', '.executive-operations-explorer', 'Produção de Conteúdo');
await check('source-reconciliation', '.executive-source-reconciliation', 'Produção');
await check('operations-search', '.operations-explorer-search input');

const clientButton = page.getByRole('button', { name: /Abrir cliente/i }).first();
if (await clientButton.count()) {
  await clientButton.click();
  await wait(150);
  await check('entity-profile-drawer', '.entity-profile-drawer', 'Perfil');
  const close = page.locator('.drawer-close, button[aria-label*="Fechar"]').first();
  if (await close.count()) await close.click();
}

await page.getByRole('button', { name: /Analytics volume/i }).click();
await wait(160);
await check('analytics-center', '.analytics-center', 'Analytics');
const ownerSelect = page.locator('.analytics-filter-control select').first();
if (await ownerSelect.count() && await ownerSelect.locator('option').count() > 1) {
  await ownerSelect.selectOption({ index: 1 });
  await wait(150);
  await check('scope-comparison', '.analytics-scope-comparison', 'Recorte versus agência');
}

await page.getByRole('button', { name: /História evolução/i }).click();
await wait(160);
await check('decision-loop', '.executive-decision-loop', 'Decisão');
await check('history-cycle', '.history-cycle-panel', 'Ciclo de correção');

await page.getByRole('button', { name: /Demandas solicitações/i }).click();
await wait(160);
await check('demand-panel', '.demand-module', 'Solicitações de Demandas');
const demandText = await page.locator('.demand-module').innerText();
const demandStateClear = demandText.includes('N/D') || demandText.includes('itens ativos no board');
results.push({ name: 'demand-source-state', found: true, matches: demandStateClear, text: demandText.slice(0, 220), pageErrors: pageErrors.length });
if (!demandStateClear) failures.push({ name: 'demand-source-state', reason: 'Demandas não explicita N/D ou coorte observada.' });

const report = { pageErrors, failures, results };
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (pageErrors.length || failures.length) process.exit(1);
console.log('FUNCTIONAL_COMPLETENESS_PASS');
