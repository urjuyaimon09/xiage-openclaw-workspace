const fs = require('fs');
const path = require('path');

// Search in extensions root
const extDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\extensions';
const allFiles = fs.readdirSync(extDir, { recursive: true })
  .filter(f => (f.endsWith('.js') || f.endsWith('.mjs')) && f.includes('channel-actions'));

console.log('channel-actions files:', allFiles);

// Also look for the specific file
const files = fs.readdirSync(extDir, { recursive: false });
console.log('Extensions top-level:', files);
