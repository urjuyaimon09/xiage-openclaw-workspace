const fs = require('fs');
const path = require('path');

const apiPath = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions\\feishu\\api.js';
const c = fs.readFileSync(apiPath, 'utf8');

// Find streaming related code
const idx = c.indexOf('streaming');
if (idx >= 0) console.log(c.substring(Math.max(0,idx-200), idx+500));
