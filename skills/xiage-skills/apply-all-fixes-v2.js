const fs = require('fs');
const filePath = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
let c = fs.readFileSync(filePath, 'utf8'); // Uses \r\n

const gitVersion = require('child_process').execSync(
  'git show HEAD:skills/xiage-skills/xiage-skills.js',
  { cwd: 'C:/Users/Administrator/.openclaw/workspace', encoding: 'utf8', maxBuffer: 1024*1024 }
);
// Convert git version to CRLF to match working file
const gitCRLF = gitVersion.replace(/\n/g, '\r\n');

console.log('File uses CRLF:', c.includes('\r\n'));
console.log('Git uses CRLF:', gitCRLF.includes('\r\n'));

// ===== FIX 1 =====
const old1 = '// 找到 "Download zip" 链接\r\n    const downloadLink = await page.$(\'a[href*="/api/v1/download"]\');\r\n    await page.close();\r\n    if (!downloadLink) {\r\n        if (weLaunched) await browser.close().catch(() => {});\r\n        throw new Error(\'Download zip link not found on page\');\r\n    }\r\n    const realUrl = await downloadLink.evaluate(el => el.href);\r\n\r\n    info(`  [puppeteer] Download URL: ${realUrl}`);\r\n    if (weLaunched) await browser.close().catch(() => {});\r\n\r\n    // 下载并解压 ZIP';

const new1 = '// 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）\r\n    const downloadLink = await page.$(\'a[href*="/api/v1/download"]\');\r\n    if (!downloadLink) {\r\n        await page.close().catch(() => {});\r\n        if (weLaunched) await browser.close().catch(() => {});\r\n        throw new Error(\'Download zip link not found on page\');\r\n    }\r\n    const realUrl = await downloadLink.evaluate(el => el.href);\r\n    await page.close().catch(() => {});\r\n\r\n    info(`  [puppeteer] Download URL: ${realUrl}`);\r\n    if (weLaunched) await browser.close().catch(() => {});\r\n\r\n    // 下载并解压 ZIP';

if (c.includes(old1)) {
    c = c.replace(old1, new1);
    console.log('Fix 1 applied');
} else {
    console.log('Fix 1 NOT applied. Checking...');
    // Show actual content
    const idx = c.indexOf('// 找到 "Download zip" 链接');
    if (idx >= 0) console.log('Found at', idx, '→', JSON.stringify(c.substring(idx, idx + 200)));
}

// ===== FIX 2 =====
const old2 = '// 下载并解压 ZIP\r\n    return new Promise((resolve, reject) => {\r\n        const file = fs.createWriteStream(zipPath);\r\n        https.get(realUrl, (res) => {\r\n            if (res.statusCode !== 200) {\r\n                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);\r\n                reject(new Error(`Download failed: HTTP ${res.statusCode}`));\r\n                return;\r\n            }\r\n            res.pipe(file);\r\n            file.on(\'finish\', () => {\r\n                try {\r\n                    const stats = fs.statSync(zipPath);\r\n                    if (stats.size < 500) {\r\n                        fs.unlinkSync(zipPath);\r\n                        reject(new Error(`Downloaded file too small: ${stats.size} bytes`));\r\n                        return;\r\n                    }\r\n                    const AdmZip = require(process.env.APPDATA + \'/npm/node_modules/adm-zip\');\r\n                    const zip = new AdmZip(zipPath);\r\n                    fs.mkdirSync(installPath, { recursive: true });\r\n                    zip.extractAllTo(installPath, true);\r\n                    fs.unlinkSync(zipPath);\r\n                    resolve();\r\n                } catch (e) {\r\n                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);\r\n                    reject(e);\r\n                }\r\n            });\r\n            file.on(\'error\', (err) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(err); });\r\n        }).on(\'error\', (e) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });\r\n    });\r\n}';

const new2 = '// 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）\r\n    return new Promise((resolve, reject) => {\r\n        const doDownload = (url) => {\r\n            const file = fs.createWriteStream(zipPath);\r\n            https.get(url, (res) => {\r\n                if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {\r\n                    file.close();\r\n                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);\r\n                    doDownload(res.headers.location);\r\n                    return;\r\n                }\r\n                if (res.statusCode !== 200) {\r\n                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);\r\n                    reject(new Error(`Download failed: HTTP ${res.statusCode}`));\r\n                    return;\r\n                }\r\n                const ct = (res.headers[\'content-type\'] || \'\').toLowerCase();\r\n                if (!ct.includes(\'zip\') && !ct.includes(\'octet-stream\') && !ct.includes(\'compressed\')) {\r\n                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);\r\n                    reject(new Error(`Not a zip (content-type: ${ct}), possible redirect to error page`));\r\n                    return;\r\n                }\r\n                res.pipe(file);\r\n                file.on(\'finish\', () => {\r\n                    try {\r\n                        const stats = fs.statSync(zipPath);\r\n                        if (stats.size < 500) {\r\n                            fs.unlinkSync(zipPath);\r\n                            reject(new Error(`Downloaded file too small: ${stats.size} bytes`));\r\n                            return;\r\n                        }\r\n                        const AdmZip = require(process.env.APPDATA + \'/npm/node_modules/adm-zip\');\r\n                        const zip = new AdmZip(zipPath);\r\n                        fs.mkdirSync(installPath, { recursive: true });\r\n                        zip.extractAllTo(installPath, true);\r\n                        fs.unlinkSync(zipPath);\r\n                        resolve();\r\n                    } catch (e) {\r\n                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);\r\n                        reject(e);\r\n                    }\r\n                });\r\n                file.on(\'error\', (err) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(err); });\r\n            }).on(\'error\', (e) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });\r\n        };\r\n        doDownload(realUrl);\r\n    });\r\n}';

if (c.includes(old2)) {
    c = c.replace(old2, new2);
    console.log('Fix 2 applied');
} else {
    console.log('Fix 2 NOT applied. Checking...');
    const idx = c.indexOf('// 下载并解压 ZIP');
    if (idx >= 0) console.log('Found at', idx, '→', JSON.stringify(c.substring(idx, idx + 300)));
}

// ===== FIX 3: ZIP fallback =====
// Need to find the exact block
const zipFallbackStart = "info('Puppeteer failed, falling back to ZIP...'";
const fbIdx = c.indexOf(zipFallbackStart);
console.log('ZIP fallback starts at:', fbIdx);

if (fbIdx >= 0) {
    // The ZIP fallback is inside installSingleSkill's .catch() chain
    // Find where installSingleSkill function ends
    const issIdx = c.indexOf('async function installSingleSkill');
    const funcEnd = c.indexOf('\r\n}', issIdx + 100);
    // Find the last "    });" before the function end
    let lastClose = -1;
    for (let i = funcEnd - 3; i >= issIdx; i--) {
        if (c[i] === '}' && c[i+1] === ')' && c[i+2] === ';') {
            lastClose = i;
            break;
        }
    }
    console.log('installSingleSkill func end at', funcEnd, 'last close at', lastClose);
    
    // Also check for the inner .catch() of the ZIP fallback block
    // The block ends at the last "    });" before the Promise close of installSingleSkill
    
    // Find the ZIP fallback block boundaries
    const zipBlockEnd = lastClose + 2;
    
    // The ZIP fallback ends with: "doZipFallback(zipUrl);" then the installSingleSkill Promise closes
    // But we need to find where the block from fbIdx to zipBlockEnd actually is
    
    // Actually, let me look at what's between fbIdx and the closing
    const chunk = c.substring(fbIdx, zipBlockEnd + 1);
    console.log('ZIP block length:', chunk.length);
    console.log('ZIP block start:', JSON.stringify(chunk.slice(0, 100)));
    console.log('ZIP block end:', JSON.stringify(chunk.slice(-100)));
    
    // The old block is: https.get(zipUrl, (res) => { without redirect/content-type
    const old3Marker = 'https.get(zipUrl, (res) => {';
    if (c.includes(old3Marker)) {
        const old3Start = c.indexOf(zipFallbackStart);
        const old3End = zipBlockEnd + 1;
        const old3 = c.substring(old3Start, old3End);
        console.log('Old 3 found, length:', old3.length);
        
        const new3 = `info('Puppeteer failed, falling back to ZIP...');
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
                    const ct = (res.headers[\'content-type\'] || \'\').toLowerCase();
                    if (!ct.includes(\'zip\') && !ct.includes(\'octet-stream\') && !ct.includes(\'compressed\')) {
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
        
        c = c.replace(old3, new3);
        console.log('Fix 3 applied');
    } else {
        console.log('Fix 3: old3Marker not found. Checking for https.get in file...');
        const gi = c.indexOf('https.get(zipUrl');
        console.log('https.get(zipUrl at:', gi);
        if (gi >= 0) console.log('Context:', JSON.stringify(c.substring(gi - 100, gi + 200)));
    }
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('\nDone. File length:', c.length);
