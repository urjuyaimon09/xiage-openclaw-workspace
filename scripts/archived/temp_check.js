const fs = require('fs');
const path = require('path');

// Check the reset file - it might have the pre-compaction content
const resetFile = 'C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\da3c0812-288f-44a6-a975-daf602fe1671.jsonl.reset.2026-03-29T20-24-35.507Z';

if (fs.existsSync(resetFile)) {
    const stats = fs.statSync(resetFile);
    console.log(`Reset file exists: ${Math.round(stats.size/1024)}KB`);
    
    // Check if it's a ZIP
    const fd = fs.openSync(resetFile, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    console.log(`Magic bytes: ${buf.toString('hex')}`);
    
    if (buf.toString('hex') === '504b0304') {
        console.log('It is a ZIP file!');
        // Try to unzip
        const AdmZip = require('adm-zip');
        try {
            const zip = new AdmZip(resetFile);
            const entries = zip.getEntries();
            console.log(`ZIP entries: ${entries.length}`);
            entries.forEach(e => console.log(`  ${e.entryName} (${e.header.size} bytes)`));
        } catch(e) {
            console.log(`AdmZip error: ${e.message}`);
        }
    }
} else {
    console.log('Reset file does not exist');
}

// Also check the sessions before 20:24 (pre-reset) for actual user data
const preFiles = [
    'dc8de43f-a802-4e78-a1d8-4c780a372774.jsonl',
    '17176133-3321-4413-9138-a0dd64c822e9.jsonl',
    '4c042d81-8182-4121-a6bd-74b52ee13d16.jsonl'
];

const dataPatterns = ['月收入', '存款', '工资', '绩效', '股票', '投资', '债务', '焦虑', '豚豚'];

for (const fname of preFiles) {
    const fpath = path.join('C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\', fname);
    const content = fs.readFileSync(fpath, 'utf8');
    for (const pattern of dataPatterns) {
        if (content.includes(pattern)) {
            const idx = content.indexOf(pattern);
            const start = Math.max(0, idx - 200);
            const end = Math.min(content.length, idx + 300);
            console.log(`\n>>> Found '${pattern}' in ${fname} at ${idx}:`);
            console.log(content.substring(start, end));
            break;
        }
    }
}
