#!/usr/bin/env node
/**
 * doc-manager/beforeWrite.js - 文档写入执行器
 *
 * 触发词：「同意变更并升级版本」
 *
 * 执行流程：
 *   1. 调用 preWriteCheck 验证通过
 *   2. 执行写入（write 或 edit 由调用方指定）
 *   3. 版本号 +1
 *   4. 版本历史追加行
 *   5. git push 由 executor.execCommit() 完成
 *
 * 用法：
 *   node beforeWrite.js <filePath> <content> [isNew]
 *   - filePath: 目标文件路径（绝对或相对 workspace）
 *   - content: 新内容（JSON 字符串，如用 "" 空内容表示仅走流程不写文件）
 *   - isNew: "new" 表示新建文档，跳过存档检查
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..', '..');

// ─────────────────────────────────────────
// 1. 获取当前版本号
// ─────────────────────────────────────────
function getCurrentVersion(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const versionMatches = content.match(/^\| (v[\d.]+) \|/gm);
    if (!versionMatches || versionMatches.length === 0) return null;
    const lastMatch = versionMatches[versionMatches.length - 1];
    return lastMatch.match(/\| (v[\d.]+) \|/)[1];
}

// ─────────────────────────────────────────
// 2. 解析版本号 +1
// ─────────────────────────────────────────
function bumpVersion(version) {
    const parts = version.replace('v', '').split('.');
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2], 10) + 1;
    return `v${major}.${minor}.${patch}`;
}

// ─────────────────────────────────────────
// 3. 生成版本历史追加行
// ─────────────────────────────────────────
function formatVersionRow(newVersion, date, level, change, author) {
    return `\n| ${newVersion} | ${date} | ${level} | ${change} | ${author} |`;
}

// ─────────────────────────────────────────
// 4. 执行 preWriteCheck 验证
// ─────────────────────────────────────────
function runPreWriteCheck(filePath, isNew) {
    const { execSync } = require('child_process');
    try {
        const result = execSync(
            `node "${path.join(__dirname, 'preWriteCheck.js')}" "${filePath}" ${isNew || ''}`,
            { cwd: WORKSPACE, encoding: 'utf8', timeout: 30000 }
        );
        return { success: true, output: result };
    } catch (e) {
        return { success: false, output: e.stdout || e.message };
    }
}

// ─────────────────────────────────────────
// 5. 追加版本历史
// ─────────────────────────────────────────
function appendVersionHistory(filePath, newVersion, change, author) {
    const date = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(filePath, 'utf8');
    const row = formatVersionRow(newVersion, date, '三级', change, author);

    // 找到版本历史表格末尾（最后一个 | ... | 之后）
    const versionRowRegex = /(\n\| v\d+\.\d+\.\d+ \| \d{4}-\d{2}-\d{2} \|[^\n]*\n)/;
    const match = content.match(versionRowRegex);
    if (match) {
        const updated = content.replace(versionRowRegex, match[1] + row);
        fs.writeFileSync(filePath, updated, 'utf8');
        return true;
    }
    return false;
}

// ─────────────────────────────────────────
// 6. 更新头部版本号
// ─────────────────────────────────────────
function updateHeaderVersion(filePath, newVersion) {
    const content = fs.readFileSync(filePath, 'utf8');
    const today = new Date().toISOString().slice(0, 10);
    const updated = content
        .replace(/当前版本：v\d+\.\d+\.\d+/, `当前版本：${newVersion}`)
        .replace(/最后更新：\d{4}-\d{2}-\d{2}/, `最后更新：${today}`);
    fs.writeFileSync(filePath, updated, 'utf8');
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, filePath, contentArg, isNew] = process.argv;

if (!filePath || !contentArg) {
    console.error('用法: node beforeWrite.js <filePath> <content> [isNew]');
    console.error('  content: 新内容（JSON 字符串），空内容 "" 表示只走流程');
    console.error('  isNew: "new" 表示新建文档');
    process.exit(1);
}

const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(WORKSPACE, filePath);
const content = contentArg === 'EMPTY_CONTENT' ? '' : JSON.parse(contentArg);
const fileName = path.basename(filePath);

// ── Step 1: preWriteCheck ──
console.log(`\n🔍 执行 preWriteCheck...`);
const checkResult = runPreWriteCheck(fullPath, isNew);
console.log(checkResult.output.trim());

if (!checkResult.success || !checkResult.output.includes('pass: true')) {
    console.error('\n❌ preWriteCheck 未通过，终止写入');
    process.exit(1);
}

// ── Step 2: 执行写入 ──
if (content !== '') {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`\n✅ 写入完成: ${fileName}`);
} else {
    console.log(`\n📝 内容为空，跳过写入（仅完成流程）`);
}

// ── Step 3: 版本号 +1 ──
const currentVersion = fs.existsSync(fullPath) ? getCurrentVersion(fullPath) : null;
if (currentVersion && !isNew) {
    const newVersion = bumpVersion(currentVersion);
    updateHeaderVersion(fullPath, newVersion);
    appendVersionHistory(fullPath, newVersion, '（待补充变更内容）', '虾哥（坚果确认）');
    console.log(`✅ 版本号: ${currentVersion} → ${newVersion}`);
}

// ── Step 4: 结果汇总 ──
console.log('\n📋 执行汇总:');
console.log(`  文件: ${fileName}`);
console.log(`  版本: ${currentVersion || '新建'} → ${currentVersion ? bumpVersion(currentVersion) : 'v1.0.0'}`);
console.log(`  写入: ${content !== '' ? '已完成' : '跳过'}`);
console.log('\n✅ 全部流程执行完成');
console.log('\n⚠️  记得执行 git push 同步到 GitHub');
