process.env.TAVILY_API_KEY = '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';
import https from 'https';

const query = process.argv[2] || 'OpenClaw AGENTS.md 记忆系统 子Agent 配置教程';
const numResults = parseInt(process.argv[3] || '10');

const body = JSON.stringify({
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: 'comprehensive',
    topic: 'general',
    max_results: numResults,
    include_answer: true,
    include_raw_content: false
});

const options = {
    hostname: 'api.tavily.com',
    path: '/search',
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
            if (json.detail) { console.error('API Error:', json.detail); process.exit(1); }
            console.log(`\n=== 「${query}」===\n`);
            if (json.answer) { console.log(`【AI 总结】\n${json.answer}\n`); }
            for (const r of (json.results || [])) {
                if (!r.url.includes('zhihu')) continue;
                console.log(`## ${r.title || ''}`);
                console.log(`🔗 ${r.url}`);
                console.log(`📊 相关度：${(r.score * 100).toFixed(0)}%`);
                console.log(`\n${r.content || ''}`);
                console.log(`\n---\n`);
            }
        } catch (e) {
            console.error('Error:', e.message);
        }
    });
});

req.on('error', e => { console.error('Request error:', e.message); process.exit(1); });
req.setTimeout(30000, () => { req.destroy(); console.error('Timeout'); process.exit(1); });
req.write(body);
req.end();
