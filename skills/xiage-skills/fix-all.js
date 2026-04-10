const fs = require('fs');
const path = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// 1. Replace lines 374-395 (parseClawhub) with parseClawhubFromJson
// Lines are 1-indexed, so 374-395 = indices 373-394
const newParseClawhub = [
    '    function parseClawhubFromJson(jsonPath) {',
    '        try {',
    '            const data = JSON.parse(fs.readFileSync(jsonPath, \'utf8\'));',
    '            return data.map(s => ({',
    '                name: s.name,',
    '                author: s.author,',
    '                downloads: s.downloads || 0,',
    '                stars: s.stars || 0,',
    '                url: `https://clawhub.ai/${s.author}/${s.name}`',
    '            }));',
    '        } catch (e) {',
    '            warn(`Failed to parse clawhub JSON: ${e.message}`);',
    '            return [];',
    '        }',
    '    }'
];

// Replace lines 374-395 (1-indexed) = indices 373-394
const before = lines.slice(0, 373);  // lines 1-373
const after = lines.slice(395);       // from line 396 onwards
const newLines = [...before, ...newParseClawhub, ...after];
console.log(`Replaced lines 374-395 with parseClawhubFromJson`);

// 2. Replace the clawhubHtml/parseClawhub invocation
// Find the line with "const clawhubHtml = fs.readFileSync(tmpClawhub"
const clawhubIdx = newLines.findIndex((l, i) => i >= 395 && l.includes('tmpClawhub') && l.includes('clawhubHtml'));
console.log(`Found clawhubHtml line at index ${clawhubIdx + 1}: ${newLines[clawhubIdx]}`);
const nextLine = newLines[clawhubIdx + 1];
console.log(`Next line: ${nextLine}`);

// Replace these two lines with one line
const newClawhubInvoke = '        const clawhubJson = parseClawhubFromJson(tmpClawhubJson);';
const newerLines = [
    ...newLines.slice(0, clawhubIdx),
    newClawhubInvoke,
    ...newLines.slice(clawhubIdx + 2)
];
console.log(`Replaced clawhub invocation`);

const newContent = newerLines.join('\n');
fs.writeFileSync(path, newContent, 'utf8');
console.log(`Done. New line count: ${newerLines.length}`);
