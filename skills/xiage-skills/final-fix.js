// Final fix script: applies all 3 fixes to xiage-skills.js
const git = require('child_process');
const fs = require('fs');

const gitFile = git.execSync(
  'git show HEAD:skills/xiage-skills/xiage-skills.js',
  {cwd:'C:/Users/Administrator/.openclaw/workspace', encoding:'utf8'}
);

let g = gitFile; // Work with git version as base

// ===== FIX 1: close before evaluate =====
const marker1_old = `// 找到 "Download zip" 链接
    const downloadLink = await page.$('a[href*="/api/v1/download"]');
    await page.close();
    if (!downloadLink) {
        if (weLaunched) await browser.close().catch(() => {});
        throw new Error('Download zip link not found on page');
    }
    const realUrl = await downloadLink.evaluate(el => el.href);

    info(\`  [puppeteer] Download URL: \${realUrl}\`);
    if (weLaunched) await browser.close().catch(() => {});

    // 下载并解压 ZIP`;

const marker1_new = `// 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）
    const downloadLink = await page.$('a[href*="/api/v1/download"]');
    if (!downloadLink) {
        await page.close().catch(() => {});
        if (weLaunched) await browser.close().catch(() => {});
        throw new Error('Download zip link not found on page');
    }
    const realUrl = await downloadLink.evaluate(el => el.href);
    await page.close().catch(() => {});

    info(\`  [puppeteer] Download URL: \${realUrl}\`);
    if (weLaunched) await browser.close().catch(() => {});

    // 下载并解压 ZIP`;

if (g.includes(marker1_old)) {
    g = g.replace(marker1_old, marker1_new);
    console.log('Fix 1 applied');
} else {
    console.log('Fix 1 FAILED - pattern not found');
    process.exit(1);
}

// ===== FIX 2: download with redirect + content-type =====
const marker2_old = `// 下载并解压 ZIP
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

const marker2_new = `// 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
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

if (g.includes(marker2_old)) {
    g = g.replace(marker2_old, marker2_new);
    console.log('Fix 2 applied');
} else {
    console.log('Fix 2 FAILED - pattern not found');
    process.exit(1);
}

// ===== FIX 3: ZIP fallback with redirect + content-type =====
const marker3_old = `// ———— fallback ZIP (GitHub) ————
            info('Puppeteer failed, falling back to ZIP...');
            const zipUrl = \`\${skillUrl}/archive/refs/heads/master.zip\`;
            const zipPath = path.join(SKILLS_DIR, \`.tmp-\${author}-\${skillName}.zip\`);

            https.get(zipUrl, (res) => {
                const file = fs.createWriteStream(zipPath);
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

const marker3_new = `// ———— fallback ZIP (GitHub) ————
            info('Puppeteer failed, falling back to ZIP...');
            const zipUrl = \`\${skillUrl}/archive/refs/heads/master.zip\`;
            const zipPath = path.join(SKILLS_DIR, \`.tmp-\${author}-\${skillName}.zip\`);

            const doZipFallback = (url) => {
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

if (g.includes(marker3_old)) {
    g = g.replace(marker3_old, marker3_new);
    console.log('Fix 3 applied');
} else {
    console.log('Fix 3 FAILED - pattern not found');
    process.exit(1);
}

// Write the result
const filePath = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
fs.writeFileSync(filePath, g, 'utf8');
console.log('File written, length:', g.length);
