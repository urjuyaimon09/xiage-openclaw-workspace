const https = require('https');
const fs = require('fs');

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: { 'User-Agent': 'node' }
        };
        const req = https.request(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(download(res.headers.location, dest));
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                fs.writeFileSync(dest, buf);
                resolve(buf.length);
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

download('https://wry-manatee-359.convex.site/api/v1/download?slug=ima-skills&author=iampennyli', 'C:/Users/Administrator/.openclaw/workspace/skills/ima-skills.zip')
    .then(size => console.log(`Downloaded ${size} bytes`))
    .catch(e => console.error('Error:', e.message));
