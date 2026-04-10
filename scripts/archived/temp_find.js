const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl') && f !== 'sessions.json');

const needle = '马斯洛';
let found = [];

for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.includes(needle)) {
        const stats = fs.statSync(path.join(dir, file));
        found.push({ name: file, size: Math.round(stats.size / 1024) + 'KB', time: stats.mtime.toISOString() });
    }
}

console.log(JSON.stringify(found, null, 2));
