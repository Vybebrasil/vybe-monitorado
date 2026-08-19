import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = process.env.VYBE_PREVIEW_URL || 'https://5173-iez9v8jz7x88hqzi5jtco-9d0acee3.us2.manus.computer/?client-investigation=fixture';
const fixture = JSON.parse(readFileSync('/tmp/vybe-metrics-fixture.json', 'utf8'));
const snapshot = fixture.metrics.executiveSnapshot;
const antonov = snapshot.clientRanking.find(row => row.client === 'Antonov');
const activeItems = Array.from({ length: antonov.openItems }, (_, index) => ({
  id: `antonov-${index + 1}`,
  name: `Item Antonov ${index + 1}`,
  client: 'Antonov',
  stage: index % 2 ? 'Redação' : 'Criação',
  status: index < antonov.delayedItems ? 'Alteração' : 'Pode Fazer',
  prazo: index < antonov.delayedItems ? '2026-08-10' : '2026-09-10',
  veiculacao: '2026-09-20',
  responsavel: 'Responsável Antonov',
  responsavelPeople: [],
  isDelayedPrazo: index < antonov.internalDelays,
  isDelayedVeiculacao: index < antonov.publicationDelays,
  daysOverdue: index < antonov.delayedItems ? 8 : 0
}));
snapshot.activeItems = activeItems;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/dashboard/metrics**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);

const antonovRow = page.locator('.risk-bar-row').filter({ hasText: 'Antonov' }).first();
await antonovRow.click();
await page.waitForTimeout(250);
const result = await page.evaluate(() => ({
  title: document.querySelector('.investigation-hero h4')?.textContent?.trim() || '',
  metrics: [...document.querySelectorAll('.investigation-metrics > div')].map(item => item.innerText.trim()),
  total: document.querySelector('.client-investigation-total')?.textContent?.trim() || '',
  delayedHeading: [...document.querySelectorAll('.investigation-section-title')].find(item => item.textContent.includes('ATRASADOS'))?.textContent?.trim() || '',
  onTimeHeading: [...document.querySelectorAll('.investigation-section-title')].find(item => item.textContent.includes('DENTRO DO PRAZO'))?.textContent?.trim() || '',
  cards: document.querySelectorAll('.investigation-evidence-item').length,
  mondayLinks: document.querySelectorAll('.investigation-evidence-link[href*="monday.com/boards/7829537690/pulses/"]').length,
  blackRoot: !(document.querySelector('#root')?.innerText || '').trim()
}));

const failures = [];
if (!result.title.includes('Antonov') || !result.title.includes('5 atrasados') || !result.title.includes('10 itens abertos')) failures.push(`título inesperado: ${result.title}`);
if (!result.total.includes('5 atrasados') || !result.total.includes('10 itens abertos')) failures.push(`resumo inesperado: ${result.total}`);
if (!result.delayedHeading.includes('5 ITEM')) failures.push(`grupo atrasados inesperado: ${result.delayedHeading}`);
if (!result.onTimeHeading.includes('5 ITEM')) failures.push(`grupo dentro do prazo inesperado: ${result.onTimeHeading}`);
if (result.cards !== 10) failures.push(`cards esperados 10, obtidos ${result.cards}`);
if (result.mondayLinks !== 10) failures.push(`links Monday esperados 10, obtidos ${result.mondayLinks}`);
if (result.blackRoot) failures.push('root ficou vazio após clicar em Antonov');
if (errors.length) failures.push(`pageerrors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ result, failures }, null, 2));
await browser.close();
if (failures.length) process.exit(1);
console.log('CLIENT_INVESTIGATION_PASS');
