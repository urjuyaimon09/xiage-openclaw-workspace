const fs = require('fs');
const path = require('path');

const searchDir = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist';
const searchTerm = 'volcengine|VOLCENGINE|ark';

function searchDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      searchDirectory(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = new RegExp(searchTerm, 'i');
      if (regex.test(content)) {
        console.log(`Found in: ${fullPath}`);
        // 输出包含关键词的行
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (regex.test(line)) {
            console.log(`  ${i + 1}: ${line.trim()}`);
          }
        });
        console.log();
      }
    }
  }
}

console.log(`Searching for ${searchTerm} in ${searchDir}...\n`);
searchDirectory(searchDir);
