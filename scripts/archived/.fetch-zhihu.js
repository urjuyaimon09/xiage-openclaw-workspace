const https = require('https');
https.get({
    hostname: 'www.zhihu.com',
    path: '/p/2018267502753362635',
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    }
}, (res) => {
    console.log('Status:', res.statusCode, 'Location:', res.headers.location || '');
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
        console.log('Title:', titleMatch ? titleMatch[1] : 'not found');
        console.log('HTML length:', data.length);
        // Try to find article content
        const bodyMatch = data.match(/"content":"([^"]{100,})"/);
        if (bodyMatch) {
            console.log('Content found:', bodyMatch[1].slice(0, 1000));
        } else {
            // Try meta description
            const descMatch = data.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
            console.log('Meta desc:', descMatch ? descMatch[1] : 'not found');
        }
    });
}).on('error', e => console.log('ERR:', e.message));
