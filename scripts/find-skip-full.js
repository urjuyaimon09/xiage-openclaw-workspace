const fs = require('fs');

const logFile = 'C:\\Users\\Administrator\\.pm2\\logs\\openclaw-out.log';
const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

// Find lines with "Skipping skill" and show context
let lastSkipLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Skipping skill path')) {
    lastSkipLine = i;
  }
}

// Show last 3 skip occurrences with wider context
let shown = 0;
for (let i = lines.length - 1; i >= 0 && shown < 3; i--) {
  if (lines[i].includes('Skipping skill path')) {
    console.log('=== Skip at line ' + (i+1) + ' ===');
    for (let j = Math.max(0, i-5); j <= Math.min(lines.length-1, i+5); j++) {
      console.log(j+1 + ': ' + lines[j].substring(0, 300));
    }
    console.log('');
    shown++;
  }
}
