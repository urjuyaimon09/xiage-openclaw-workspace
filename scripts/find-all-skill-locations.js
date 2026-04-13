const fs = require('fs');
const path = require('path');

const skillsDir = 'C:\\Users\\Administrator\\.openclaw\\workspace\\skills';
const dirs = fs.readdirSync(skillsDir);

for (const dir of dirs) {
  const skillDir = path.join(skillsDir, dir);
  if (!fs.statSync(skillDir).isDirectory()) continue;
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) { console.log(dir + ': NO SKILL.md'); continue; }
  const c = fs.readFileSync(skillMd, 'utf8');
  const locMatch = c.match(/^location:\s*(.+)$/m);
  if (locMatch) {
    console.log(dir + ': ' + locMatch[1].trim());
  } else {
    console.log(dir + ': (no location field)');
  }
}
