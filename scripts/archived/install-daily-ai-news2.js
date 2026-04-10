const puppeteerExtra = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra');
const stealthPlugin = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\node_modules\\puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\skills';
const SKILL_NAME = 'daily-ai-news';
const INSTALL_PATH = path.join(SKILLS_DIR, 'openclaw-' + SKILL_NAME);
const SUIJI_ID = '7444251382150799';

function info(msg) { console.log('\x1b[32m[INFO]\x1b[0m', msg); }

async function install() {
    if (fs.existsSync(path.join(INSTALL_PATH, 'SKILL.md'))) {
        info(SKILL_NAME + ': already installed, skipping');
        return;
    }

    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto('https://skills.sh/openclaw/skills/' + SKILL_NAME, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000));

    const content = await page.evaluate(() => {
        const text = document.body.innerText;
        const start = text.indexOf('SKILL.md');
        if (start === -1) return null;
        const end = text.indexOf('WEEKLY INSTALLS');
        return text.slice(start + 'SKILL.md'.length, end > 0 ? end : text.length).trim();
    });

    await browser.close();

    if (!content || content.length < 100) {
        console.error('FAILED: SKILL.md content too short');
        return;
    }

    fs.mkdirSync(INSTALL_PATH, { recursive: true });
    fs.writeFileSync(path.join(INSTALL_PATH, 'SKILL.md'), content, 'utf8');
    fs.writeFileSync(path.join(INSTALL_PATH, 'package.json'),
        JSON.stringify({ name: 'openclaw-' + SKILL_NAME, version: '1.0.0' }, null, 2), 'utf8');

    info('Installed ' + SKILL_NAME + ' (' + content.length + ' chars)');
    console.log('First 200 chars:', content.slice(0, 200));
}

install().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
