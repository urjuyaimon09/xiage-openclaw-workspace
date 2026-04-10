const https = require('https');

const options = {
    hostname: 'api.siliconflow.cn',
    path: '/v1/models',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer sk-rmvhdsiznvsbsqkdjohzwhcndpciuqeckbtowkgzplbktcim'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        const data = JSON.parse(body);
        // 过滤出免费或低价的模型
        const models = data.data || [];
        models.forEach(m => {
            const id = m.id || '';
            console.log(id);
        });
    });
});

req.on('error', e => console.error('Error:', e.message));
req.end();
