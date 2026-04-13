const fs = require('fs');
const path = require('path');

const logRoots = [
  'C:\\Users\\Administrator\\.pm2\\logs',
  path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'openclaw', 'logs')
];

const pattern = /timeout|latency.*\d+ms|upstream.*slow|request.*timeout|response.*timeout/i;
const oneHourAgo = Date.now() - 3600000;

const matches = [];
for (const lp of logRoots) {
  if (!fs.existsSync(lp)) continue;
  for (const f of fs.readdirSync(lp)) {
    if (!f.endsWith('.log')) continue;
    const fp = path.join(lp, f);
    const lines = fs.readFileSync(fp, 'utf8').split('\n');
    for (const line of lines) {
      if (pattern.test(line)) {
        matches.push(line.substring(0, 150));
      }
    }
  }
}

console.log('Total matches:', matches.length);
console.log('\nFirst 10:');
matches.slice(0, 10).forEach((m, i) => console.log(i + 1, m));
console.log('\nLast 5:');
matches.slice(-5).forEach((m, i) => console.log(i + 1, m));

// Count unique patterns
const byPattern = {};
matches.forEach(m => {
  if (/timeout/i.test(m) && !/latency/i.test(m)) byPattern.timeout = (byPattern.timeout || 0) + 1;
  else if (/latency/i.test(m)) byPattern.latency = (byPattern.latency || 0) + 1;
  else byPattern.other = (byPattern.other || 0) + 1;
});
console.log('\nBy pattern type:', byPattern);
