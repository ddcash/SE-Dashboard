const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const result = await page.evaluate(() => {
    let sanitized = "javascript&colon;alert(1)".replace(/[\x00-\x20\x7F-\x9F]/g, '');
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitized, 'text/html');
      sanitized = doc.documentElement.textContent || sanitized;
    } catch (e) {}
    sanitized = sanitized.replace(/[\x00-\x20\x7F-\x9F]/g, '');
    return /^(javascript|data|vbscript):/i.test(sanitized);
  });
  console.log('Result:', result);
  await browser.close();
})();
