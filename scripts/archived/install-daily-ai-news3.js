const puppeteerExtra = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra');
const stealthPlugin = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\skills';
const SKILL_NAME = 'daily-ai-news';
const INSTALL_PATH = path.join(SKILLS_DIR, 'openclaw-' + SKILL_NAME);

async function install() {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto('https://skills.sh/openclaw/skills/' + SKILL_NAME, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 5000));

    // Try multiple extraction methods
    const content = await page.evaluate(() => {
        // Method 1: look for <pre><code> blocks
        const pres = document.querySelectorAll('pre code, pre');
        if (pres.length > 0) {
            return { method: 'pre/code', text: [...pres].map(p => p.innerText).join('\n\n') };
        }
        // Method 2: look for all text after SKILL.md marker
        const body = document.body.innerText;
        const idx = body.indexOf('SKILL.md');
        if (idx !== -1) {
            const endIdx = body.indexOf('WEEKLY INSTALLS', idx);
            return { method: 'body-text', text: body.slice(idx + 'SKILL.md'.length, endIdx > 0 ? endIdx : body.length).trim() };
        }
        // Method 3: look for a markdown/code block
        const codeBlocks = document.querySelectorAll('[class*="code"], [class*="markdown"], [class*="skill"]');
        return { method: 'none', text: body.slice(0, 500) };
    });

    console.log('Extraction method:', content.method);
    console.log('Content length:', content.text.length);
    console.log('Content:\n', content.text.slice(0, 1000));

    await browser.close();
}

install().catch(e => console.error('ERROR:', e.message));
