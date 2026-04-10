const fs = require('fs');
const path = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// The issue: lines 341-379 (1-indexed) are orphaned old parseClawhubFromJson body
// We want to find:
const startLine = '            const skipSet = new Set([\'SKILL\',\'SUMMARY\',\'AUTHOR\',\'STATS\',\'Cards\',\'Highlighted\',';
const endLine = '        fs.writeFileSync(tmpClawhubJson, JSON.stringify(clawhubSkills, null, 2), \'utf8\');';

const startIdx = lines.findIndex(l => l.startsWith('            const skipSet = new Set([\'SKILL\''));
const endIdx = lines.findIndex(l => l.includes('JSON.stringify(clawhubSkills'));

console.log('startIdx:', startIdx, 'line:', JSON.stringify(lines[startIdx]));
console.log('endIdx:', endIdx, 'line:', JSON.stringify(lines[endIdx]));

// Remove lines startIdx+1 through endIdx-1 (keep startIdx and endIdx lines themselves)
// Actually we want to REMOVE lines from startIdx to endIdx-1 (the orphaned body)
// But keep lines startIdx and endIdx which are the boundaries
if (startIdx >= 0 && endIdx >= 0 && endIdx > startIdx) {
    console.log(`Removing lines ${startIdx+1}-${endIdx} (orphaned old parseClawhubFromJson body)`);
    const newLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx)];
    fs.writeFileSync(path, newLines.join('\n'), 'utf8');
    console.log('Done. New line count:', newLines.length);
} else {
    console.log('Could not find both boundaries. startIdx:', startIdx, 'endIdx:', endIdx);
    console.log('Current lines around 340:');
    for(let i=338;i<345;i++) console.log(i+1, JSON.stringify(lines[i]));
    console.log('Current lines around 378:');
    for(let i=376;i<383;i++) console.log(i+1, JSON.stringify(lines[i]));
}
