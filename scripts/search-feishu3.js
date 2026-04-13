const fs = require('fs');
const path = require('path');

// Search all feishu extension files for "streaming start failed" or "Create card"
const dir = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions\\feishu';

const files = fs.readdirSync(dir, { recursive: true })
  .filter(f => (f.endsWith('.js') || f.endsWith('.mjs')) && !f.includes('node_modules\\@'));

for (const f of files) {
  try {
    const fp = path.join(dir, f);
    const c = fs.readFileSync(fp, 'utf8');
    if (/Create card request failed|createMessageToolCardSchema|streaming.*start/i.test(c)) {
      console.log('=== ' + f + ' ===');
      // Find the relevant section
      const lines = c.split('\n');
      lines.forEach((line, i) => {
        if (/Create card request failed|createMessageToolCardSchema|streaming.*start/i.test(line)) {
          console.log('Line ' + (i+1) + ': ' + line.substring(0,300));
        }
      });
      console.log('');
    }
  } catch(e) {}
}
