#!/usr/bin/env node
/**
 * @exempt-from-check
 * code-manager/beforeCode.js - 代码写入前安全检查
 *
 * 用法:
 *   node beforeCode.js check <文件路径>    # 标准检查（保护清单 + Shell 危险 token）
 *   node beforeCode.js scan <文件路径>     # 深度扫描（保护清单 + Shell + 调试代码）
 *   node beforeCode.js protect-list         # 列出当前保护清单
 *
 * 触发词：「同意，生效」
 *
 * 三层检查逻辑：
 *   Layer 1 - 保护清单检查
 *     不在清单 → 直接放行
 *     在清单 → 检查是否已获触发词授权
 *   Layer 2 - Shell 危险 token 检测
 *     检测命令替换、进程替换等危险模式
 *   Layer 3 - 调试代码检测（仅 scan 模式）
 *     检测 console.log / debugger
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, '.openclaw', 'workspace')
    : path.join(__dirname, '..', '..', '..', '..');

// ─────────────────────────────────────────
// 保护清单
// ─────────────────────────────────────────
const PROTECTED_SCRIPTS = [
    'beforeCode.js',
    'beforeWrite.js',
    'preCommitCheck.js',
    'executor.js',
    'refresh-dashboard.js',
    'xiage-skills.js',
    'demand-review.js',
    'supervision-skill.js',
    'skills/xiage-context-engine/index.js',
];

function isProtected(filePath) {
    const fileName = path.basename(filePath);
    const relative = path.relative(WORKSPACE, filePath).replace(/\\/g, '/');
    return PROTECTED_SCRIPTS.includes(fileName) ||
           PROTECTED_SCRIPTS.includes(relative) ||
           relative.startsWith('skills/code-manager/');
}

// ─────────────────────────────────────────
// Layer 2: Shell 危险 token 检测
// ─────────────────────────────────────────
// Shell 危险模式（按文件类型启用）
// .js/.cjs/.mjs 文件中，反引号是模板字符串语法，不是 shell 命令替换，跳过
const SHELL_FILE_PATTERNS = [
    { ext: null, pattern: /\$\(/,                      type: 'command-substitution', label: '$(...) 命令替换',    severity: 'error' },
    { ext: null, pattern: /<\([^)]+\)/,               type: 'process-substitution', label: '<() 进程替换',      severity: 'error' },
    { ext: null, pattern: /\bzmodload\b/,               type: 'zsh-module',          label: 'zmodload',           severity: 'error' },
    { ext: null, pattern: /\bemulate\s+\w+/,           type: 'shell-emulate',        label: 'emulate',            severity: 'error' },
    { ext: null, pattern: /\$\(\s*\(/,               type: 'nested-substitution', label: '$( ( 嵌套)',       severity: 'error' },
    // 反引号仅检测 .sh/.bash/.zsh 等 shell 脚本，.js 文件中为模板字符串
    { ext: ['.sh', '.bash', '.zsh', '.fish', '.ksh'], pattern: /`[^`]+`/, type: 'backtick-substitution', label: '`` 命令替换', severity: 'error' },
];

function isShellScript(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '' || ['.sh', '.bash', '.zsh', '.fish', '.ksh'].includes(ext);
}

function detectDangerousShellTokens(content, filePath) {
    const issues = [];
    const lines = content.split('\n');

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;

        const deStringed = stripStrings(line);

        SHELL_FILE_PATTERNS.forEach(({ ext, pattern, type, label, severity }) => {
            // 非空扩展名限制：仅特定文件类型检测
            if (ext !== null && !ext.includes(path.extname(filePath).toLowerCase())) return;

            if (pattern.test(deStringed)) {
                issues.push({
                    line: i + 1,
                    type,
                    label,
                    severity,
                    text: line.trim().slice(0, 80)
                });
            }
        });
    });

    return issues;
}

function stripStrings(line) {
    // 去掉 JS 字符串字面量，避免 "console.log('$(whoami)')" 误报
    return line
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')   // template literals
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')    // double quotes
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");   // single quotes
}

// ─────────────────────────────────────────
// Layer 3: 调试代码检测（scan 模式）
// ─────────────────────────────────────────
function detectDebugCode(content) {
    const issues = [];
    const lines = content.split('\n');

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

        const deComment = stripComments(line);
        if (/console\.(log|debug|info)\s*\(/.test(deComment)) {
            issues.push({ line: i + 1, type: 'console.log', text: trimmed.slice(0, 80) });
        }
        if (/\bdebugger\b/.test(deComment)) {
            issues.push({ line: i + 1, type: 'debugger', text: trimmed.slice(0, 80) });
        }
    });

    return issues;
}

function stripComments(line) {
    // 简单去除行尾注释
    let inStr = false, strChar = null;
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (!inStr && (ch === '"' || ch === "'" || ch === '`')) {
            inStr = true; strChar = ch;
        } else if (inStr && ch === strChar && line[j - 1] !== '\\') {
            inStr = false;
        } else if (!inStr && line.slice(j, j + 2) === '//') {
            return line.slice(0, j);
        }
    }
    return line;
}

// ─────────────────────────────────────────
// 格式化输出
// ─────────────────────────────────────────
function formatResult({ fileName, isProtected, hasDangerousTokens, dangerousTokens, debugCode, scanMode }) {
    const errors = [];
    const warnings = [];

    if (isProtected) {
        errors.push({ msg: '🔒 在保护清单，需「同意，生效」授权', type: 'protected' });
    }

    if (hasDangerousTokens) {
        dangerousTokens.forEach(t => {
            if (t.severity === 'error') {
                errors.push({ msg: `❌ L${t.line}: ${t.label}`, type: t.type, detail: t.text });
            } else {
                warnings.push({ msg: `⚠️  L${t.line}: ${t.label}`, type: t.type, detail: t.text });
            }
        });
    }

    if (scanMode && debugCode.length > 0) {
        debugCode.slice(0, 3).forEach(d => {
            warnings.push({ msg: `⚠️  L${d.line}: 调试代码 [${d.type}]`, type: 'debug-code', detail: d.text });
        });
    }

    return { errors, warnings, debugCodeCount: debugCode.length };
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, cmd, targetPath] = process.argv;

if (cmd === 'protect-list') {
    console.log('\n🔒 代码保护清单：\n');
    PROTECTED_SCRIPTS.forEach(s => console.log('  -', s));
    console.log(`\n共 ${PROTECTED_SCRIPTS.length} 个文件\n`);
    process.exit(0);
}

if (cmd === 'check' || cmd === 'scan') {
    if (!targetPath) {
        console.error('用法: node beforeCode.js [check|scan] <文件路径>');
        process.exit(1);
    }

    const fileName = path.basename(targetPath);
    const absolutePath = path.isAbsolute(targetPath)
        ? targetPath
        : path.join(WORKSPACE, targetPath);

    let content = null;
    if (fs.existsSync(absolutePath)) {
        content = fs.readFileSync(absolutePath, 'utf8');
    }

    const isProtectedFile = isProtected(absolutePath);
    const dangerousTokens = content ? detectDangerousShellTokens(content, absolutePath) : [];
    const debugCode = (cmd === 'scan' && content) ? detectDebugCode(content) : [];
    const hasDangerousTokens = dangerousTokens.length > 0;
    const scanMode = cmd === 'scan';

    const result = formatResult({ fileName, isProtected: isProtectedFile, hasDangerousTokens, dangerousTokens, debugCode, scanMode });

    // JSON 机器可读输出（方便 Agent 解析）
    console.log(JSON.stringify({
        file: fileName,
        protected: isProtectedFile,
        dangerousTokens: dangerousTokens.length,
        dangerousTokenTypes: [...new Set(dangerousTokens.map(t => t.type))],
        debugCodeCount: debugCode.length,
        errors: result.errors,
        warnings: result.warnings,
    }));

    // 人类可读摘要
    if (result.errors.length > 0 || result.warnings.length > 0) {
        console.log('');
        result.errors.forEach(e => console.log(e.msg));
        result.warnings.forEach(w => console.log(w.msg));
    }

    // Exit code: 0 = 通过, 1 = 错误, 2 = 警告
    if (result.errors.length > 0) {
        process.exit(1);
    } else if (result.warnings.length > 0) {
        process.exit(2);
    }
    process.exit(0);
}

console.error('用法:');
console.error('  node beforeCode.js check <文件路径>    # 标准检查（保护清单 + Shell 危险 token）');
console.error('  node beforeCode.js scan <文件路径>     # 深度扫描（+ 调试代码）');
console.error('  node beforeCode.js protect-list         # 列出保护清单');
process.exit(1);
