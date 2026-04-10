const fs = require('fs');
const filePath = "C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js";
let c = fs.readFileSync(filePath, 'utf8');

// The ZIP fallback block from "info('Puppeteer failed..." to the closing "});" of the catch chain
const zipFallbackStart = c.indexOf("info('Puppeteer failed, falling back to ZIP...'");
console.log('ZIP fallback starts at:', zipFallbackStart);

// Find the end: count opening/closing from the start of installSingleSkill's return Promise
const issStart = c.indexOf('async function installSingleSkill');
// The return Promise of installSingleSkill starts at the first "return new Promise"
const returnPromiseStart = c.indexOf('return new Promise', issStart);
console.log('return Promise at:', returnPromiseStart);

// We want to find the closing of this Promise
// From the closing structure I've observed:
// After the ZIP fallback block, the structure is:
// "            });" closes .on('error') handler
// "        });" closes .then() from fetchClawhubPageText
// "    });" closes the installSingleSkill return Promise  
// "}" closes installSingleSkill function

// Find all "});" occurrences after the ZIP fallback start
let allCloses = [];
let searchFrom = zipFallbackStart;
while (true) {
    const idx = c.indexOf('});', searchFrom);
    if (idx < 0 || idx > issStart + 500) break;
    // Count braces between zipFallbackStart and this "});"
    const segment = c.substring(zipFallbackStart, idx);
    const openCount = (segment.match(/\{/g) || []).length;
    const closeCount = (segment.match(/\}/g) || []).length;
    allCloses.push({ pos: idx, opens: openCount, closes: closeCount, net: openCount - closeCount });
    searchFrom = idx + 2;
}
console.log('Possible close positions after ZIP fallback:', allCloses.slice(0, 8));

// The correct closing is where net opens-closes approaches 0 and is followed by "    });" for the Promise close
// From observation: the correct zip fallback block ends before the "    });" that closes the installSingleSkill Promise
// Looking at the last 300 chars before installSingleSkill: "    });\n}\n\n"
// That "});" is at position issStart - 4

// So the ZIP fallback block ends at the last "});" BEFORE "    });" 
const issClosePromisePos = issStart - 4;
console.log('installSingleSkill close Promise is at:', issClosePromisePos);
console.log('char at issClosePromisePos:', JSON.stringify(c.substring(issClosePromisePos - 10, issClosePromisePos + 10)));

// The ZIP fallback block ends at the last "});" before this
// Find it
let lastZipClose = -1;
let searchPos = zipFallbackStart;
while (searchPos < issClosePromisePos) {
    const idx = c.indexOf('});', searchPos);
    if (idx < 0 || idx >= issClosePromisePos) break;
    lastZipClose = idx;
    searchPos = idx + 2;
}
console.log('Last ZIP fallback close at:', lastZipClose);
console.log('Context:', JSON.stringify(c.substring(lastZipClose - 30, lastZipClose + 10)));

// Build the old ZIP fallback block
const oldZipFallback = c.substring(zipFallbackStart, lastZipClose + 2);
console.log('Old ZIP fallback block length:', oldZipFallback.length);

// Build the new ZIP fallback block
const newZipFallback = `info('Puppeteer failed, falling back to ZIP...');
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

// Replace
if (c.includes(oldZipFallback)) {
    c = c.replace(oldZipFallback, newZipFallback);
    console.log('Fix 3 applied: ZIP fallback redirect + content-type');
} else {
    console.log('Fix 3: block not found. oldZipFallback length:', oldZipFallback.length);
    console.log('First 200:', JSON.stringify(oldZipFallback.slice(0, 200)));
    console.log('Last 200:', JSON.stringify(oldZipFallback.slice(-200)));
}

// Now Fix 2: Puppeteer download redirect + content-type
// This is in installViaClawhubPuppeteer
const iacStart = c.indexOf('async function installViaClawhubPuppeteer');
const iacEnd = c.indexOf('async function installSingleSkill');
const iacSection = c.substring(iacStart, iacEnd);

const oldDownload = `// 下载并解压 ZIP
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

const newDownload = `// 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
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

if (c.includes(oldDownload)) {
    c = c.replace(oldDownload, newDownload);
    console.log('Fix 2 applied: Puppeteer download redirect + content-type');
} else {
    console.log('Fix 2: block not found. iacSection length:', iacSection.length);
    // Try to find the download block within installViaClawhubPuppeteer
    const dlIdx = iacSection.indexOf('https.get(realUrl');
    console.log('https.get(realUrl in iacSection:', dlIdx);
    if (dlIdx > 0) {
        console.log('Context:', JSON.stringify(iacSection.substring(dlIdx - 50, dlIdx + 200)));
    }
}

// Fix 1: close before evaluate
const oldCloseEval = `    // 找到 "Download zip" 链接
    const downloadLink = await page.$('a[href*="/api/v1/download"]');
    await page.close();
    if (!downloadLink) {
        if (weLaunched) await browser.close().catch(() => {});
        throw new Error('Download zip link not found on page');
    }
    const realUrl = await downloadLink.evaluate(el => el.href);

    info(\`  [puppeteer] Download URL: \${realUrl}\`);
    if (weLaunched) await browser.close().catch(() => {});`;

const newCloseEval = `    // 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）
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

if (c.includes(oldCloseEval)) {
    c = c.replace(oldCloseEval, newCloseEval);
    console.log('Fix 1 applied: close before evaluate');
} else {
    console.log('Fix 1: block not found');
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('Done');
