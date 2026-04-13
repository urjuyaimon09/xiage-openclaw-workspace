const fs = require('fs');
const path = require('path');

const skillsDir = 'C:\\Users\\Administrator\\.openclaw\\workspace\\skills';
const dirs = fs.readdirSync(skillsDir);
const results = [];

for (const dir of dirs) {
  const skillDir = path.join(skillsDir, dir);
  if (!fs.statSync(skillDir).isDirectory()) continue;
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) continue;
  const c = fs.readFileSync(skillMd, 'utf8');
  const locMatch = c.match(/^location:\s*(.+)$/m);
  if (locMatch) {
    const loc = locMatch[1].trim();
    if (loc.includes('~/') || loc.includes('C:\\') || loc.includes('/Users/')) {
      results.push({ skill: dir, location: loc });
    }
  }
}

console.log('Skills with ~/ or absolute paths in location:');
results.forEach(r => console.log(r.skill + ': ' + r.location));
