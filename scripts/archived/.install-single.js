const fs = require('fs');
const https = require('https');
const path = require('path');
const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');

const SKILLS_DIR = 'C:/Users/Administrator/.openclaw/workspace/skills';
const SKILLS_INDEX = 'C:/Users/Administrator/.openclaw/workspace/SKILLS-INDEX.md';
const ADMZIP_PATH = process.env.APPDATA + '/npm/node_modules/adm-zip';

function info(msg) { console.log('\x1b[32m[INFO]\x1b[0m ' + msg); }
function warn(msg) { console.log('\x1b[33m[WARN]\x1b[0m ' + msg); }
function error(msg) { console.error('\x1b[31m[ERROR]\x1b[0m ' + msg); }

function getInstalled() {
    const set = new Set();
    try {
        const content = fs.readFileSync(SKILLS_INDEX, 'utf8');
        for (const line of content.split('\n')) {
            const m = line.match(/^\|\s*([^|]+?)\s*\|/);
            if (m) {
                const name = m[1].trim();
                if (name && !name.match(/^[-\s]/) && name.length > 0 && name.length < 100) {
                    set.add(name);
                }
            }
        }
    } catch (e) {}
    return set;
}

// 从 openclaw/openclaw repo 下载整个 ZIP，提取单个 skill 子目录
async function installFromOpenclaw(skillName) {
    const installPath = path.join(SKILLS_DIR, `openclaw-${skillName}`);
    if (fs.existsSync(installPath)) {
        info(`${skillName}: already installed, skipping`); return false;
    }

    info(`Installing openclaw-${skillName}...`);

    // 通过 GitHub API → 302 → codeload
    const zipPath = path.join(SKILLS_DIR, `.tmp-openclaw.zip`);
    const extractPath = path.join(SKILLS_DIR, `.tmp-openclaw-extract`);

    try {
        await new Promise((resolve, reject) => {
            const apiUrl = 'https://api.github.com/repos/openclaw/openclaw/zipball/main';
            const file = fs.createWriteStream(zipPath);
            https.get(apiUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/vnd.github+json' }
            }, (res) => {
                if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {
                    file.close(); if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    https.get(res.headers.location, (r2) => {
                        if (r2.statusCode !== 200) { file.close(); reject(new Error(`HTTP ${r2.statusCode}`)); return; }
                        r2.pipe(file); file.on('finish', () => resolve());
                    }).on('error', e => reject(e)); return;
                }
                if (res.statusCode !== 200) { file.close(); reject(new Error(`API HTTP ${res.statusCode}`)); return; }
                res.pipe(file); file.on('finish', () => resolve());
            }).on('error', e => reject(e));
        });

        if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
        fs.mkdirSync(extractPath, { recursive: true });
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath, true);

        const topDirs = fs.readdirSync(extractPath);
        if (topDirs.length === 0) throw new Error('Empty ZIP');
        const repoRoot = path.join(extractPath, topDirs[0]);
        const skillSrc = path.join(repoRoot, 'skills', skillName);
        const skillDest = installPath;

        if (!fs.existsSync(skillSrc)) throw new Error(`skills/${skillName} not found in ZIP`);

        fs.mkdirSync(skillDest, { recursive: true });
        for (const f of fs.readdirSync(skillSrc)) {
            fs.copyFileSync(path.join(skillSrc, f), path.join(skillDest, f));
        }

        fs.unlinkSync(zipPath);
        fs.rmSync(extractPath, { recursive: true, force: true });

        if (!fs.existsSync(path.join(skillDest, 'SKILL.md'))) throw new Error('SKILL.md missing');

        const date = new Date().toISOString().slice(0, 10);
        fs.appendFileSync(SKILLS_INDEX, `\n| ${skillName} | openclaw | ${date} | 🟢 | latest | |\n`, 'utf8');
        info(`✅ Installed: openclaw-${skillName}`);
        return true;

    } catch (e) {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
        error(`${skillName}: install failed - ${e.message}`);
        return false;
    }
}

async function main() {
    const installed = getInstalled();
    info(`Already installed: ${installed.size} skills`);

    // 需要安装的 skill 列表（按实用度排序）
    const toInstall = [
        'nano-pdf',     // PDF 编辑
        'blogwatcher',  // 博客监控
        'mcporter',     // MC 端口转发工具
        'canvas',       // Canvas 控制
        'node-connect', // Node 连接
        'eightctl',     // 八斗控制
        'gh-issues',    // GitHub Issues
        'songsee',      // 音乐识别
        'xurl',         // URL 工具
        'ordercli',     // 订单 CLI
    ].filter(n => !installed.has(n));

    info(`Need to install: ${toInstall.length} skills: ${toInstall.join(', ')}`);

    let success = 0, fail = 0;
    for (const skill of toInstall) {
        const ok = await installFromOpenclaw(skill);
        if (ok) success++; else fail++;
        await new Promise(r => setTimeout(r, 1500)); // GitHub rate limit
    }

    info(`\nResult: ${success} installed, ${fail} failed`);
}

main().catch(e => { error(e.message); process.exit(1); });
