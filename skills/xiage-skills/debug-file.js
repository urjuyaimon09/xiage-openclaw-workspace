const fs = require('fs');
const content = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex((l, i) => i > 300 && l.includes('const skipSet = new Set'));
console.log('skipSet found at line', idx + 1);
console.log('Lines 333-345:');
for (let i = 333; i < 345; i++) {
    console.log(i + 1, JSON.stringify(lines[i]));
}
console.log('\nLines 388-398:');
for (let i = 387; i < 398; i++) {
    console.log(i + 1, JSON.stringify(lines[i]));
}
