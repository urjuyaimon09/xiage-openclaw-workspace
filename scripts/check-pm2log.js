const fs = require('fs');
const l = fs.readFileSync('C:\\Users\\Administrator\\.pm2\\pm2.log', 'utf8').split('\n').slice(-15).join('\n');
console.log(l);
