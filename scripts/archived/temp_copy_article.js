const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/Administrator/.openclaw/workspace/temp_zhihu';
const destDir = 'C:/Users/Administrator/.openclaw/workspace/references';

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

// Find the file (ignore garbled dir name, just find the .md file)
const items = fs.readdirSync(srcDir);
let srcFile = null;
for (const item of items) {
  const full = path.join(srcDir, item);
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    const subItems = fs.readdirSync(full);
    for (const sub of subItems) {
      if (sub.endsWith('.md')) {
        srcFile = path.join(full, sub);
        break;
      }
    }
  } else if (item.endsWith('.md')) {
    srcFile = full;
  }
}

if (!srcFile) { console.log('File not found'); process.exit(1); }

const content = fs.readFileSync(srcFile, 'utf8');
const destFile = path.join(destDir, 'openclaw-multi-agent-setup.md');
fs.writeFileSync(destFile, content, 'utf8');
console.log('Saved to:', destFile);
console.log('Size:', content.length, 'chars');
