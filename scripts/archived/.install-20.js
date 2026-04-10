// 直接从预下载的缓存安装 20 个候选 skill，跳过搜索/筛选/安检
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'C:/Users/Administrator/.openclaw/workspace/skills';
const SKILLS_INDEX = 'C:/Users/Administrator/.openclaw/workspace/SKILLS-INDEX.md';
const CACHE_DIR = 'C:/Users/Administrator/.openclaw/workspace/skills/.tmp-openclaw-skills-extract/openclaw-skills-c01ec37/skills';

function info(msg) { console.log('\x1b[32m[INFO]\x1b[0m ' + msg); }
function warn(msg) { console.log('\x1b[33m[WARN]\x1b[0m ' + msg); }
function error(msg) { console.error('\x1b[31m[ERROR]\x1b[0m ' + msg); }

const CANDIDATES = [
    'yahoo-finance', 'find-skills', 'web-search', 'frontend-design', 'youtube-summarizer',
    'tavily', 'email', 'bird', 'senior-fullstack', 'openclaw-search',
    'ui-ux-pro-max', 'senior-architect', 'calendar', 'senior-devops', 'senior-backend',
    'tavily-search', 'todo', 'humanizer', '--help', 'edge-tts'
];

function getInstalled() {
    const set = new Set();
    const lines = fs.readFileSync(SKILLS_INDEX, 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(/^\|\s*([^\|]+?)\s*\|/);
        if (!m) continue;
        const name = m[1].trim();
        if (!name || name.match(/^(技能名|来源|安装日期|风险|版本|描述|--------)/)) continue;
        set.add(name.toLowerCase());
    }
    return set;
}

function addToIndex(name) {
    const date = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(SKILLS_INDEX, `\n| ${name} | skills | ${date} | 🟢 | latest | |\n`, 'utf8');
}

function isDir(p) {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p) {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}

function copyRecursive(src, dest) {
    if (isDir(src)) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

function installSkill(name) {
    const skillDir = path.join(CACHE_DIR, name);
    const installPath = path.join(SKILLS_DIR, `skills-${name}`);

    if (!fs.existsSync(skillDir) && !isFile(skillDir)) {
        warn(`${name}: NOT FOUND in cache (tried as dir and as file)`);
        return false;
    }

    if (fs.existsSync(installPath)) {
        info(`${name}: already installed (directory exists)`); return false;
    }

    try {
        if (isFile(skillDir)) {
            // skill 是一个文件（不是目录）
            fs.mkdirSync(path.dirname(installPath), { recursive: true });
            fs.copyFileSync(skillDir, installPath);
        } else {
            // skill 是一个目录
            fs.mkdirSync(installPath, { recursive: true });
            for (const entry of fs.readdirSync(skillDir)) {
                copyRecursive(path.join(skillDir, entry), path.join(installPath, entry));
            }
        }

        // 检查 SKILL.md
        if (!isFile(path.join(installPath, 'SKILL.md'))) {
            warn(`${name}: SKILL.md NOT FOUND after copy`);
            fs.rmSync(installPath, { recursive: true, force: true });
            return false;
        }

        addToIndex(name);
        info(`✅ Installed: skills-${name}`);
        return true;
    } catch (e) {
        error(`${name}: failed - ${e.message}`);
        return false;
    }
}

async function main() {
    if (!fs.existsSync(CACHE_DIR)) {
        error(`Cache not found at ${CACHE_DIR}`);
        error('Run the full pipeline first to pre-download the monorepo');
        process.exit(1);
    }

    const installed = getInstalled();
    info(`Already installed: ${installed.size} skills`);
    info(`Installing ${CANDIDATES.length} skills from cache...`);

    let ok = 0, fail = 0;
    for (const name of CANDIDATES) {
        if (installed.has(name.toLowerCase())) {
            info(`${name}: already in INDEX, skipping`); continue;
        }
        const r = installSkill(name);
        if (r) ok++; else fail++;
    }

    info(`\nDone: ${ok} installed, ${fail} failed`);
}

main().catch(e => { error(e.message); process.exit(1); });
