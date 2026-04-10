const https = require('https');

function httpsGet(hostname, path) {
    return new Promise((resolve, reject) => {
        const options = { hostname, path, method: 'GET', headers: { 'User-Agent': 'node' } };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    // Follow redirect
                    const redirectUrl = new URL(res.headers.location);
                    httpsGet(redirectUrl.hostname, redirectUrl.pathname).then(resolve).catch(reject);
                } else {
                    resolve({ status: res.statusCode, headers: res.headers, data });
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function main() {
    try {
        // Try the Convex download endpoint directly
        const r = await httpsGet('wry-manatee-359.convex.site', '/api/v1/download?slug=ima-skills&author=iampennyli');
        console.log('Status:', r.status);
        console.log('Content-Type:', r.headers['content-type']);
        console.log('Data (first 300):', r.data.substring(0, 300));
    } catch(e) {
        console.log('Error:', e.message);
    }
}

main();
