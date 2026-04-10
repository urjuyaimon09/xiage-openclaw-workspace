const fs = require('fs');
const html = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/skills/.tmp-sh-openclaw-openclaw.html', 'utf8');

// Count skills.sh style links
const shSkillRe = /href="\/openclaw\/openclaw\/([^"?\s]+)"/g;
let m, count = 0;
while ((m = shSkillRe.exec(html)) !== null) count++;
console.log('skills.sh /openclaw/openclaw/{skill} links:', count);

// Also find install counts - they appear in spans near the skill links
// Try to extract skill name + install pairs
const installRe = /href="\/openclaw\/openclaw\/([^"?\s]+)"[^>]*>[\s\S]*?<span[^>]*>([\d.]+[KMB]?)<\/span>/g;
count = 0;
while ((m = installRe.exec(html)) !== null) count++;
console.log('skill+install pairs found:', count);

// Look at all /owner/repo/ patterns to understand structure
const allRe = /href="\/([^\/]+)\/([^\/]+)\/([^"?\s]+)"/g;
const seen = new Set();
while ((m = allRe.exec(html)) !== null) {
  seen.add(`${m[1]}/${m[2]}/${m[3]}`);
}
console.log('Unique /owner/repo/skill links:', seen.size);
// Print first 5
const arr = Array.from(seen).slice(0, 5);
console.log('Examples:', arr);
