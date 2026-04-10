const fs = require('fs');
const filePath = "C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\xiage-skills.js";
let c = fs.readFileSync(filePath, 'utf8');

// Fix 1: close before evaluate
const old1 = `    // 找到 "Download zip" 链接
    const downloadLink = await page.$('a[href*="/api/v1/download"]');
    await page.close();
    if (!downloadLink) {
        if (weLaunched) await browser.close().catch(() => {});
        throw new Error('Download zip link not found on page');
    }
    const realUrl = await downloadLink.evaluate(el => el.href);

    info(\`  [puppeteer] Download URL: \${realUrl}\`);
    if (weLaunched) await browser.close().catch(() => {});`;

const new1 = `    // 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）
    const downloadLink = await page.$('a[href*="/api/v1/download"]');
    if (!downloadLink) {
        await page.close().catch(() => {});
        if (weLaunched) await browser.close().catch(() => {});
        throw new Error('Download zip link not found on page');
    }
    const realUrl = await downloadLink.evaluate(el => el.href);
    await page.close().catch(() => {});

    info(\`  [puppeteer] Download URL: \${realUrl}\`);
    if (weLaunched) await browser.close().catch(() => {});`;

if (c.includes(old1)) {
    c = c.replace(old1, new1);
    console.log('Fix 1 OK');
} else {
    // find the approximate location
    const idx = c.indexOf('await page.close();');
    const idx2 = c.indexOf('downloadLink.evaluate');
    console.log('Fix 1 pattern not found. page.close at', idx, 'evaluate at', idx2);
    if (idx > 0 && idx2 > idx) console.log('BUG CONFIRMED: close before evaluate');
}

// Fix 2: download with redirect + content-type check
const old2 = `    // 下载并解?ZIP
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(zipPath);
        https.get(realUrl, (res) => {
            if (res.statusCode !== 200) {
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                reject(new Error(\`Download failed: HTTP \${res.statusCode}\`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                try {
                    const stats = fs.statSync(zipPath);
                    if (stats.size < 500) {
                        fs.unlinkSync(zipPath);
                        reject(new Error(\`Downloaded file too small: \${stats.size} bytes\`));
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
    });
}`;

const new2 = `    // 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
    return new Promise((resolve, reject) => {
        const doDownload = (url) => {
            const file = fs.createWriteStream(zipPath);
            https.get(url, (res) => {
                if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {
                    file.close();
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    doDownload(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(\`Download failed: HTTP \${res.statusCode}\`));
                    return;
                }
                const ct = (res.headers['content-type'] || '').toLowerCase();
                if (!ct.includes('zip') && !ct.includes('octet-stream') && !ct.includes('compressed')) {
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(\`Not a zip (content-type: \${ct}), possible redirect to error page\`));
                    return;
                }
                res.pipe(file);
                file.on('finish', () => {
                    try {
                        const stats = fs.statSync(zipPath);
                        if (stats.size < 500) {
                            fs.unlinkSync(zipPath);
                            reject(new Error(\`Downloaded file too small: \${stats.size} bytes\`));
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
}`;

if (c.includes(old2)) {
    c = c.replace(old2, new2);
    console.log('Fix 2 OK');
} else {
    const idx = c.indexOf('// 下载并解');
    console.log('Fix 2 pattern not found. comment at', idx, 'char codes:', idx > 0 ? Array.from(c.slice(idx, idx+10)).map(x=>x.charCodeAt(0)) : 'N/A');
}

// Fix 3: ZIP fallback with redirect + content-type
const old3 = `https.get(zipUrl, { followAllRedirects: true }, (res) => {
                const file = fs.createWriteStream(zipPath);
                // 验证 content-type
                const ct = (res.headers['content-type'] || '').toLowerCase();
                if (!ct.includes('zip') && !ct.includes('octet-stream') && !ct.includes('compressed')) {
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    throw new Error(\`ZIP fallback: not a zip (content-type: \${ct})\`);
                }
                res.pipe(file);
                file.on('finish', () => {
                    try {
                        const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                        const zip = new AdmZip(zipPath);
                        zip.extractAllTo(installPath, true);
                        fs.unlinkSync(zipPath);
                        doInstall();
                    } catch (e) {
                        // ———— 最后兜底: ClawHub 页面抓取写 SKILL.md ————
                        info('ZIP fallback also failed, trying ClawHub page fetch...');
                        fetchClawhubPageText(author, skillName).then((result) => {
                            if (!result.ok || !result.content) {
                                reject(new Error(\`ClawHub fetch failed: \${result.error || 'no content'}\`));
                                return;
                            }
                            ensureDir(installPath);
                            const skillMdPath = path.join(installPath, 'SKILL.md');
                            fs.writeFileSync(skillMdPath, result.content, 'utf8');
                            const pkgJson = JSON.stringify({ name: \`\${author}-\${skillName}\`, version: '1.0.0', description }, null, 2);
                            fs.writeFileSync(path.join(installPath, 'package.json'), pkgJson, 'utf8');
                            info(\`Installed via ClawHub fetch: \${skillName}\`);
                            doInstall();
                        });
                    }
                });
                file.on('error', (err) => { fs.unlinkSync(zipPath); reject(err); });
            }).on('error', (e) => {
                info('ZIP download failed, trying ClawHub page fetch...');
                fetchClawhubPageText(author, skillName).then((result) => {
                    if (!result.ok || !result.content) {
                        reject(new Error(\`ClawHub fetch failed: \${result.error || 'no content'}\`));
                        return;
                    }
                    ensureDir(installPath);
                    const skillMdPath = path.join(installPath, 'SKILL.md');
                    fs.writeFileSync(skillMdPath, result.content, 'utf8');
                    const pkgJson = JSON.stringify({ name: \`\${author}-\${skillName}\`, version: '1.0.0', description }, null, 2);
                    fs.writeFileSync(path.join(installPath, 'package.json'), pkgJson, 'utf8');
                    info(\`Installed via ClawHub fetch: \${skillName}\`);
                    doInstall();
                });
            });`;

const new3 = `const doZipFallback = (url) => {
                const file = fs.createWriteStream(zipPath);
                https.get(url, (res) => {
                    if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {
                        file.close();
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        doZipFallback(res.headers.location);
                        return;
                    }
                    if (res.statusCode !== 200) {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        reject(new Error(\`ZIP fallback failed: HTTP \${res.statusCode}\`));
                        return;
                    }
                    const ct = (res.headers['content-type'] || '').toLowerCase();
                    if (!ct.includes('zip') && !ct.includes('octet-stream') && !ct.includes('compressed')) {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        reject(new Error(\`ZIP fallback: not a zip (content-type: \${ct})\`));
                        return;
                    }
                    res.pipe(file);
                    file.on('finish', () => {
                        try {
                            const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                            const zip = new AdmZip(zipPath);
                            fs.mkdirSync(installPath, { recursive: true });
                            zip.extractAllTo(installPath, true);
                            fs.unlinkSync(zipPath);
                            doInstall();
                        } catch (e) {
                            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                            info('ZIP unzip failed, trying ClawHub page fetch...');
                            fetchClawhubPageText(author, skillName).then((result) => {
                                if (!result.ok || !result.content) {
                                    reject(new Error(\`ClawHub fetch failed: \${result.error || 'no content'}\`));
                                    return;
                                }
                                ensureDir(installPath);
                                fs.writeFileSync(path.join(installPath, 'SKILL.md'), result.content, 'utf8');
                                fs.writeFileSync(path.join(installPath, 'package.json'), JSON.stringify({ name: \`\${author}-\${skillName}\`, version: '1.0.0', description }, null, 2), 'utf8');
                                info(\`Installed via ClawHub fetch: \${skillName}\`);
                                doInstall();
                            });
                        }
                    });
                    file.on('error', (err) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(err); });
                }).on('error', (e) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });
            };
            doZipFallback(zipUrl);`;

if (c.includes(old3)) {
    c = c.replace(old3, new3);
    console.log('Fix 3 OK');
} else {
    const idx = c.indexOf('followAllRedirects');
    console.log('Fix 3 pattern not found. followAllRedirects at', idx);
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('Done');
