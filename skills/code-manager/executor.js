#!/usr/bin/env node
/**
 * @exempt-from-check
 * code-manager executor - 代码管理触发词 → 函数映射
 *
 * 用法: node executor.js <command> [args...]
 *
 * Commands:
 *   run-full <file>              运行完整代码
 *   run-partial <file> <fn>      运行某个函数/区块
 *   syntax <file>                语法检查
 *   example <skillDir>           跑 SKILL.md 示例流程
 *   pr <message>                 创建待处理变更记录
 *   exec-commit <file> <desc>    执行变更并 commit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || 'C:\\Users\\Administrator';
const WORKSPACE = path.join(HOME, '.openclaw', 'workspace');
const PENDING_DIR = path.join(WORKSPACE, '.code-pending');

// ─────────────────────────────────────────
// helpers
// ─────────────────────────────────────────
function runCmd(cmd, cwd) {
    try {
        const output = execSync(cmd, {
            cwd: cwd || WORKSPACE,
            encoding: 'utf8',
            timeout: 30000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return { success: true, output };
    } catch (e) {
        return {
            success: false,
            error: e.message,
            stderr: e.stderr ? e.stderr.toString() : '',
            stdout: e.stdout ? e.stdout.toString() : ''
        };
    }
}

// ─────────────────────────────────────────
// 1. run-full - 运行完整代码
// ─────────────────────────────────────────
function runFull(file) {
    const filePath = path.join(WORKSPACE, file);
    if (!fs.existsSync(filePath)) {
        return { error: `文件不存在: ${file}` };
    }
    const result = runCmd(`node "${filePath}"`);
    return {
        command: `node ${file}`,
        ...result
    };
}

// ─────────────────────────────────────────
// 2. run-partial - 运行某个函数/区块
// ─────────────────────────────────────────
function runPartial(file, fnName) {
    const filePath = path.join(WORKSPACE, file);
    if (!fs.existsSync(filePath)) {
        return { error: `文件不存在: ${file}` };
    }
    if (!fnName) {
        return { error: '请指定函数名，如 run-partial xiage-skills.js parseSkills' };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // 尝试定位函数：function xxx / const xxx = / xxx: function
    const patterns = [
        new RegExp(`^function\\s+${fnName}\\s*\\(`),
        new RegExp(`^const\\s+${fnName}\\s*=\\s*(?:async\\s+)?(?:function|\\()`),
        new RegExp(`^${fnName}:\\s*(?:async\\s+)?function`),
        new RegExp(`^${fnName}\\s*=\\s*(?:async\\s+)?\\(`)
    ];

    let fnStart = -1;
    for (let i = 0; i < lines.length; i++) {
        for (const pat of patterns) {
            if (pat.test(lines[i])) {
                fnStart = i;
                break;
            }
        }
        if (fnStart !== -1) break;
    }

    if (fnStart === -1) {
        return { error: `未找到函数: ${fnName}` };
    }

    // 简单括号计数找函数结束
    let braceCount = 0;
    let inFn = false;
    let fnEnd = lines.length;
    for (let i = fnStart; i < lines.length; i++) {
        const l = lines[i];
        for (const ch of l) {
            if (ch === '{') { braceCount++; inFn = true; }
            if (ch === '}') { braceCount--; }
        }
        if (inFn && braceCount === 0) {
            fnEnd = i + 1;
            break;
        }
    }

    // 提取函数体，写临时文件执行
    const fnBody = lines.slice(fnStart, fnEnd).join('\n');
    const tmpFile = path.join(WORKSPACE, '.tmp-fn-' + fnName + '.js');
    fs.writeFileSync(tmpFile, fnBody, 'utf8');

    const result = runCmd(`node "${tmpFile}"`);
    fs.unlinkSync(tmpFile);
    return {
        command: `node (${fnName} function body)`,
        file: file,
        function: fnName,
        ...result
    };
}

// ─────────────────────────────────────────
// 3. syntax - 语法检查
// ─────────────────────────────────────────
function checkSyntax(file) {
    const filePath = path.join(WORKSPACE, file);
    if (!fs.existsSync(filePath)) {
        return { error: `文件不存在: ${file}` };
    }
    const result = runCmd(`node -c "${filePath}"`);
    return {
        command: `node -c ${file}`,
        ...result
    };
}

// ─────────────────────────────────────────
// 4. example - 跑 SKILL.md 示例
// ─────────────────────────────────────────
function runExample(skillDir) {
    const skillPath = path.join(WORKSPACE, 'skills', skillDir);
    const skillMd = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
        return { error: `SKILL.md 不存在: skills/${skillDir}` };
    }

    const content = fs.readFileSync(skillMd, 'utf8');
    // 提取 ```bash 代码块
    const bashBlocks = [];
    const blockRe = /```bash\n([\s\S]*?)```/g;
    let m;
    while ((m = blockRe.exec(content)) !== null) {
        bashBlocks.push(m[1].trim());
    }

    if (bashBlocks.length === 0) {
        return { error: 'SKILL.md 中未找到 bash 代码块示例' };
    }

    // 只跑第一个（最典型的示例）
    const cmd = bashBlocks[0].split('\n')[0].trim();
    const result = runCmd(cmd, skillPath);
    return {
        command: cmd,
        skill: skillDir,
        allExamples: bashBlocks.length,
        ...result
    };
}

// ─────────────────────────────────────────
// 5. pr - 创建待处理变更记录
// ─────────────────────────────────────────
function createPR(message) {
    if (!fs.existsSync(PENDING_DIR)) {
        fs.mkdirSync(PENDING_DIR, { recursive: true });
    }
    const id = Date.now();
    const file = path.join(PENDING_DIR, `pr-${id}.json`);
    fs.writeFileSync(file, JSON.stringify({
        id,
        message,
        created: new Date().toISOString()
    }, null, 2), 'utf8');
    return { success: true, id, file: `pr-${id}.json`, message };
}

// ─────────────────────────────────────────
// 6. exec-commit - 执行变更并 commit
// ─────────────────────────────────────────
function executeAndCommit(file, description) {
    const filePath = path.join(WORKSPACE, file);
    if (!fs.existsSync(filePath)) {
        return { error: `文件不存在: ${file}` };
    }

    // git add + commit
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath);

    const addResult = runCmd(`git add "${baseName}"`, dir);
    if (!addResult.success) {
        return { error: 'git add 失败', ...addResult };
    }

    // 自动生成 commit message
    const type = detectCommitType(description);
    const msg = `${type}: ${description || '代码修改'}`;

    const commitResult = runCmd(`git commit -m "${msg}"`, dir);
    if (!commitResult.success) {
        return { error: 'git commit 失败', ...commitResult };
    }

    return {
        success: true,
        file,
        commitMessage: msg,
        hash: commitResult.output.trim()
    };
}

// 根据描述内容推断 git commit type
function detectCommitType(desc) {
    if (!desc) return 'chore';
    const d = desc.toLowerCase();
    if (d.includes('新增') || d.includes('添加') || d.includes('新加')) return 'feat';
    if (d.includes('修复') || d.includes('bug') || d.includes('fix')) return 'fix';
    if (d.includes('重构') || d.includes('重写')) return 'refactor';
    return 'chore';
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

let result;
switch (cmd) {
    case 'run-full': {
        const [file] = args;
        result = runFull(file || '');
        break;
    }
    case 'run-partial': {
        const [file, fn] = args;
        result = runPartial(file || '', fn || '');
        break;
    }
    case 'syntax': {
        const [file] = args;
        result = checkSyntax(file || '');
        break;
    }
    case 'example': {
        const [skillDir] = args;
        result = runExample(skillDir || '');
        break;
    }
    case 'pr': {
        const [message] = args;
        result = createPR(message || '');
        break;
    }
    case 'exec-commit': {
        const [file, ...descParts] = args;
        result = executeAndCommit(file || '', descParts.join(' '));
        break;
    }
    default:
        result = { error: `未知命令: ${cmd}，可用: run-full / run-partial / syntax / example / pr / exec-commit` };
}

console.log(JSON.stringify(result, null, 2)); // CLI output (always allowed)
