const fs = require('fs');
const c = fs.readFileSync('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\xiage-skills.js', 'utf8');
const idx = c.indexOf('const doInstall = () => {');
const end = c.indexOf('};', idx) + 2;
const before = c.substring(0, idx);
const after = c.substring(end);

const newDoInstall = [
    'const doInstall = () => {',
    '        const fullDir = author + "-" + skillName;',
    '        const shortName = skillName;',
    '        const entry = "\\r\\n| " + shortName + " | " + fullDir + " | " + author + " |";',
    '        const idxContent = fs.readFileSync(SKILLS_INDEX, "utf8");',
    '        if (idxContent.includes("| 短名 | 完整目录 | 作者 |") && !idxContent.includes(fullDir)) {',
    '            const lines = idxContent.split("\\r\\n");',
    '            const sepLine = lines.findIndex(l => l.match(/^\\|--/));',
    '            if (sepLine !== -1) {',
    '                lines.splice(sepLine + 1, 0, entry.replace(/^\\r\\n/, ""));',
    '                fs.writeFileSync(SKILLS_INDEX, lines.join("\\r\\n"), "utf8");',
    '            }',
    '        }',
    '        info(`Installed: ${skillName}`);',
    '    };'
].join('\r\n');

const newC = before + newDoInstall + after;
fs.writeFileSync('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\xiage-skills\\xiage-skills.js', newC, 'utf8');
console.log('Done. Old len:', c.length, 'New len:', newC.length);
