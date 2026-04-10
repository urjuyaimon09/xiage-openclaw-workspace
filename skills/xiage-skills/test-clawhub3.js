const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

(async () => {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto('https://clawhub.ai/Shaivpidadi/free-ride', { waitUntil: 'networkidle2', timeout: 20000 });
    
    // Wait for content to render
    await page.waitForTimeout(3000);
    
    // Check page content
    const content = await page.content();
    const ghMatch = content.match(/github\.com\/[^\s'"<)]+/);
    const downloadLinks = await page.$$eval('a[href*="download"]', els => els.map(e => e.href));
    
    console.log('Page size:', content.length);
    console.log('GitHub URL:', ghMatch ? ghMatch[0] : 'not found');
    console.log('Download links:', JSON.stringify(downloadLinks));
    
    // Get all links to see what's available
    const allLinks = await page.$$eval('a[href]', els => els.map(e => ({text: e.innerText.trim(), href: e.href})).filter(e => e.text || e.href.includes('github')));
    console.log('All links:', JSON.stringify(allLinks.slice(0, 20)));
    
    await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
