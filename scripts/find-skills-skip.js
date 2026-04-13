const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\Administrator\\.pm2\\logs\\openclaw-out.log', 'utf8').split('\n');
const skips = lines.filter(l => l.includes('Skipping skill path'));
console.log('Total SKILLS_SKIP in log:', skips.length);
console.log('\nLast 5 occurrences:');
skips.slice(-5).forEach(l => console.log(l));
