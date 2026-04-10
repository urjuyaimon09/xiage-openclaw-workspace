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
                try { resolve(JSON.parse(data)); }
                catch(e) { resolve({raw: data.substring(0, 500)}); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function main() {
    // Search for iampennyli/ima-skills on GitHub
    const r = await get('/search/code?q=ima-skills+user:iampennyli');
    if (r.items) {
        console.log('Found:', JSON.stringify(r.items.map(i=>({name:i.name,path:i.path,url:i.html_url})),null,2));
    } else {
        console.log('Not found on GitHub');
    }
}

main().catch(console.log);
