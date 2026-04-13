const fs = require('fs');
const path = require('path');

const skillsDir = 'C:\\Users\\Administrator\\.openclaw\\workspace\\skills';
const dirs = fs.readdirSync(skillsDir);

for (const dir of dirs) {
  const skillDir = path.join(skillsDir, dir);
  if (!fs.statSync(skillDir).isDirectory()) continue;
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) continue;
  try {
    const c = fs.readFileSync(skillMd, 'utf8');
    // Check for absolute Windows paths or paths with ~
    if (/location|^path\s*:/im.test(c) && /[A-Z]:\\\\|~\//.test(c)) {
      const lines = c.split('\n');
      lines.forEach((line, i) => {
        if (/[A-Z]:\\\\|~\//.test(line)) {
          console.log(dir + ': ' + line.trim().substring(0, 120));
        }
      });
    }
  } catch(e) {}
}
