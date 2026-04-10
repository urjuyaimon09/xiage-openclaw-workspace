process.env.TAVILY_API_KEY = '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';
import https from 'https';

const url = process.argv[2] || 'https://zhuanlan.zhihu.com/p/2018267502753362635';

const body = JSON.stringify({
    api_key: process.env.TAVILY_API_KEY,
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
                console.log(`\n=== 提取内容 ===\n`);
                console.log(result.raw_content || result.content || '无内容');
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
