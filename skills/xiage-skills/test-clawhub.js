const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

(async () => {
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  await page.goto('https://clawhub.ai/steipete/Summarize', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise(r => setTimeout(r, 5000)); // wait for JS render

  // Try to find download link
  const downloadLink = await page.$('a[href*="/api/v1/download"]');
  console.log('Found download link:', !!downloadLink);

  if (downloadLink) {
    const url = await downloadLink.evaluate(el => el.href);
    console.log('URL:', url);
  } else {
    // dump all links containing download/api/zip
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .map(a => ({ href: a.href, text: a.innerText.trim().slice(0, 80) }))
        .filter(l => l.href.includes('download') || l.href.includes('api') || l.href.includes('zip'))
    );
    console.log('Matching links:', JSON.stringify(links, null, 2));

    // also check the HTML around where the button should be
    const html = await page.content();
    const idx = html.indexOf('/api/v1/download');
    if (idx > 0) console.log('API URL in HTML:', html.slice(Math.max(0, idx - 100), idx + 100));
    else console.log('/api/v1/download NOT found in HTML');
  }

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
