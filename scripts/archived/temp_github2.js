const https = require('https');

// First check if ralph-loop exists in the monorepo
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
                try { resolve(JSON.parse(data)); } 
                catch(e) { resolve({raw: data.substring(0, 300)}); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function main() {
    // Try to list the skills directory (first 100 entries)
    try {
        const r = await get('/repos/openclaw/skills/contents/skills?per_page=100');
        if (Array.isArray(r)) {
            const ralph = r.filter(f => f.name && f.name.includes('ralph'));
            console.log('Found Ralph entries:', JSON.stringify(ralph, null, 2));
            console.log('Total skills in first 100:', r.length);
        } else {
            console.log('Response:', JSON.stringify(r).substring(0, 500));
        }
    } catch(e) {
        console.log('Error:', e.message);
    }
}

main();
