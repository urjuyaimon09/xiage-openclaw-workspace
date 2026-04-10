const puppeteerExtra = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra');
const stealthPlugin = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

(async () => {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox'] });

    // Try clawhub search
    const page = await browser.newPage();
    await page.goto('https://clawhub.ai/search?q=ai-news', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    const clawhubResults = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-skill-id], .skill-item, .search-result, a[href*="/skill/"]');
        return [...items].slice(0, 10).map(el => ({
            href: el.href || el.closest('a')?.href,
            text: el.innerText?.slice(0, 200)
        }));
    });
    console.log('ClawHub results:', JSON.stringify(clawhubResults, null, 2));

    // Try skills.sh search
    const page2 = await browser.newPage();
    await page2.goto('https://skills.sh/search?q=ai-news', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    const skillsShResults = await page2.evaluate(() => {
        return document.body.innerText.slice(0, 1000);
    });
    console.log('\nSkills.sh results:', skillsShResults);

    await browser.close();
})().catch(e => console.error(e.message));
