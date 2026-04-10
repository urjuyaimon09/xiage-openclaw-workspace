const https = require('https');

const models = [
    "Qwen/Qwen2.5-7B-Instruct",
    "Qwen/Qwen2.5-14B-Instruct",
    "deepseek-ai/DeepSeek-V2.5",
    "deepseek-ai/DeepSeek-Coder-V2-Instruct",
    "mistralai/Mistral-7B-Instruct"
];

async function testModel(model) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: model,
            messages: [{ role: "user", content: "say hi in 5 words or less" }],
            max_tokens: 20
        });

        const options = {
            hostname: 'api.siliconflow.cn',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer sk-rmvhdsiznvsbsqkdjohzwhcndpciuqeckbtowkgzplbktcim',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const resp = JSON.parse(body);
                    if (resp.code) {
                        console.log(model + ': ❌ ' + resp.code + ' - ' + resp.message);
                    } else {
                        console.log(model + ': ✅ ' + resp.choices[0].message.content.trim());
                    }
                } catch(e) {
                    console.log(model + ': ❌ parse error');
                }
                resolve();
            });
        });

        req.on('error', e => { console.log(model + ': ❌ ' + e.message); resolve(); });
        req.write(data);
        req.end();
    });
}

(async () => {
    for (const m of models) {
        await testModel(m);
    }
})();
