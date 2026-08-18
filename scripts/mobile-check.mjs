import { chromium } from 'playwright';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?owner-urgency=mobile';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);

const report = await page.evaluate(() => {
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
    kpiCount: document.querySelectorAll('.executive-kpi-card').length,
  };
});

const firstOwner = page.locator('.owner-bar-row').first();
await firstOwner.tap();
await page.waitForTimeout(250);
const selected = await page.evaluate(() => ({
  selectedOwner: document.querySelector('.owner-bar-row.selected .owner-bar-person-name')?.textContent?.trim() || '',
  popoverTitle: document.querySelector('.owner-bar-hover-title')?.textContent?.trim() || '',
  mondayLinks: document.querySelectorAll('.owner-bar-hover-item[href*="monday.com/boards/7829537690/pulses/"]').length,
  drawerCount: document.querySelectorAll('.investigation-drawer,[role="dialog"]').length,
}));

console.log(JSON.stringify({ ...report, afterTap: selected }, null, 2));

const failures = [];
if (report.viewport.width !== 390) failures.push(`viewport width esperado 390, obtido ${report.viewport.width}`);
if (report.bodyWidth !== 390 || report.overflow !== 0) failures.push(`overflow horizontal: bodyWidth=${report.bodyWidth}, viewport=${report.viewport.width}`);
if (report.ownerRows[0]?.name !== 'Deivid Oliveira Ribeiro') failures.push(`primeiro responsável inesperado: ${report.ownerRows[0]?.name}`);
if (!report.ownerRows[0]?.urgency.includes('19D') || !report.ownerRows[0]?.urgency.includes('CRÍTICO MÁXIMO')) failures.push(`urgência do primeiro card inesperada: ${report.ownerRows[0]?.urgency}`);
if (report.ownerRows.length !== 5) failures.push(`responsáveis visíveis esperado 5, obtido ${report.ownerRows.length}`);
if (report.kpiCount !== 6) failures.push(`KPIs esperados 6, obtidos ${report.kpiCount}`);
if (selected.selectedOwner !== 'Deivid Oliveira Ribeiro') failures.push(`seleção touch não fixou Deivid: ${selected.selectedOwner}`);
if (!selected.popoverTitle.includes('2 DEMANDAS EM RISCO')) failures.push(`popover esperado com 2 demandas, obtido: ${selected.popoverTitle}`);
if (selected.mondayLinks !== 2) failures.push(`links Monday esperados 2, obtidos ${selected.mondayLinks}`);
if (selected.drawerCount !== 0) failures.push(`seleção abriu drawer inesperado: ${selected.drawerCount}`);

await browser.close();
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}
console.log('MOBILE_CHECK_PASS');
