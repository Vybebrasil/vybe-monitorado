import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?a11y-focus=1';
const fixture = JSON.parse(readFileSync('/tmp/vybe-metrics-fixture.json', 'utf8'));
const panelFixture = {
  items: [{ id: '101', name: 'Item do Painel', group: { title: 'Produção' }, status: { label: 'A Fazer' } }],
  pagination: { count: 1, pages: 1, complete: true, truncated: false, nextCursor: null },
  cache: { hit: false, stale: false, pending: false },
  warning: null
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/dashboard/metrics**', async route => { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }); });
await page.route('**/api/executive/vybe-panel**', async route => { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(panelFixture) }); });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.jarvis-wake-screen', { state: 'detached', timeout: 30000 });
await page.waitForSelector('.app-header', { state: 'visible', timeout: 30000 });

const focusReport = async (selector, label) => {
  const control = page.locator(selector).first();
  if (!(await control.count())) return { label, found: false, visible: false };
  const targetIndex = await control.evaluate(element => {
    const focusables = Array.from(document.querySelectorAll('button, a, select, input, textarea, [tabindex]:not([tabindex="-1"])')).filter(item => item.getClientRects().length > 0 && !item.hasAttribute('disabled'));
    const index = focusables.indexOf(element);
    if (index > 0) focusables[index - 1].focus();
    return index;
  });
  if (targetIndex > 0) await page.keyboard.press('Tab');
  else await control.focus();
  return await control.evaluate((element, name) => {
    const style = window.getComputedStyle(element);
    return {
      label: name,
      found: true,
      visible: element.getClientRects().length > 0,
      active: document.activeElement === element,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      hasVisibleOutline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && style.outlineColor !== 'rgba(0, 0, 0, 0)'
    };
  }, label);
};

const results = [];
await page.locator('.executive-view-tab').filter({ hasText: /CARTEIRA/i }).first().click();
await page.waitForSelector('.readiness-kpi-toggle, .readiness-kpi-chip', { state: 'visible', timeout: 30000 });
results.push(await focusReport('.readiness-kpi-toggle', 'readiness-kpi-toggle'));
results.push(await focusReport('.readiness-kpi-chip', 'readiness-kpi-chip'));
await page.getByRole('button', { name: /SAIR DO JARVIS.*ABRIR ANALISTA/i }).click();
await page.waitForSelector('.analyst-panel-refresh', { state: 'visible', timeout: 30000 });
results.push(await focusReport('.analyst-panel-refresh', 'analyst-panel-refresh'));

const failures = results.filter(result => !result.found || !result.visible || !result.active || !result.hasVisibleOutline);
if (errors.length) failures.push({ label: 'pageerrors', errors });
console.log(JSON.stringify({ results, failures }, null, 2));
await browser.close();
if (failures.length) process.exit(1);
console.log('ACCESSIBILITY_FOCUS_PASS');
