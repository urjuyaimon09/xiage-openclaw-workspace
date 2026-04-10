const fs = require('fs');
const path = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Find the orphaned old parseClawhubFromJson body (starts with "const skipSet = new Set" at line 341)
// and ends before "fs.writeFileSync(tmpClawhubJson, JSON.stringify(clawhubSkills" at line 380
const startIdx = lines.findIndex((l, i) => i >= 340 && l.includes('const skipSet = new Set'));
const endIdx = lines.findIndex((l, i) => i >= 380 && l.includes("fs.writeFileSync(tmpClawhubJson, JSON.stringify(clawhubSkills"));

console.log(`Found orphaned parseClawhubFromJson body at lines ${startIdx+1}-${endIdx+1}`);
console.log(`START: ${JSON.stringify(lines[startIdx])}`);
console.log(`END: ${JSON.stringify(lines[endIdx])}`);

// Remove lines 341-379 (0-indexed: 340-378)
const newLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx)];
fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log(`Removed lines ${startIdx+1}-${endIdx+1}, new line count: ${newLines.length}`);
