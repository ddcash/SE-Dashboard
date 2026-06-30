const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to the local file
  await page.goto('file://' + process.cwd() + '/bookmark-manager/index.html');

  // Inject mock data to bypass the file picker
  await page.evaluate(() => {
    S.dir = { name: 'MockDir' };
    S.data = {
      categories: [
        {
          id: 'cat-1',
          name: 'Test Category',
          icon: 'Folder',
          color: '#ff0000',
          bookmarks: [
            {
              id: 'bm-1',
              title: 'XSS Test',
              url: 'javascript:alert(1)',
              description: 'Testing sanitization',
              tags: ['xss'],
              clicks: 0,
              icon: { type: 'lucide', value: 'Globe' },
              customStyle: {}
            },
            {
              id: 'bm-2',
              title: 'Quote Test',
              url: 'https://example.com/test\'onclick=\'alert(1)',
              description: 'Testing quote escaping',
              tags: [],
              clicks: 0,
              icon: { type: 'lucide', value: 'Link' },
              customStyle: {}
            }
          ]
        }
      ]
    };
    render(); // Manually trigger a render
  });

  // Verify the HTML to ensure sanitization worked
  const bm1Url = await page.evaluate(() => document.querySelector('[data-id="bm-1"] .card-link').getAttribute('href'));
  console.log('Bookmark 1 URL:', bm1Url);

  const bm2Url = await page.evaluate(() => document.querySelector('[data-id="bm-2"] .card-link').getAttribute('href'));
  console.log('Bookmark 2 URL:', bm2Url);

  // Verify it works in the palette too
  await page.evaluate(() => {
    openPalette();
    updatePalette('XSS');
  });

  const paletteUrl = await page.evaluate(() => {
    const item = document.querySelector('.palette-item');
    return item ? item.getAttribute('onclick') : null;
  });
  console.log('Palette onclick:', paletteUrl);

  const paletteDataUrl = await page.evaluate(() => {
    const item = document.querySelector('.palette-item');
    return item ? item.getAttribute('data-url') : null;
  });
  console.log('Palette data-url:', paletteDataUrl);

  await browser.close();
})();
