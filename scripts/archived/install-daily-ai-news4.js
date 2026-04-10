const puppeteerExtra = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra');
const stealthPlugin = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');
const path = require('path');

const SKILL_NAME = 'daily-ai-news';
const SKILLS_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\skills';
const INSTALL_PATH = path.join(SKILLS_DIR, 'openclaw-' + SKILL_NAME);

async function install() {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox'] });

    // Try clawhub.ai directly
    for (const url of [
        'https://clawhub.ai/skills/openclaw-' + SKILL_NAME,
        'https://clawhub.ai/openclaw/' + SKILL_NAME,
        'https://clawhub.ai/skills/' + SKILL_NAME
    ]) {
        console.log('Trying:', url);
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        const text = await page.evaluate(() => document.body.innerText);
        console.log('Result:', text.slice(0, 300));
        await page.close();
        if (text.includes('SKILL') || text.includes('skill') || text.length > 500) break;
    }

    await browser.close();
}

install().catch(e => console.error('ERROR:', e.message));
