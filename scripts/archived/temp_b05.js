const fs = require('fs');
const path = require('path');

const fpath = 'C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\b05ed96c-e2cc-4f5d-8b7a-d20690e79f9e.jsonl';
const content = fs.readFileSync(fpath, 'utf8');

// Find the session start markers
const sessionStart = content.indexOf('"timestamp":"2026-03-29');
const sessionStart2 = content.indexOf('"timestamp":"2026-03-30');

// Find user messages - just show the text field of any user message
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);
console.log(`Session marker (March 29): position ${sessionStart}`);
console.log(`Session marker (March 30): position ${sessionStart2}`);

let userMsgs = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('"role":"user"')) {
        try {
            const obj = JSON.parse(line);
            const text = obj.message?.content?.[0]?.text || '';
            const ts = obj.message?.timestamp || '';
            if (text && text.length > 20) {
                userMsgs.push({ line: i, ts, len: text.length, preview: text.substring(0, 100) });
            }
        } catch {}
    }
}

console.log(`\nUser messages found: ${userMsgs.length}`);
userMsgs.forEach((m, idx) => {
    console.log(`\n--- User Msg ${idx+1} [line ${m.line}] [${m.ts}] [${m.len} chars] ---`);
    console.log(m.preview);
});
