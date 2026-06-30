const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Replace with the actual absolute path in the environment
  const path = require('path');
  const filePath = path.resolve(__dirname, 'bookmark-manager/index.html');
  const fileUrl = `file://${filePath}`;

  await page.goto(fileUrl);

  // Wait for the app to render its initial state (the connect screen)
  await page.waitForSelector('.connect-screen');

  // Check if the connect screen contains the "Bookmark Manager" text
  const content = await page.content();
  if (content.includes('Bookmark Manager')) {
    console.log('Playwright test passed: UI loaded successfully.');
  } else {
    console.error('Playwright test failed: Expected text not found.');
    process.exit(1);
  }

  await browser.close();
})();
