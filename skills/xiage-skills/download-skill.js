// 自定义下载脚本：通过 Puppeteer 从 ClawHub 页面触发 ZIP 下载
const path = require('path');
const fs = require('fs');

const SKILLS_DIR = path.join(process.env.USERPROFILE, '.openclaw', 'workspace', 'skills');
const TEMP_DIR = process.env.TEMP || path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Temp');
const PAGE_URL = 'https://clawhub.ai/8421bit/wechat-article-reader';
const SKILL_NAME = 'wechat-article-reader';
const INSTALL_PATH = path.join(SKILLS_DIR, `8421bit-${SKILL_NAME}`);

async function downloadWithPuppeteer() {
    let browser;
    try {
        const puppeteerExtra = require('puppeteer-extra');
        const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
        puppeteerExtra.use(stealthPlugin);

        console.log('Launching browser...');
        browser = await puppeteerExtra.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                   '--disable-web-security', '--allow-running-insecure-content']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 900 });

        console.log('Navigating to ClawHub page...');
        await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        // 找下载链接
        const downloadLink = await page.$('a[href*="/api/v1/download"]');
        if (!downloadLink) {
            throw new Error('Download link not found on page');
        }
        const realUrl = await downloadLink.evaluate(el => el.href);
        console.log('Found download URL:', realUrl);

        // 启用下载
        const zipPath = path.join(TEMP_DIR, `8421bit-${SKILL_NAME}.zip`);
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: TEMP_DIR
        });

        // 点击下载链接
        await downloadLink.click();
        await new Promise(r => setTimeout(r, 10000));

        // 查找下载的 zip 文件
        const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.zip') && f.includes('wechat-article-reader'));
        if (files.length === 0) {
            throw new Error('No zip file downloaded');
        }
        const downloadedZip = path.join(TEMP_DIR, files[0]);
        console.log('Downloaded:', downloadedZip, 'Size:', fs.statSync(downloadedZip).size);

        // 解压
        const AdmZip = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'adm-zip'));
        const zip = new AdmZip(downloadedZip);
        fs.mkdirSync(INSTALL_PATH, { recursive: true });
        zip.extractAllTo(INSTALL_PATH, true);
        fs.unlinkSync(downloadedZip);
        console.log('Installed to:', INSTALL_PATH);

        await browser.close();
        console.log('Done!');
    } catch (e) {
        console.error('Error:', e.message);
        if (browser) await browser.close().catch(() => {});
        process.exit(1);
    }
}

downloadWithPuppeteer();
