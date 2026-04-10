const https = require('https');

function get(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path,
            method: 'GET',
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'node' }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({status: res.statusCode, data: JSON.parse(data)}); } 
                catch(e) { resolve({status: res.statusCode, data: data.substring(0, 500)}); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function main() {
    // Get root directory
    const r = await get('/repos/openclaw/skills/contents/');
    if (r.status === 200 && Array.isArray(r.data)) {
        console.log('Root entries:', r.data.map(e => e.name).join(', '));
    } else {
        console.log('Root response:', JSON.stringify(r.data).substring(0, 300));
    }
}

main().catch(console.log);
