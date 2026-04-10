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
    // Try different possible paths
    const paths = [
        '/repos/openclaw/skills/contents/skills/ralph-loop',
        '/repos/openclaw/skills/contents/ralph-loop',
    ];
    for (const p of paths) {
        const r = await get(p);
        if (r.status === 200) {
            console.log(`${p}: Found!`, JSON.stringify(r.data).substring(0, 200));
        } else {
            console.log(`${p}: ${r.status}`);
        }
    }
}

main().catch(console.log);
