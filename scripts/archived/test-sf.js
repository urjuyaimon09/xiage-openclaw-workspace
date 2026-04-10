const https = require('https');

const data = JSON.stringify({
    model: "stepfun-ai/Step-3.5-Flash",
    messages: [{ role: "user", content: "说一句话介绍你自己" }],
    max_tokens: 50
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
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
    });
});

req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();
