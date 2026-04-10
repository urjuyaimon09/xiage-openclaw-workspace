const fs = require('fs');
const filePath = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
let c = fs.readFileSync(filePath, 'utf8');

// Get the full function text from git for reference
const gitVersion = require('child_process').execSync(
  'git show HEAD:skills/xiage-skills/xiage-skills.js',
  { cwd: 'C:/Users/Administrator/.openclaw/workspace', encoding: 'utf8', maxBuffer: 1024*1024 }
);

// ===== FIX 1: close before evaluate =====
const old1_start = '// 找到 "Download zip" 链接\n    const downloadLink';
const old1_end = '    if (weLaunched) await browser.close().catch(() => {});\n\n    // 下载并解压 ZIP';
const iac_idx = gitVersion.indexOf('installViaClawhubPuppeteer');
const o1s = gitVersion.indexOf(old1_start, iac_idx);
const o1e = gitVersion.indexOf(old1_end, iac_idx);
const old1_text = gitVersion.substring(o1s, o1e);
console.log('Fix 1 old text length:', old1_text.length);
console.log('Fix 1 matches file:', c.includes(old1_text));

const new1_text = `// 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）
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

if (c.includes(old1_text)) {
    c = c.replace(old1_text, new1_text);
    console.log('Fix 1 applied');
} else {
    console.log('Fix 1 NOT applied - pattern not found');
}

// ===== FIX 2: download with redirect + content-type =====
const old2_start = '// 下载并解压 ZIP\n    return new Promise((resolve, reject) => {\n        const file = fs.createWriteStream(zipPath);\n        https.get(realUrl, (res) => {\n            if (res.statusCode !== 200) {\n                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);\n                reject(new Error(\`Download failed: HTTP \${res.statusCode}\`));\n                return;\n            }\n            res.pipe(file);';
const o2s = gitVersion.indexOf(old2_start, iac_idx);
const func_end = gitVersion.indexOf('\n}\n\nasync function installSingleSkill', o2s);
const old2_text = gitVersion.substring(o2s, func_end + 1);
console.log('\nFix 2 old text length:', old2_text.length);
console.log('Fix 2 matches file:', c.includes(old2_text));

const new2_text = `// 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
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

if (c.includes(old2_text)) {
    c = c.replace(old2_text, new2_text);
    console.log('Fix 2 applied');
} else {
    console.log('Fix 2 NOT applied - pattern not found');
    // Try to find what's actually in the file
    const dl_comment = '// 下载并解压 ZIP';
    const dl_idx = c.indexOf(dl_comment);
    console.log('Download comment in file at:', dl_idx);
    if (dl_idx >= 0) {
        console.log('Content after comment:', JSON.stringify(c.substring(dl_idx, dl_idx + 200)));
    }
}

// ===== FIX 3: ZIP fallback with redirect + content-type =====
const iss_idx = gitVersion.indexOf('installSingleSkill');
const old3_start = "info('Puppeteer failed, falling back to ZIP...');\n            const zipUrl";
// Find the start in the git version
const o3s = gitVersion.indexOf(old3_start, iss_idx);
// The ZIP fallback block in installSingleSkill ends at the closing of the Promise
// From the git version, the installSingleSkill function starts at iss_idx
// The ZIP fallback is inside the .catch() handler
// Find where installSingleSkill closes: the function body ends with "    }\n}\n"
// We need to find the block from o3s to the closing of the installSingleSkill Promise
// From the git version, the last "});" before the closing "}" of installSingleSkill closes the Promise
const iss_func_start = gitVersion.indexOf('installSingleSkill');
const iss_func_body_end = gitVersion.lastIndexOf('}', iss_func_start + 2000);
// Find the last "    });" before that
const before_iss_end = gitVersion.substring(0, iss_func_body_end);
const last_promise_close = before_iss_end.lastIndexOf('    });');
const o3e = last_promise_close + 3; // include the "});"
const old3_text = gitVersion.substring(o3s, o3e);
console.log('\nFix 3 old text length:', old3_text.length);
console.log('Fix 3 matches file:', c.includes(old3_text));

const new3_text = `info('Puppeteer failed, falling back to ZIP...');
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

if (c.includes(old3_text)) {
    c = c.replace(old3_text, new3_text);
    console.log('Fix 3 applied');
} else {
    console.log('Fix 3 NOT applied - pattern not found');
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('\nFile written, length:', c.length);
