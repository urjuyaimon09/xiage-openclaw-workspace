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
                try { 
                    const parsed = JSON.parse(data);
                    resolve({status: res.statusCode, data: parsed}); 
                } catch(e) { 
                    resolve({status: res.statusCode, data: data.substring(0, 1000)}); 
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function main() {
    // Check skills/ralph-loop with ref parameter
    const paths = [
        '/repos/openclaw/skills/contents/skills/ralph-loop?ref=main',
        '/repos/openclaw/skills/contents/skills/ralph-loop/refs/heads/main',
    ];
    for (const p of paths) {
        const r = await get(p);
        console.log(`${p}: ${r.status}`);
        if (r.status === 200) {
            console.log(JSON.stringify(r.data).substring(0, 500));
        }
    }
}

main().catch(console.log);
