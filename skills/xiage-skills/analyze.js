const fs = require('fs');
const c = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js', 'utf8');

// Find installViaClawhubPuppeteer
const iac = c.indexOf('installViaClawhubPuppeteer');
console.log('installViaClawhubPuppeteer at:', iac);

// Fix 1: The close/evaluate section
// Find the comment "找到 Download zip" in installViaClawhubPuppeteer
const commentStr = '// 找到 "Download zip" 链接';
const chunk1Start = c.indexOf(commentStr, iac);
const chunk1End = c.indexOf('// 下载并解压 ZIP', iac);
console.log('\nFix 1 section (old):');
console.log(JSON.stringify(c.substring(chunk1Start, chunk1End)));

const newFix1 = `// 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）
    const downloadLink = await page.\$('a[href*="/api/v1/download"]');
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

console.log('\nNew Fix 1:');
console.log(JSON.stringify(newFix1));

// Fix 2: The download section
const dlStart = c.indexOf('// 下载并解压 ZIP', iac);
const dlEnd = c.indexOf('}', dlStart + 500) + 1; // find the function end
// Find the installSingleSkill function start
const iss = c.indexOf('installSingleSkill');
console.log('\ninstallSingleSkill at:', iss);
// The function end is before iss
// Find "return new Promise" in installViaClawhubPuppeteer
const retPromise = c.indexOf('return new Promise', iac);
console.log('return Promise at:', retPromise);
// The return Promise ends at the "}" that closes the function
// Find the closing of the function
const funcEnd = c.indexOf('\n}', retPromise + 200);
console.log('function end at:', funcEnd);
const dlSection = c.substring(dlStart, funcEnd + 1);
console.log('\nFix 2 section (old, length:', dlSection.length, '):');
console.log(JSON.stringify(dlSection.slice(0, 500)));

// Write fixes
let fixed = c;
fixed = fixed.substring(0, chunk1Start) + newFix1 + fixed.substring(chunk1End);
console.log('\nAfter Fix 1 replacement, file length:', fixed.length);

// For Fix 2, we need to re-find the positions after the first replacement
const fixedIac = fixed.indexOf('installViaClawhubPuppeteer');
const fixedDlStart = fixed.indexOf('// 下载并解压 ZIP', fixedIac);
const fixedRetPromise = fixed.indexOf('return new Promise', fixedIac);
const fixedFuncEnd = fixed.indexOf('\n}', fixedRetPromise + 200);
const fixedDlSection = fixed.substring(fixedDlStart, fixedFuncEnd + 1);
console.log('\nFix 2 section after Fix 1 applied (length:', fixedDlSection.length, '):');
console.log(JSON.stringify(fixedDlSection.slice(0, 300)));

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

console.log('\nFix 2 section matches:', fixedDlSection === c.substring(dlStart, funcEnd + 1));
fixed = fixed.substring(0, fixedDlStart) + newDownload + fixed.substring(fixedFuncEnd + 1);
console.log('After Fix 2 replacement, file length:', fixed.length);

// Fix 3: ZIP fallback
// Find the ZIP fallback block in installSingleSkill
const issStart = fixed.indexOf('installSingleSkill');
// Find info('Puppeteer failed, falling back to ZIP') in installSingleSkill
const fbMarker = "info('Puppeteer failed, falling back to ZIP...'";
const fbStart = fixed.indexOf(fbMarker, issStart);
console.log('\nZIP fallback starts at:', fbStart);
// The ZIP fallback block ends at the last "});" before the installSingleSkill closing
// Find the installSingleSkill function body end
// The function starts with: async function installSingleSkill(...){return new Promise(...}
// We need to find the closing of the Promise that contains the ZIP fallback
// Looking at the structure: installSingleSkill returns a Promise, inside which is
// the .catch() chain that contains the ZIP fallback
// After the ZIP fallback, the Promise closes with "    });" then "}"

const beforeISS = fixed.substring(0, issStart);
const afterISS = fixed.substring(issStart);
// Find the function closing
const issFuncEnd = afterISS.indexOf('}');
console.log('installSingleSkill function body ends at relative pos:', issFuncEnd);
// The Promise closes with "    });" - find the last "});" before the function end
const issClose = issStart + issFuncEnd;
const beforeIssClose = fixed.substring(0, issClose);
// Find the last "});" before the function end
let lastClose = -1;
for(let i = beforeIssClose.length - 3; i >= 0; i--) {
    if(beforeIssClose[i] === '}' && beforeIssClose[i+1] === ')' && beforeIssClose[i+2] === ';') {
        lastClose = i;
        break;
    }
}
console.log('Last "});" at:', lastClose, 'Context:', JSON.stringify(fixed.substring(lastClose - 20, lastClose + 30)));

const oldZipFallback = fixed.substring(fbStart, lastClose + 2);
console.log('\nFix 3 old block (length:', oldZipFallback.length, '):');
console.log(JSON.stringify(oldZipFallback.slice(0, 200)));
console.log('...');
console.log(JSON.stringify(oldZipFallback.slice(-200)));

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

fixed = fixed.substring(0, fbStart) + newZipFallback + fixed.substring(lastClose + 2);

fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js', fixed, 'utf8');
console.log('\nAll fixes applied. File written, length:', fixed.length);
