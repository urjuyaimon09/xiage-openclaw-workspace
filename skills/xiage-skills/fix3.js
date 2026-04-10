const fs = require('fs');
const filePath = "C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\xiage-skills.js";
let c = fs.readFileSync(filePath, 'utf8');

// Fix 2: Add redirect + content-type to the Puppeteer download section
// The comment and code from the actual file
const old2 = `// 下载并解压 ZIP
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

const new2 = `// 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
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
    console.log('Fix 2 applied: Puppeteer download redirect + content-type');
} else {
    console.log('Fix 2: exact match not found, trying partial...');
    if (c.includes('https.get(realUrl, (res) => {')) {
        console.log('Found https.get(realUrl), applying partial fix...');
        // Partial fix: just add redirect handling
        const partialOld = `https.get(realUrl, (res) => {
            if (res.statusCode !== 200) {
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                reject(new Error(\`Download failed: HTTP \${res.statusCode}\`));
                return;
            }
            res.pipe(file);`;
        const partialNew = `https.get(realUrl, (res) => {
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
                res.pipe(file);`;
        if (c.includes(partialOld)) {
            c = c.replace(partialOld, partialNew);
            console.log('Partial fix 2 applied');
        } else {
            console.log('Partial fix 2 also not found');
            console.log('Checking for partialOld presence:');
            console.log('  https.get(realUrl:', c.includes('https.get(realUrl'));
            console.log('  res.statusCode !== 200:', c.includes('res.statusCode !== 200'));
        }
    }
}

// Fix 3: ZIP fallback - check for followAllRedirects
if (c.includes('followAllRedirects')) {
    console.log('followAllRedirects found - needs fix');
} else {
    // Find and show the ZIP fallback section
    const zidx = c.indexOf('Puppeteer failed, falling back to ZIP');
    if (zidx > 0) {
        console.log('ZIP fallback section found at', zidx);
        const chunk = c.substring(zidx, zidx + 1000);
        console.log(JSON.stringify(chunk.substring(0, 500)));
    }
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('Done');
