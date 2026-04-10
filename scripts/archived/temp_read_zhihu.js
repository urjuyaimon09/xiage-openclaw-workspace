const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/Administrator/.openclaw/workspace/temp_zhihu';

function walk(d, prefix='') {
  const items = fs.readdirSync(d);
  for (const item of items) {
    const full = path.join(d, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, prefix + '  ');
    } else {
      const c = fs.readFileSync(full, 'utf8');
      console.log(c);
    }
  }
}

walk(dir);
