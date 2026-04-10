const puppeteerExtra = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra');
const stealthPlugin = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

(async () => {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox'] });

    // Try skills.sh directly
    const page = await browser.newPage();
    await page.goto('https://skills.sh/openclaw/skills/ai-news', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    const text = await page.evaluate(() => document.body.innerText);
    console.log('skills.sh/ai-news page:');
    console.log(text.slice(0, 500));
    await page.close();

    // Try clawhub
    const page2 = await browser.newPage();
    await page2.goto('https://clawhub.ai/openclaw/ai-news', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    const text2 = await page2.evaluate(() => document.body.innerText);
    console.log('\nclawhub.ai/openclaw/ai-news:');
    console.log(text2.slice(0, 500));
    await page2.close();

    await browser.close();
})().catch(e => console.error(e.message));
