const fs = require('fs');
const c = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js', 'utf8');

// Find installSingleSkill
const issIdx = c.indexOf('async function installSingleSkill');
console.log('installSingleSkill at:', issIdx);

// Find where the function closes
let brace = 0;
let inString = false;
let escape = false;
let startCounting = false;
for (let i = issIdx; i < c.length; i++) {
    const ch = c[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') { brace++; startCounting = true; }
    if (ch === '}') {
        brace--;
        if (startCounting && brace === 0) {
            console.log('Function closes at position:', i);
            console.log('Context:', JSON.stringify(c.substring(i - 100, i + 50)));
            break;
        }
    }
}

// Also look at the section from line 780-795
const lines = c.split('\n');
console.log('\nLines 779-795:');
for (let i = 778; i < 795; i++) {
    if (lines[i]) console.log(i+1, lines[i]);
}

// Also look at the installSingleSkill function structure
console.log('\nLines around installSingleSkill start:');
for (let i = 700; i < 720; i++) {
    if (lines[i]) console.log(i+1, lines[i]);
}
