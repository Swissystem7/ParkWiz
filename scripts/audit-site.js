const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(ARTIFACT_DIR)) {
  try { fs.mkdirSync(ARTIFACT_DIR, { recursive: true }); } catch (_) {}
}

async function auditSite() {
  const browser = await chromium.launch();
  const results = { desktop: {}, mobile: {} };

  // 1. Desktop Test
  console.log('Testing Desktop view...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await desktopContext.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  await page.goto('https://swissystem7.github.io/ParkWiz/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  results.desktop.title = await page.title();
  results.desktop.errors = [...consoleErrors];
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_desktop_homepage.png'), fullPage: true });

  // 2. Mobile Test (iPhone 13 viewport)
  console.log('Testing Mobile view...');
  const mobileErrors = [];
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('console', msg => {
    if (msg.type() === 'error') mobileErrors.push(msg.text());
  });
  mobilePage.on('pageerror', err => {
    mobileErrors.push(err.toString());
  });

  await mobilePage.goto('https://swissystem7.github.io/ParkWiz/', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  results.mobile.errors = [...mobileErrors];
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'live_mobile_homepage.png'), fullPage: true });

  // Test interactive buttons on desktop
  console.log('Testing interactive buttons on desktop...');
  // Check modal / buttons
  const buttons = await page.$$eval('button, a[role="button"]', els => els.map(e => ({
    id: e.id,
    text: e.innerText.trim(),
    visible: e.offsetParent !== null
  })));
  results.desktop.buttons = buttons;

  // Click on a street card or demo interaction
  const streetCard = await page.$('.street-card, .leaflet-marker-icon, [data-street]');
  if (streetCard) {
    await streetCard.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_desktop_interaction.png') });

  // Test Camera demo page / Atidim demo
  console.log('Testing demo pages...');
  const demoPage = await desktopContext.newPage();
  const demoErrors = [];
  demoPage.on('console', msg => { if (msg.type() === 'error') demoErrors.push(msg.text()); });
  demoPage.on('pageerror', err => demoErrors.push(err.toString()));
  await demoPage.goto('https://swissystem7.github.io/ParkWiz/demo/atidim.html', { waitUntil: 'networkidle' });
  await demoPage.waitForTimeout(1500);
  await demoPage.screenshot({ path: path.join(ARTIFACT_DIR, 'live_atidim_demo.png') });
  results.atidim = { errors: demoErrors };

  await browser.close();
  console.log('Audit Results:', JSON.stringify(results, null, 2));
}

auditSite().catch(console.error);
