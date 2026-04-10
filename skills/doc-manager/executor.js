#!/usr/bin/env node
/**
 * doc-manager executor - 文档管理触发词 → 函数映射
 *
 * 用法: node executor.js <command> [args...]
 *
 * Commands:
 *   query <docName> <level>     查询文档层级内容
 *   todo <docName> <content>   写待办到当日 memory
 *   append-vh <file> <version> <date> <level> <change> <author>  追加版本历史行
 *   cleanup                      清理过期版本
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || 'C:\\Users\\Administrator';
const WORKSPACE = path.join(HOME, '.openclaw', 'workspace');
const MEMORY_DIR = path.join(WORKSPACE, 'memory');
const OLD_VERSIONS_DIR = path.join(WORKSPACE, 'old-versions');

// ─────────────────────────────────────────
// query - 按层级读取文档内容
// ─────────────────────────────────────────
function queryDoc(docName, level) {
    // 文档路径：先查根目录，再查 docs/core/（核心文档已移入该目录）
    const candidates = [
        path.join(WORKSPACE, docName),
        path.join(WORKSPACE, 'docs', 'core', docName),
    ];
    const filePath = candidates.find(p => fs.existsSync(p)) || candidates[0];
    if (!fs.existsSync(filePath)) {
        return { error: `文档不存在: ${docName}` };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // 解析 level
    const isFull = level === 'full';
    const isPartial = level === 'partial'; // 看XX文档，只看标题

    if (isPartial) {
        // 只展示一级+二级（标题行、## 二级标题、### 三级标题）
        const headers = lines.filter(l =>
            l.match(/^#\s/) ||       // # 文档名
            l.match(/^##\s/) ||      // ## 一级章节
            l.match(/^###\s/)        // ### 二级章节
        );
        return { type: 'partial', docName, headers };
    }

    if (isFull) {
        return { type: 'full', docName, content };
    }

    // 层级查询：X.Y 或 X.Y.Z
    const levelMatch = level.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (!levelMatch) {
        return { error: `无效层级格式: ${level}，期望 X.Y 或 X.Y.Z` };
    }
    const [_, sec, sub, item] = levelMatch;

    if (item !== undefined) {
        // X.Y.Z - 只读这一条
        const result = extractSection(lines, parseInt(sec), parseInt(sub), parseInt(item));
        return { type: 'item', docName, level, ...result };
    } else {
        // X.Y - 读该二级的全部三级
        const result = extractSubSection(lines, parseInt(sec), parseInt(sub));
        return { type: 'sub', docName, level, ...result };
    }
}

function extractSection(lines, sec, sub, item) {
    // 优先用 #### 四级标题格式（X.Y.Z）
    const prefix4 = `#### ${sec}.${sub}.${item}`;
    let start = lines.findIndex(l => l.startsWith(prefix4));
    if (start === -1) {
        // 兜底：直接以数字开头的行
        const numPrefix = `${sec}.${sub}.${item}`;
        start = lines.findIndex(l => l.trim().startsWith(numPrefix));
        if (start === -1) return { error: `未找到条款 ${sec}.${sub}.${item}` };
    }
    const end = findNextSection(lines, start + 1);
    return { lines: lines.slice(start, end), start, end };
}

function extractSubSection(lines, sec, sub) {
    const prefix = `### ${sec}.${sub}`;
    const altPrefix = `### ${sec}.${sub}`;

    // 找所有 X.Y.Z 开头的条款
    const items = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        const itemMatch = l.match(new RegExp(`^#{3,4}\\s${sec}\\.${sub}\\.(\\d+)`));
        if (itemMatch) {
            if (current) current.end = i;
            current = { line: lines[i], index: i, items: [] };
            items.push(current);
        } else if (current && (l.match(/^#{3,4}\s/) || l.match(/^## /) || l.match(/^# /))) {
            current.end = i;
            current = null;
        }
    }
    if (current) current.end = lines.length;

    if (items.length === 0) {
        // 找不到 X.Y.Z，找 X.Y 本身（如 ### 4.2 触发词约定）
        const pat = `### ${sec}.${sub}`;
        const secLine = lines.findIndex(l => l.trim().startsWith(pat));
        if (secLine === -1) return { error: `未找到二级条款 ${sec}.${sub}` };
        return { lines: lines.slice(secLine), start: secLine, end: lines.length };
    }
    return { items };
}

function findNextSection(lines, from) {
    for (let i = from; i < lines.length; i++) {
        if (lines[i].match(/^#{1,4}\s+\d+\.\d+/)) return i;
    }
    return lines.length;
}

// ─────────────────────────────────────────
// todo - 写待办到当日 memory
// ─────────────────────────────────────────
function createTodo(docName, content) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const memoryFile = path.join(MEMORY_DIR, `${dateStr}.md`);

    // 确保 memory 目录存在
    if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }

    const todoLine = `- [ ] 待办：修改 ${docName}（${content || ''}）\n`;
    const nowStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let existing = '';
    if (fs.existsSync(memoryFile)) {
        existing = fs.readFileSync(memoryFile, 'utf8');
    }

    const updated = existing + `\n### ${nowStr}\n${todoLine}`;
    fs.writeFileSync(memoryFile, updated, 'utf8');
    return { success: true, file: memoryFile, todo: todoLine.trim() };
}

// ─────────────────────────────────────────
// append-version-history - 追加版本历史行
// ─────────────────────────────────────────
function appendVersionHistory(targetFile, version, date, updateLevel, change, author) {
    // 文档路径：先查根目录，再查 docs/core/
    const candidates = [
        path.join(WORKSPACE, targetFile),
        path.join(WORKSPACE, 'docs', 'core', targetFile),
    ];
    const filePath = candidates.find(p => fs.existsSync(p)) || candidates[0];
    if (!fs.existsSync(filePath)) {
        return { error: `文件不存在: ${targetFile}` };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const newRow = `| ${version} | ${date} | ${updateLevel} | ${change} | ${author} |`;

    // 找到版本历史表格最后一行（| ------ | 之前那行）
    const tableEndMatch = content.match(/\n\| *-{3,} *\|[^|]*\|[^|]*\|[^|]*\|[^|]*\| *\n/);
    let insertPos;
    if (tableEndMatch) {
        insertPos = content.indexOf(tableEndMatch[0]);
    } else {
        // 兜底：找 "版本历史" 标题后的最后一行表格行
        const histMatch = content.match(/\*\*版本历史\*\*\n([\s\S]*?)(?=\n---\n|\n## |\n# )/);
        if (histMatch) {
            const lastRowMatch = histMatch[1].match(/\|\s*v[\d.]+\s*\|[^\n]+\n(?!\|)/);
            if (lastRowMatch) {
                insertPos = content.indexOf(lastRowMatch[0]) + lastRowMatch[0].length;
            }
        }
    }

    if (insertPos === undefined) {
        return { error: '无法定位版本历史表格插入位置' };
    }

    const updated = content.slice(0, insertPos) + newRow + '\n' + content.slice(insertPos);
    fs.writeFileSync(filePath, updated, 'utf8');
    return { success: true, row: newRow, file: targetFile };
}

// ─────────────────────────────────────────
// cleanup - 清理过期版本
// ─────────────────────────────────────────
function cleanupOldVersions() {
    if (!fs.existsSync(OLD_VERSIONS_DIR)) {
        return { message: '无旧版本目录，跳过' };
    }

    const files = fs.readdirSync(OLD_VERSIONS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => {
            const stat = fs.statSync(path.join(OLD_VERSIONS_DIR, f));
            return { file: f, mtime: stat.mtime };
        });

    // 按文件名中的版本号排序，保留每个主版本最新的次版本
    const byMajor = {};
    for (const { file } of files) {
        const match = file.match(/v(\d+)\.(\d+)\.(\d+)/);
        if (!match) continue;
        const [_, major, minor] = match;
        const key = `${major}`;
        if (!byMajor[key] || minor > byMajor[key].minor) {
            byMajor[key] = { file, minor: parseInt(minor) };
        }
    }

    const toKeep = new Set(Object.values(byMajor).map(v => v.file));
    let deleted = 0;
    for (const { file } of files) {
        if (!toKeep.has(file)) {
            fs.unlinkSync(path.join(OLD_VERSIONS_DIR, file));
            deleted++;
        }
    }

    return { deleted, kept: toKeep.size, message: `清理完成：删除 ${deleted} 个旧版本，保留 ${toKeep.size} 个` };
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

// ─────────────────────────────────────────
// refresh-dashboard - 全量刷新仪表盘
// ─────────────────────────────────────────
function refreshDashboard() {
    const { execSync } = require('child_process');
    try {
        const r = execSync('node "' + path.join(__dirname, 'refresh-dashboard.js') + '" force', {
            cwd: WORKSPACE, encoding: 'utf8', timeout: 10000
        });
        return JSON.parse(r.trim());
    } catch (e) {
        return { updated: false, reason: 'exec-error' };
    }
}

let result;
switch (cmd) {
    case 'query': {
        const [docName, level] = args;
        // 调用前先刷新 dashboard
        const dashResult = refreshDashboard();
        if (dashResult.updated) {
            console.error('[dashboard] refreshed: ' + dashResult.date);
        }
        result = queryDoc(docName || '', level || 'partial');
        break;
    }
    case 'todo': {
        const [docName, ...contentParts] = args;
        result = createTodo(docName || '', contentParts.join(' '));
        break;
    }
    case 'append-vh': {
        const [file, version, date, updateLevel, ...changeParts] = args;
        const author = changeParts.pop();
        const change = changeParts.join(' ');
        result = appendVersionHistory(file, version, date, updateLevel, change, author);
        break;
    }
    case 'cleanup': {
        result = cleanupOldVersions();
        break;
    }
    case 'refresh-dashboard': {
        result = refreshDashboard();
        break;
    }
    default:
        result = { error: `未知命令: ${cmd}，可用: query / todo / append-vh / cleanup / refresh-dashboard` };
}

console.log(JSON.stringify(result, null, 2));
