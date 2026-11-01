const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const pagesToTest = [
    'https://swissystem7.github.io/ParkWiz/',
    'https://swissystem7.github.io/ParkWiz/demo/atidim.html',
    'https://swissystem7.github.io/ParkWiz/demo/atidim-board.html',
    'https://swissystem7.github.io/ParkWiz/demo/camera.html'
  ];

  for (const url of pagesToTest) {
    for (const vp of [
      { name: 'desktop', width: 1280, height: 800, isMobile: false },
      { name: 'mobile', width: 390, height: 844, isMobile: true }
    ]) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem'
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => pageErrors.push(err.message));

      let status = 0;
      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        status = resp ? resp.status() : 0;
        await page.waitForTimeout(2000);
      } catch (e) {
        pageErrors.push(e.message);
      }

      console.log(`[${vp.name}] ${url} -> Status: ${status}, ConsoleErrors: ${consoleErrors.length}, PageErrors: ${pageErrors.length}`);
      if (consoleErrors.length > 0) console.log('  Console Errors:', consoleErrors);
      if (pageErrors.length > 0) console.log('  Page Errors:', pageErrors);

      await context.close();
    }
  }
  await browser.close();
})();
