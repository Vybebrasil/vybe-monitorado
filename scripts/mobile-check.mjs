import { chromium } from 'playwright';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?owner-urgency=mobile';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.jarvis-wake-screen', { state: 'detached', timeout: 30000 });
await page.waitForSelector('.nexus-dashboard-shell', { state: 'visible', timeout: 30000 });
const summaryNav = page.locator('.nexus-mobile-context-nav button').filter({ hasText: /RESUMO/i }).first();
if (await summaryNav.count()) {
  await summaryNav.click();
  await page.waitForTimeout(160);
}

let report = await page.evaluate(() => {
  const body = document.body;
  const rows = [...document.querySelectorAll('.owner-bar-row')].map(row => ({
    name: row.querySelector('.owner-bar-person-name')?.textContent?.trim() || '',
    urgency: row.querySelector('.owner-urgency-chip')?.textContent?.trim() || '',
    className: row.className,
  }));
  const hoverVisible = Boolean(document.querySelector('.owner-bar-hover'));
  const missionCount = document.querySelectorAll('.mission-card').length || document.querySelectorAll('[class*="mission"]').length;
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bodyWidth: body.scrollWidth,
    overflow: body.scrollWidth - window.innerWidth,
    ownerRows: rows,
    hoverVisible,
    missionCount,
    kpiCount: document.querySelectorAll('.command-metric').length,
    commandCenter: Boolean(document.querySelector('.command-center')),
    commandDecisionCount: document.querySelectorAll('.command-decision-card').length,
    nestedInteractive: [...document.querySelectorAll('.owner-bar-row')].filter(row => row.matches('[role="button"]') || row.querySelector('[role="button"]')).length,
    manualRefreshButton: Boolean(document.querySelector('.nexus-topbar-refresh')),
  };
});

await page.locator('.nexus-mobile-context-nav button').filter({ hasText: /CARTEIRA/i }).first().click();
await page.waitForSelector('.owner-bar-row', { state: 'visible', timeout: 30000 });
report = { ...report, ...await page.evaluate(() => ({
  ownerRows: [...document.querySelectorAll('.owner-bar-row')].map(row => ({
    name: row.querySelector('.owner-bar-person-name')?.textContent?.trim() || '',
    urgency: row.querySelector('.owner-urgency-chip')?.textContent?.trim() || '',
    className: row.className,
  })),
  hoverVisible: Boolean(document.querySelector('.owner-bar-hover')),
  nestedInteractive: [...document.querySelectorAll('.owner-bar-row')].filter(row => row.matches('[role="button"]') || row.querySelector('[role="button"]')).length,
  bodyWidth: document.body.scrollWidth,
  viewportWidth: window.innerWidth,
  readinessKpiCount: document.querySelectorAll('.readiness-kpi-chip').length,
})) };

const firstOwner = page.locator('.owner-bar-row').first();
const firstOwnerSelect = firstOwner.locator('.owner-bar-select');
await firstOwnerSelect.focus();
const focusState = await firstOwnerSelect.evaluate(element => ({ active: document.activeElement === element, outlineStyle: getComputedStyle(element).outlineStyle, outlineWidth: getComputedStyle(element).outlineWidth }));
await firstOwnerSelect.tap();
await page.waitForTimeout(250);
const selected = await page.evaluate(() => ({
  selectedOwner: document.querySelector('.owner-bar-row.selected .owner-bar-person-name')?.textContent?.trim() || '',
  popoverTitle: document.querySelector('.owner-bar-hover-title')?.textContent?.trim() || '',
  mondayLinks: document.querySelectorAll('.owner-bar-hover-item[href*="monday.com/boards/7829537690/pulses/"]').length,
    drawerCount: document.querySelectorAll('.investigation-drawer,[role="dialog"]').length,
  }));

await page.locator('.nexus-mobile-context-nav button').filter({ hasText: /RESUMO/i }).first().click();
await page.waitForSelector('.nexus-topbar-refresh', { state: 'visible', timeout: 30000 });
const refreshButton = page.locator('.nexus-topbar-refresh');
await refreshButton.click();
await page.waitForFunction(() => {
  const button = document.querySelector('.nexus-topbar-refresh');
  const error = document.querySelector('.nexus-source-alert');
  return Boolean(error?.textContent?.trim()) || button?.disabled === false;
}, null, { timeout: 30000 });
const refreshState = await page.evaluate(() => ({
  buttonText: document.querySelector('.nexus-topbar-refresh')?.textContent?.trim() || '',
  disabled: document.querySelector('.nexus-topbar-refresh')?.disabled ?? null,
  error: document.querySelector('.nexus-source-alert')?.textContent?.trim() || ''
}));

await page.locator('.nexus-topbar-analyst').click();
await page.waitForTimeout(350);
const analystState = await page.evaluate(() => ({
  filterCount: document.querySelectorAll('.analyst-filter-grid select').length,
  bodyWidth: document.body.scrollWidth,
  viewportWidth: window.innerWidth
}));

const failures = [];
if (report.viewport.width !== 390) failures.push(`viewport width esperado 390, obtido ${report.viewport.width}`);
if (report.bodyWidth !== 390 || report.overflow !== 0) failures.push(`overflow horizontal: bodyWidth=${report.bodyWidth}, viewport=${report.viewport.width}`);
const firstOwnerName = report.ownerRows[0]?.name || '';
if (!firstOwnerName) failures.push('nenhum responsável visível para validar o card mobile');
if (!/\d+D/.test(report.ownerRows[0]?.urgency || '') || !/(critical-max|critical|high|attention|clear)/.test(report.ownerRows[0]?.className || '')) failures.push(`urgência do primeiro card inesperada: ${report.ownerRows[0]?.urgency}`);
if (report.ownerRows.length === 0 || report.ownerRows.length > 5) failures.push(`responsáveis visíveis fora do limite esperado 1–5, obtido ${report.ownerRows.length}`);
  if (!report.commandCenter) failures.push('novo Command Center não encontrado no Resumo');
  if (report.kpiCount !== 5) failures.push(`KPIs compactos do Resumo esperados 5, obtido ${report.kpiCount}`);
  if (report.commandDecisionCount === 0 || report.commandDecisionCount > 3) failures.push(`decisões prioritárias fora do limite 1–3, obtido ${report.commandDecisionCount}`);
if (report.readinessKpiCount !== 5) failures.push(`chips de Prontidão esperados 5, obtido ${report.readinessKpiCount}`);
if (selected.selectedOwner !== firstOwnerName) failures.push(`seleção touch não fixou o primeiro responsável: ${selected.selectedOwner}`);
if (!selected.popoverTitle.includes(firstOwnerName)) failures.push(`popover não identificou o responsável selecionado: ${selected.popoverTitle}`);
if (selected.mondayLinks === 0) failures.push('popover não apresentou links válidos do Monday');
if (selected.drawerCount !== 0) failures.push(`seleção abriu drawer inesperado: ${selected.drawerCount}`);
if (analystState.filterCount !== 5) failures.push(`filtros cruzados esperados 5 no ANALISTA, obtidos ${analystState.filterCount}`);
if (analystState.bodyWidth !== analystState.viewportWidth) failures.push(`overflow no ANALISTA: bodyWidth=${analystState.bodyWidth}, viewport=${analystState.viewportWidth}`);
  if (report.nestedInteractive !== 0) failures.push(`cards de responsáveis ainda possuem interação aninhada: ${report.nestedInteractive}`);
  if (!report.manualRefreshButton) failures.push('botão ATUALIZAR da topbar não encontrado');
  if (refreshState.disabled) failures.push('botão ATUALIZAR DADOS permaneceu bloqueado após a leitura');
  if (refreshState.error) failures.push(`refresh apresentou erro: ${refreshState.error}`);
  if (!focusState.active) failures.push(`seletor de responsável não recebeu foco: ${JSON.stringify(focusState)}`);

  console.log(JSON.stringify({ ...report, afterTap: selected, analystState, refreshState }, null, 2));

  await browser.close();
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}
console.log('MOBILE_CHECK_PASS');
