const fs = require('fs');
const path = require('path');

// Search ALL .jsonl files (not just sessions) for any Chinese content
// Also search the sessions.json which is 3.8MB
const files = fs.readdirSync('C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\')
    .filter(f => f.endsWith('.jsonl'));

const searchTerms = ['月收入', '存款', '绩效C', '300万', '比特币', '养老', '焦虑'];

for (const file of files) {
    const fpath = path.join('C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\', file);
    const stats = fs.statSync(fpath);
    if (stats.size < 1000) continue; // skip tiny files
    
    const content = fs.readFileSync(fpath, 'utf8');
    for (const term of searchTerms) {
        if (content.includes(term)) {
            const idx = content.indexOf(term);
            const start = Math.max(0, idx - 200);
            const end = Math.min(content.length, idx + 200);
            console.log(`\n>>> ${file} (${Math.round(stats.size/1024)}KB) contains '${term}' at ${idx}:`);
            console.log(content.substring(start, end));
            break;
        }
    }
}

// Also search sessions.json
const sjPath = 'C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\sessions.json';
if (fs.existsSync(sjPath)) {
    const stats = fs.statSync(sjPath);
    console.log(`\nSearching sessions.json (${Math.round(stats.size/1024)}KB)...`);
    const content = fs.readFileSync(sjPath, 'utf8');
    for (const term of searchTerms) {
        if (content.includes(term)) {
            const idx = content.indexOf(term);
            const start = Math.max(0, idx - 100);
            const end = Math.min(content.length, idx + 200);
            console.log(`\n>>> sessions.json contains '${term}' at ${idx}:`);
            console.log(content.substring(start, end));
            break;
        }
    }
}
