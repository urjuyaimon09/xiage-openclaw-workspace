const fs = require('fs');

const apiPath = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions\\feishu\\api.js';
const content = fs.readFileSync(apiPath, 'utf8');

// Find all occurrences of the error string
let idx = content.indexOf('Create card request failed');
while (idx >= 0) {
  console.log('--- context ---');
  console.log(content.substring(Math.max(0, idx-200), idx+300));
  console.log('');
  idx = content.indexOf('Create card request failed', idx+1);
}
