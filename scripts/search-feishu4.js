const fs = require('fs');
const path = require('path');

// Find channel-actions file
const dir = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions\\feishu';
const files = fs.readdirSync(dir, { recursive: true })
  .filter(f => f.includes('channel-actions') && (f.endsWith('.js') || f.endsWith('.mjs')));

console.log('Found:', files);

for (const f of files) {
  try {
    const fp = path.join(dir, f);
    const c = fs.readFileSync(fp, 'utf8');
    console.log('=== ' + f + ' (' + c.length + ' chars) ===');
    // Find createMessageToolCardSchema
    const idx = c.indexOf('createMessageToolCardSchema');
    if (idx >= 0) {
      console.log(c.substring(Math.max(0,idx-100), idx+500));
    }
  } catch(e) { console.log(e.message); }
}
