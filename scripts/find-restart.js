const fs = require('fs');
const c = fs.readFileSync('C:\\Users\\Administrator\\.openclaw\\workspace\\scripts\\gateway-fix.js', 'utf8');
const matches = c.match(/pm2 restart|gateway.*restart|process.*kill|execSync.*restart/i) || [];
console.log('Found:', matches.length ? matches.join('\n') : 'none');
