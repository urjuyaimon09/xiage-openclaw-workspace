const fs = require('fs');
const path = require('path');

// Search for "Create card request failed" across all extensions
const extDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions';
const results = [];

function searchDir(dir) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && !item.name.startsWith('node_modules\\@')) {
        searchDir(fullPath);
      } else if ((item.name.endsWith('.js') || item.name.endsWith('.mjs'))) {
        try {
          const c = fs.readFileSync(fullPath, 'utf8');
          if (/Create card request failed|createMessageToolCardSchema|CreateCard.*400/i.test(c)) {
            results.push(fullPath);
          }
        } catch(e) {}
      }
    }
  } catch(e) {}
}

searchDir(extDir);
console.log('Found', results.length, 'files');
results.forEach(r => console.log(r));
