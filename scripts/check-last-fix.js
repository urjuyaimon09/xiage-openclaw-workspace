const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\Administrator\\.openclaw\\workspace\\health\\health.csv', 'utf8').trim().split('\n');
const last = lines.slice(-15);
last.forEach(l => console.log(l));
