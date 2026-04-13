const fs = require('fs');

const sdkPath = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions\\feishu\\node_modules\\@larksuiteoapi\\node-sdk\\lib\\index.js';
const c = fs.readFileSync(sdkPath, 'utf8');

// Find createByCard implementation
const lines = c.split('\n');
lines.forEach((line, i) => {
  if (i >= 60970 && i <= 61050) {
    console.log('Line ' + (i+1) + ': ' + line);
  }
});
