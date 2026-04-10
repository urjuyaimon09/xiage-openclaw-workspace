const puppeteerExtra = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra');
const stealthPlugin = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\skills';
const SKILL_NAME = 'daily-ai-news';
const AUTHOR = 'openclaw';

async function main() {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto('https://skills.sh/openclaw/skills/' + SKILL_NAME, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000));

    const pageInfo = await page.evaluate(() => ({
        hasNoSkillMd: document.body.innerText.includes('No SKILL.md available'),
        installCmd: document.body.innerText.match(/npx skills add[^\n]+/)?.[0] || '',
        text: document.body.innerText.slice(0, 800)
    }));

    console.log('Has SKILL.md:', !pageInfo.hasNoSkillMd);
    console.log('Install cmd:', pageInfo.installCmd);

    if (pageInfo.hasNoSkillMd) {
        console.log('Page text:', pageInfo.text);
    }

    await browser.close();
}

main().catch(e => console.error(e.message));
