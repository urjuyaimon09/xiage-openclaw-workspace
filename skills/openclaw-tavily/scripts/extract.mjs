#!/usr/bin/env node

import https from 'https';

const API_KEY = process.env.TAVILY_API_KEY;
if (!API_KEY) {
    console.error('Error: TAVILY_API_KEY environment variable not set');
    process.exit(1);
}

const url = process.argv[2];
if (!url) {
    console.error('Usage: node extract.mjs "https://example.com/article"');
    process.exit(1);
}

const body = JSON.stringify({
    api_key: API_KEY,
    urls: [url]
});

const options = {
    hostname: 'api.tavily.com',
    path: '/extract',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.detail) {
                console.error('API Error:', json.detail);
                process.exit(1);
            }
            for (const result of (json.results || [])) {
                console.log(`\n=== Extracted from ${result.url} ===\n`);
                console.log(result.raw_content || result.content || 'No content extracted');
            }
        } catch (e) {
            console.error('Parse error:', e.message);
            console.error('Response:', data.substring(0, 500));
        }
    });
});

req.on('error', e => { console.error('Request error:', e.message); process.exit(1); });
req.setTimeout(30000, () => { req.destroy(); console.error('Timeout'); process.exit(1); });
req.write(body);
req.end();
