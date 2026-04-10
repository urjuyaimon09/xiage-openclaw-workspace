#!/usr/bin/env node

import https from 'https';

const API_KEY = process.env.TAVILY_API_KEY;
if (!API_KEY) {
    console.error('Error: TAVILY_API_KEY environment variable not set');
    console.error('Get your key at https://tavily.com');
    process.exit(1);
}

const args = process.argv.slice(2);
let query = '';
let numResults = 5;
let deep = false;
let topic = 'general';
let days = 7;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n' && args[i + 1]) {
        numResults = parseInt(args[i + 1], 10);
        i++;
    } else if (args[i] === '--deep') {
        deep = true;
    } else if (args[i] === '--topic' && args[i + 1]) {
        topic = args[i + 1];
        i++;
    } else if (args[i] === '--days' && args[i + 1]) {
        days = parseInt(args[i + 1], 10);
        i++;
    } else if (!args[i].startsWith('-')) {
        query = args.slice(i).join(' ');
        break;
    }
}

if (!query) {
    console.error('Usage:');
    console.error('  node search.mjs "query"');
    console.error('  node search.mjs "query" -n 10');
    console.error('  node search.mjs "query" --deep');
    console.error('  node search.mjs "query" --topic news --days 3');
    process.exit(1);
}

const body = JSON.stringify({
    api_key: API_KEY,
    query,
    search_depth: deep ? 'advanced' : 'basic',
    topic,
    max_results: Math.min(numResults, 20),
    ...(topic === 'news' ? { days } : {})
});

const url = new URL('https://api.tavily.com/search');

const options = {
    hostname: url.hostname,
    path: url.pathname,
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
            console.log(`\n=== Tavily Search Results for "${query}" ===\n`);
            for (const result of (json.results || [])) {
                console.log(`## ${result.title || 'No title'}`);
                console.log(`URL: ${result.url}`);
                console.log(`Score: ${(result.score * 100).toFixed(1)}%`);
                console.log(`\n${result.content || ''}`);
                console.log('\n---\n');
            }
            if (json.answer) {
                console.log(`\n=== AI Answer ===\n${json.answer}`);
            }
        } catch (e) {
            console.error('Parse error:', e.message);
            console.error('Response:', data.substring(0, 500));
        }
    });
});

req.on('error', e => {
    console.error('Request error:', e.message);
    process.exit(1);
});

req.setTimeout(30000, () => { req.destroy(); console.error('Timeout'); process.exit(1); });
req.write(body);
req.end();
