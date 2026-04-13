const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions\\feishu';

try {
  const files = fs.readdirSync(dir, { recursive: true })
    .filter(f => (f.endsWith('.js') || f.endsWith('.mjs')) && !f.includes('node_modules\\@types'));
  
  for (const f of files) {
    try {
      const fp = path.join(dir, f);
      const c = fs.readFileSync(fp, 'utf8');
      if (/CreateCard|createCard|card.*request|streaming start failed|Create.*card/i.test(c)) {
        console.log('=== ' + f + ' ===');
        const idx = c.search(/CreateCard|createCard|card.*request|Create.*card/i);
        console.log(c.substring(Math.max(0, idx-50), idx+300));
        console.log('');
      }
    } catch(e) {}
  }
} catch(e) { console.log(e.message); }
