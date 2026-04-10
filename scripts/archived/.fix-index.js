const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'C:/Users/Administrator/.openclaw/workspace/skills';
const SKILLS_INDEX = 'C:/Users/Administrator/.openclaw/workspace/SKILLS-INDEX.md';

function info(msg) { console.log('\x1b[32m[INFO]\x1b[0m ' + msg); }

// 从 INDEX 提取真实 skill name（只匹配数据行，name 列在第一个 | 之后）
function getIndexSkillNames() {
    const set = new Set();
    const lines = fs.readFileSync(SKILLS_INDEX, 'utf8').split('\n');
    for (const line of lines) {
        // 匹配: | name | author | date | 🟢 | version | desc |
        const m = line.match(/^\|\s+([^\s][^|]{0,80})\s+\|/);
        if (m) {
            const name = m[1].trim();
            // 跳过表头、分隔线、空格
            if (name && !name.match(/^(技能名|来源|安装日期|风险等级|版本|描述|--------)/) && name.length > 0) {
                set.add(name.toLowerCase());
            }
        }
    }
    return set;
}

// 从本地目录获取所有已安装 skill
function getInstalledDirs() {
    const result = [];
    const entries = fs.readdirSync(SKILLS_DIR);
    for (const entry of entries) {
        const fullPath = path.join(SKILLS_DIR, entry);
        if (!fs.statSync(fullPath).isDirectory()) continue;
        if (!fs.existsSync(path.join(fullPath, 'SKILL.md'))) continue;

        // 解析 author-skillname 格式
        const dashIdx = entry.indexOf('-');
        if (dashIdx <= 0) continue;
        const author = entry.slice(0, dashIdx);
        const name = entry.slice(dashIdx + 1);
        result.push({ author, name, dir: entry });
    }
    return result;
}

async function main() {
    const indexNames = getIndexSkillNames();
    const dirs = getInstalledDirs();

    info(`INDEX 中已有: ${indexNames.size} 个 skill`);
    info(`本地目录: ${dirs.length} 个`);

    // 找缺失的
    const missing = dirs.filter(d => !indexNames.has(d.name.toLowerCase()));
    info(`缺失: ${missing.length} 个: ${missing.map(d => d.name).join(', ')}`);

    // 补充到 INDEX
    const date = new Date().toISOString().slice(0, 10);
    for (const d of missing) {
        const entry = `\n| ${d.name} | ${d.author} | ${date} | 🟢 | latest | |\n`;
        fs.appendFileSync(SKILLS_INDEX, entry, 'utf8');
        info(`✅ 添加: ${d.name} (${d.author})`);
    }

    // 验证
    const newIndexNames = getIndexSkillNames();
    info(`\nINDEX 现共: ${newIndexNames.size} 个 skill`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
