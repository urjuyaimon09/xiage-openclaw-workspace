const https = require('https');
const query = 'OpenClaw 进阶配置保姆级教程 大模型爱好者社区';
https.get({
    hostname: 'www.bing.com',
    path: '/search?q=' + encodeURIComponent(query),
    headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36'}
}, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        // Find zhihu links
        const zhihuRe = /href="(https:\/\/[^*"]*zhihu[^*"]*)"/g;
        const matches = [...data.matchAll(zhihuRe)];
        console.log('Zhihu links found:', matches.slice(0,5).map(m => m[1]));
        const titleRe = /<title>([^<]+)<\/title>/i;
        const titleMatch = data.match(titleRe);
        console.log('Page title:', titleMatch ? titleMatch[1] : 'not found');
        // Find any useful links
        const linkRe = /href="(https:\/\/[^"]+)"/g;
        const allLinks = [...data.matchAll(linkRe)].map(m => m[1]).filter(l => !l.includes('bing') && !l.includes('microsoft'));
        console.log('Links:', allLinks.slice(0, 10));
    });
}).on('error', e => console.log('ERR:', e.message));
