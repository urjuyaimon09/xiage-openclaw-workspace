#!/usr/bin/env node
/**
 * @exempt-from-check
 * code-manager preCommitCheck.js - 代码 commit 前检查
 *
 * 用法: node preCommitCheck.js <目标文件路径>
 *
 * 检查项目：
 *   1. 语法检查（node -c，仅限 .js 文件）
 *   2. 无调试代码（console.log / debugger）
 *   3. 无敏感信息泄露（API key / token 明文）
 *   4. 函数注释检查
 *   5. 变更范围检查
 *
 * 豁免：文件头部包含 @exempt-from-check 的工具脚本，跳过检查
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || 'C:\\Users\\Administrator';
const WORKSPACE = path.join(HOME, '.openclaw', 'workspace');

// ─────────────────────────────────────────
// 0. 豁免检查
// ─────────────────────────────────────────
function isExempt(content) {
    // 工具脚本豁免：头部有 @exempt-from-check
    return /@exempt-from-check/.test(content.slice(0, 500));
}

// ─────────────────────────────────────────
// 1. 语法检查（仅限 .js 文件）
// ─────────────────────────────────────────
function checkSyntax(filePath) {
    if (!filePath.endsWith('.js')) {
        return { pass: true, note: '非 JS 文件，跳过语法检查' };
    }
    try {
        execSync(`node -c "${filePath}"`, { encoding: 'utf8', timeout: 10000 });
        return { pass: true };
    } catch (e) {
        return { pass: false, error: (e.stderr || e.message).split('\n')[0] };
    }
}

// ─────────────────────────────────────────
// 2. 调试代码检查
// ─────────────────────────────────────────
function checkDebugCode(content) {
    const issues = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        const ln = i + 1;

        // 跳过纯注释行和 JSDoc 行
        if (!raw || raw.startsWith('//') || raw.startsWith('*') || raw.startsWith('/*')) continue;

        // 去掉行尾 // 注释
        let l = raw;
        let inStr = false;
        let strChar = null;
        for (let j = 0; j < raw.length; j++) {
            const ch = raw[j];
            if (!inStr && (ch === '"' || ch === "'" || ch === '`')) {
                inStr = true;
                strChar = ch;
            } else if (inStr && ch === strChar && raw[j - 1] !== '\\') {
                inStr = false;
            } else if (!inStr && raw.slice(j, j + 2) === '//') {
                l = raw.slice(0, j);
                break;
            }
        }

        if (/console\.(log|debug|info)\s*\(/.test(l)) {
            issues.push({ line: ln, text: raw.slice(0, 70), type: 'console.log' });
        }
        if (/\bdebugger\b/.test(l)) {
            issues.push({ line: ln, text: raw, type: 'debugger' });
        }
        if (/^(\s*);+\s*$/.test(l)) {
            issues.push({ line: ln, text: raw, type: 'empty-statement' });
        }
    }
    return issues;
}

// ─────────────────────────────────────────
// 3. 敏感信息检查
// ─────────────────────────────────────────
function checkSensitiveInfo(content) {
    const issues = [];
    const patterns = [
        { re: /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi, type: 'API key' },
        { re: /secret\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi, type: 'secret' },
        { re: /token\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi, type: 'token' },
        { re: /password\s*[:=]\s*['"][^'"]{8,}['"]/gi, type: 'password' },
        { re: /sk-[A-Za-z0-9]{20,}/g, type: 'OpenAI key' },
        { re: /minimax-[a-zA-Z0-9]{20,}/g, type: 'MiniMax key' },
    ];

    patterns.forEach(({ re, type }) => {
        let m;
        while ((m = re.exec(content)) !== null) {
            const lineNum = content.slice(0, m.index).split('\n').length;
            issues.push({ line: lineNum, text: m[0].slice(0, 40), type });
        }
    });
    return issues;
}

// ─────────────────────────────────────────
// 4. 函数注释检查
// ─────────────────────────────────────────
function checkFunctionDocs(content) {
    const fnRe = /^(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function))/gm;
    const issues = [];

    let match;
    while ((match = fnRe.exec(content)) !== null) {
        const fnName = match[1] || match[2];
        const pos = match.index;
        const lineNum = content.slice(0, pos).split('\n').length;
        const before = content.slice(Math.max(0, pos - 400), pos);
        const linesBefore = before.split('\n').slice(-6);
        const hasComment = linesBefore.some(l => /\/\*|\/\/|^\s*\*/.test(l.trim()));
        if (!hasComment && fnName && !['cb', 'cb2', 'l'].includes(fnName)) {
            issues.push({ line: lineNum, fn: fnName });
        }
    }
    return issues;
}

// ─────────────────────────────────────────
// 5. 变更范围检查
// ─────────────────────────────────────────
function checkChangeScope(filePath) {
    try {
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath);
        const output = execSync(`git diff --stat HEAD -- "${baseName}"`, {
            cwd: dir, encoding: 'utf8'
        });
        const lineMatch = output.match(/(\d+)\s+insertion/);
        const insertions = lineMatch ? parseInt(lineMatch[1]) : 0;
        if (insertions > 300) {
            return { pass: true, warning: `变更较大（${insertions}行），建议拆分` };
        }
        return { pass: true, insertions };
    } catch {
        return { pass: true, note: '首次提交或未跟踪文件' };
    }
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, targetFile] = process.argv;

if (!targetFile) {
    console.error('用法: node preCommitCheck.js <目标文件路径>');
    process.exit(1);
}

const filePath = path.join(WORKSPACE, targetFile);
if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${targetFile}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const fileName = path.basename(filePath);

// 豁免检查
if (isExempt(content)) {
    console.log(`\n🔍 ${fileName}`);
    console.log('─'.repeat(42));
    console.log('ℹ️  工具脚本豁免检查（@exempt-from-check）');
    process.exit(0);
}

console.log(`\n🔍 代码审查: ${fileName}`);
console.log('─'.repeat(42));

let allPass = true;

process.stdout.write('1. 语法检查... ');
const s = checkSyntax(filePath);
console.log(s.pass ? (s.note ? `ℹ️  ${s.note}` : '✅') : `❌ ${s.error}`);
if (!s.pass) allPass = false;

process.stdout.write('2. 调试代码检查... ');
const d = checkDebugCode(content);
if (d.length === 0) {
    console.log('✅');
} else {
    console.log(`❌ (${d.length}处)`);
    d.slice(0, 3).forEach(i => console.log(`   L${i.line}: ${i.type}`));
    allPass = false;
}

process.stdout.write('3. 敏感信息检查... ');
const si = checkSensitiveInfo(content);
if (si.length === 0) {
    console.log('✅');
} else {
    console.log(`❌ (${si.length}处)`);
    si.slice(0, 3).forEach(i => console.log(`   L${i.line}: ${i.type}`));
    allPass = false;
}

process.stdout.write('4. 函数注释检查... ');
const doc = checkFunctionDocs(content);
if (doc.length === 0) {
    console.log('✅');
} else {
    console.log(`⚠️  (${doc.length}个函数无注释)`);
    doc.slice(0, 3).forEach(i => console.log(`   L${i.line}: ${i.fn}`));
}

process.stdout.write('5. 变更范围检查... ');
const sc = checkChangeScope(filePath);
if (sc.warning) console.log(`⚠️  ${sc.warning}`);
else if (sc.note) console.log(`ℹ️  ${sc.note}`);
else console.log(`✅ (${sc.insertions}行新增)`);

console.log('─'.repeat(42));
if (allPass) {
    console.log('✅ 全部检查通过，可以 commit');
    process.exit(0);
} else {
    console.log('❌ 检查未通过，请修复后再提交');
    process.exit(1);
}
