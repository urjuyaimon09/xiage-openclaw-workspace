const fs = require('fs');

const logFile = 'C:\\Users\\Administrator\\.pm2\\logs\\openclaw-out.log';
const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

// Find lines around SKILLS_SKIP
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Skipping skill path that resolves outside')) {
    console.log('--- Context ---');
    for (let j = Math.max(0, i-3); j <= Math.min(lines.length-1, i+3); j++) {
      console.log(j+1 + ': ' + lines[j].substring(0, 200));
    }
    console.log('');
  }
}
