const fs = require('fs');
const path = require('path');

const sdkDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions\\feishu\\node_modules\\@larksuiteoapi\\node-sdk';
let found = 0;

function searchDir(dir) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        searchDir(fullPath);
      } else if (item.name.endsWith('.js')) {
        try {
          const c = fs.readFileSync(fullPath, 'utf8');
          if (/create.*card|CreateCard|card.*instance/i.test(c)) {
            console.log('=== ' + fullPath + ' ===');
            const lines = c.split('\n');
            lines.forEach((line, i) => {
              if (/create.*card|CreateCard|card.*instance/i.test(line)) {
                console.log('Line ' + (i+1) + ': ' + line.trim().substring(0, 200));
              }
            });
            console.log('');
            found++;
          }
        } catch(e) {}
      }
    }
  } catch(e) { console.log('Error: ' + e.message); }
}

searchDir(sdkDir);
console.log('Total files with card creation:', found);
