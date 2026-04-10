const fs = require('fs');
const path = require('path');

const resetFile = 'C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\da3c0812-288f-44a6-a975-daf602fe1671.jsonl.reset.2026-03-29T20-24-35.507Z';
const content = fs.readFileSync(resetFile, 'utf8');

// Find actual user message content with personal data
const dataPatterns = ['月收入', '年收入', '存款', '工资', '绩效', '股票', '投资', '债务', '焦虑', '压力', '父亲', '母亲', '豚豚'];

for (const pattern of dataPatterns) {
    if (content.includes(pattern)) {
        const idx = content.indexOf(pattern);
        const start = Math.max(0, idx - 300);
        const end = Math.min(content.length, idx + 200);
        console.log(`\n=== Found '${pattern}' ===`);
        console.log(content.substring(start, end));
        console.log('...');
    }
}
