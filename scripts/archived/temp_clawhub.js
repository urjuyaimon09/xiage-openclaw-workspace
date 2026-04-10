const https = require('https');

function get(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'clawhub.ai',
            path,
            method: 'GET',
            headers: { 'User-Agent': 'node' }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { resolve({raw: data.substring(0, 500)}); }
            });
        });
        req.on('error', reject);
        req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function main() {
    // Try clawhub API for download
    try {
        const r = await get('/api/v1/download?slug=ima-skills&author=iampennyli');
        console.log('API response:', JSON.stringify(r).substring(0, 500));
    } catch(e) {
        console.log('API error:', e.message);
    }
}

main();
