const fs = require('fs');
const c = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js', 'utf8');

const marker1 = '// 找到 "Download zip" 链接\n    const downloadLink';
const marker2 = '// 下载并解压 ZIP\n    return new Promise';
const marker3 = "info('Puppeteer failed, falling back to ZIP";

console.log('marker1 at:', c.indexOf(marker1));
console.log('marker2 at:', c.indexOf(marker2));
console.log('marker3 at:', c.indexOf(marker3));

// Show the actual ZIP fallback section
const fbIdx = c.indexOf(marker3);
if (fbIdx > 0) {
    const chunk = c.substring(fbIdx, fbIdx + 1500);
    console.log('\nZIP fallback section:');
    console.log(JSON.stringify(chunk.slice(0, 800)));
}
