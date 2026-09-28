const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve('/app/bookmark-manager/index.html');
  await page.goto(fileUrl);

  await page.evaluate(() => {
    // initialize basic required structures
    S.dir = { name: 'MockDir' };
    S.data = {
      categories: [
        {
          id: 'cat-1',
          name: 'Test Category',
          icon: 'Folder',
          color: '#ff0000',
          bookmarks: []
        }
      ]
    };
    render();
    openPalette();
    updatePalette('no_results_test_string_123');
  });

  // wait for it to be rendered
  await page.waitForSelector('.empty-state');

  await page.screenshot({ path: '/home/jules/verification/empty_state.png' });
  await browser.close();
})();
