const fs = require('fs');
const filePath = "C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\xiage-skills.js";
let c = fs.readFileSync(filePath, 'utf8');

// ===== Fix 2: Puppeteer download section =====
const downloadStart = c.indexOf('// 下载并解压 ZIP');
const downloadEndMarker = `    }
}

// async function installSingleSkill`;
// Find where installViaClawhubPuppeteer function ends
const installSingleSkillPos = c.indexOf('async function installSingleSkill');
const installViaEnd = c.lastIndexOf('}', installSingleSkillPos);

console.log('downloadStart:', downloadStart, 'installViaEnd:', installViaEnd);

const oldDownloadBlock = c.substring(downloadStart, installViaEnd + 1);
console.log('Old block length:', oldDownloadBlock.length);
console.log('Old block end:', JSON.stringify(oldDownloadBlock.slice(-100)));

const newDownloadBlock = `// 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
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

if (c.includes(oldDownloadBlock)) {
    c = c.replace(oldDownloadBlock, newDownloadBlock);
    console.log('Fix 2 applied');
} else {
    console.log('Fix 2: block not found by substring. Checking if key markers exist...');
    console.log('  has "doDownload":', c.includes('doDownload'));
    console.log('  has "res.statusCode !== 200":', c.includes('res.statusCode !== 200'));
    console.log('  has "content-type":', c.includes('content-type'));
}

// ===== Fix 3: ZIP fallback section =====
const fallbackStartMarker = "info('Puppeteer failed, falling back to ZIP...'";
const fbStart = c.indexOf(fallbackStartMarker);
if (fbStart < 0) {
    console.log('Fix 3: ZIP fallback marker not found');
} else {
    // Find the end of the ZIP fallback block
    // It ends with "doZipFallback(zipUrl);" followed by the closing of installSingleSkill's Promise
    // Let's find the next occurrence of "});" after the ZIP fallback block's last meaningful content
    const fallbackContent = c.substring(fbStart);
    // The ZIP fallback block starts with the https.get call and ends when we see
    // "});" followed by "        });" (the installSingleSkill promise close)
    // We need to find the right closing pattern
    
    // Find "doZipFallback(zipUrl);" - but it doesn't exist yet, so find the last "});" 
    // that closes the installSingleSkill Promise after the https.get chain
    const installSingleSkillStart = c.indexOf('async function installSingleSkill');
    const zipFallbackText = c.substring(fbStart, installSingleSkillStart);
    console.log('ZIP fallback text length:', zipFallbackText.length);
    
    // The old block ends with the last "});" before installSingleSkill
    const lastClose = zipFallbackText.lastIndexOf('});');
    const oldZipFallback = zipFallbackText.substring(0, lastClose + 2);
    console.log('Old ZIP fallback block length:', oldZipFallback.length);
    console.log('Old ZIP fallback end:', JSON.stringify(oldZipFallback.slice(-80)));
    
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
    
    if (c.includes(oldZipFallback)) {
        c = c.replace(oldZipFallback, newZipFallback);
        console.log('Fix 3 applied');
    } else {
        console.log('Fix 3: block not found. Checking...');
        console.log('  has doZipFallback:', c.includes('doZipFallback'));
        console.log('  has zipUrl in fallback:', c.includes('zipUrl = \${skillUrl}/archive'));
    }
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('Done, file written');
