const fs = require('fs');
const path = require('path');

// Check the small sessions for user messages with 马斯洛
const targetFiles = [
    '162af29a-4711-4238-8ced-f3ff2d020528.jsonl',  // 23:25 - right during demand model
    '6fb5449a-1351-4a8d-af70-1fa2171f1383.jsonl',  // 23:55
    'dc8de43f-a802-4e78-a1d8-4c780a372774.jsonl',  // 17:25
    '6d3dc01e-fc58-4b35-9b4d-d3fb187e0555.jsonl',  // 20:25
];

const needle = '马斯洛';

for (const fname of targetFiles) {
    const fpath = path.join('C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\', fname);
    const content = fs.readFileSync(fpath, 'utf8');
    const idx = content.indexOf(needle);
    if (idx !== -1) {
        // Get 500 chars before and after
        const start = Math.max(0, idx - 800);
        const end = Math.min(content.length, idx + 500)
        console.log(`\n=== ${fname} (around position ${idx}) ===`);
        console.log(content.substring(start, end).substring(0, 1300));
    }
}
