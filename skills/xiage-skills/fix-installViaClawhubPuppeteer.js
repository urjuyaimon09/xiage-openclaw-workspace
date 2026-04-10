async function installViaClawhubPuppeteer(author, skillName) {
    const installPath = path.join(SKILLS_DIR, `${author}-${skillName}`);
    const pageUrl = `https://clawhub.ai/${author}/${skillName}`;
    const zipPath = path.join(SKILLS_DIR, `.tmp-${author}-${skillName}.zip`);

    // 优先复用单例 browser，否则自己 launch
    let browser = await getStealthBrowser();
    let weLaunched = false;
    if (!browser) {
        info(`  [puppeteer] Shared browser unavailable, launching dedicated instance`);
        const puppeteerExtra = require('./node_modules/puppeteer-extra');
        const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
        puppeteerExtra.use(stealthPlugin);
        browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        weLaunched = true;
    }

    info(`  [puppeteer] Using browser for: ${pageUrl}`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000)); // 等待 JS 渲染

    // 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）
    const downloadLink = await page.$('a[href*="/api/v1/download"]');
    if (!downloadLink) {
        await page.close().catch(() => {});
        if (weLaunched) await browser.close().catch(() => {});
        throw new Error('Download zip link not found on page');
    }
    const realUrl = await downloadLink.evaluate(el => el.href);
    await page.close().catch(() => {});

    info(`  [puppeteer] Download URL: ${realUrl}`);
    if (weLaunched) await browser.close().catch(() => {});

    // 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
    return new Promise((resolve, reject) => {
        const doDownload = (url) => {
            const file = fs.createWriteStream(zipPath);
            https.get(url, (res) => {
                // 跟随 307/302 重定向
                if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {
                    file.close();
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    doDownload(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(`Download failed: HTTP ${res.statusCode}`));
                    return;
                }
                // 验证 content-type，防止重定向到 HTML 错误页
                const ct = (res.headers['content-type'] || '').toLowerCase();
                if (!ct.includes('zip') && !ct.includes('octet-stream') && !ct.includes('compressed')) {
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(`Not a zip (content-type: ${ct}), possible redirect to error page`));
                    return;
                }
                res.pipe(file);
                file.on('finish', () => {
                    try {
                        const stats = fs.statSync(zipPath);
                        if (stats.size < 500) {
                            fs.unlinkSync(zipPath);
                            reject(new Error(`Downloaded file too small: ${stats.size} bytes`));
                            return;
                        }
                        const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                        const zip = new AdmZip(zipPath);
                        fs.mkdirSync(installPath, { recursive: true });
                        zip.extractAllTo(installPath, true);
                        fs.unlinkSync(zipPath);
                        resolve();
                    } catch (e) {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        reject(e);
                    }
                });
                file.on('error', (err) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(err); });
            }).on('error', (e) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });
        };
        doDownload(realUrl);
    });
}
