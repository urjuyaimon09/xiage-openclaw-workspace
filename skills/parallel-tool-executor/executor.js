#!/usr/bin/env node
/**
 * parallel-tool-executor - 并行工具执行器 v0.4.0
 *
 * 用法: node executor.js <json_input>
 *
 * 输入:
 * {
 *   "tools": [
 *     { "tool": "Read", "params": { "path": "fileA.txt" } },
 *     { "tool": "Read", "params": { "path": "fileB.txt" } }
 *   ],
 *   "description": "读取配置文件A和B"
 * }
 *
 * 输出: 可直接执行的 sessions_spawn 指令列表
 */

'use strict';

// ─────────────────────────────────────────
// 并发安全工具白名单
// ─────────────────────────────────────────
const CONCURRENCY_SAFE_TOOLS = new Set([
    'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
    'Image', 'ImageGenerate', 'Tavily', 'Bash'
]);

// 非并发安全（写操作）
const NON_SAFE_TOOLS = new Set([
    'Edit', 'Write', 'Move', 'Delete', 'Mkdir',
    'Rmdir', 'Touch', 'Cp', 'Mv'
]);

// Bash 读命令白名单
const BASH_READ_PATTERN = /^(ls|dir|git status|git log|git diff|find|pwd|echo|cat|head|tail|grep|wc)\b/i;

// ─────────────────────────────────────────
// 工具并发安全性判断
// ─────────────────────────────────────────
function isConcurrencySafe(toolName, params) {
    if (!CONCURRENCY_SAFE_TOOLS.has(toolName)) {
        return false;
    }
    if (toolName === 'Bash') {
        const cmd = (params.command || '').trim();
        return BASH_READ_PATTERN.test(cmd);
    }
    return true;
}

// ─────────────────────────────────────────
// 按并发安全性分区
// ─────────────────────────────────────────
function partitionTools(tools) {
    const safe = [];
    const unsafe = [];
    for (const t of tools) {
        if (isConcurrencySafe(t.tool, t.params)) {
            safe.push(t);
        } else {
            unsafe.push(t);
        }
    }
    return { safe, unsafe };
}

// ─────────────────────────────────────────
// 生成 sessions_spawn 指令
// ─────────────────────────────────────────
function buildSpawnInstruction(toolCall, index) {
    const { tool, params } = toolCall;
    const paramStr = Object.entries(params)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');

    return {
        taskId: `tool-${index}`,
        sessions_spawn: {
            task: `请执行工具 ${tool}(${paramStr})，只返回执行结果，不需要解释。`,
            label: `tool-${index}`,
            mode: 'run'
        }
    };
}

// ─────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────
function execute(input) {
    let parsed;
    if (typeof input === 'string') {
        try {
            parsed = JSON.parse(input);
        } catch (e) {
            return { error: `JSON 解析失败: ${e.message}` };
        }
    } else {
        parsed = input;
    }

    const { tools, description = '' } = parsed;
    if (!Array.isArray(tools) || tools.length === 0) {
        return { error: 'tools 必须是非空数组' };
    }

    const { safe, unsafe } = partitionTools(tools);

    if (unsafe.length > 0) {
        const unsafeTools = unsafe.map(t => t.tool).join(', ');
        return {
            error: `包含非并发安全工具，不适合此 skill: ${unsafeTools}`,
            suggestion: '写操作（Edit/Write/Delete/Move）必须串行执行，不能并行'
        };
    }

    if (safe.length === 1) {
        return {
            error: '只有1个工具，不需要并行，直接执行即可',
            suggestion: '单个工具直接调用对应工具，不需要走 parallel-tool-executor'
        };
    }

    const instructions = safe.map((t, i) => buildSpawnInstruction(t, i));

    return {
        type: 'parallel-execution',
        description,
        maxConcurrency: 5,
        instructions,
        aggregation: {
            type: 'merge-results',
            description: '等待所有子 agent 完成后，按 taskId 匹配汇总结果，返回结构化输出'
        }
    };
}

// ─────────────────────────────────────────
// 自动清理：spawn 指令执行后自动触发
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const path = require('path');
const fs = require('fs');

const SESSIONS_FILE = path.join(
    process.env.USERPROFILE || 'C:\\Users\\Administrator',
    '.openclaw',
    'agents',
    'main',
    'sessions',
    'sessions.json'
);
const SUBAGENTS_FILE = path.join(
    process.env.USERPROFILE || 'C:\\Users\\Administrator',
    '.openclaw',
    'subagents',
    'runs.json'
);

function cleanupSessions(dryRun = false) {
    const deleted = [];
    let sessionsCount = 0;
    let subagentsCount = 0;
    let sessionsError = null;
    let subagentsError = null;

    // Step 1: sessions.json
    if (fs.existsSync(SESSIONS_FILE)) {
        try {
            const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
            sessionsCount = Object.keys(sessions).length;
            const filtered = {};
            Object.entries(sessions).forEach(([k, v]) => {
                if (k.includes('subagent:')) {
                    deleted.push(k);
                } else {
                    filtered[k] = v;
                }
            });
            if (!dryRun) {
                fs.writeFileSync(SESSIONS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
            }
        } catch (e) {
            sessionsError = e.message;
        }
    } else {
        sessionsError = 'sessions.json 不存在';
    }

    // Step 2: subagents/runs.json
    if (fs.existsSync(SUBAGENTS_FILE)) {
        try {
            const runs = JSON.parse(fs.readFileSync(SUBAGENTS_FILE, 'utf8'));
            subagentsCount = Object.keys(runs.runs || runs).length;
            if (!dryRun) {
                fs.writeFileSync(SUBAGENTS_FILE, JSON.stringify({runs: {}}, null, 2), 'utf8');
            }
        } catch (e) {
            subagentsError = e.message;
        }
    }

    return {
        dryRun,
        sessionsFile: SESSIONS_FILE,
        subagentsFile: SUBAGENTS_FILE,
        beforeSessionsCount: sessionsCount,
        afterSessionsCount: dryRun ? sessionsCount - deleted.length : Object.keys(JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'))).length,
        deletedSubagents: deleted,
        subagentsCleared: subagentsCount,
        sessionsError,
        subagentsError
    };
}

if (require.main === module) {
    const args = process.argv.slice(2);

    // cleanup 命令
    if (args[0] === 'cleanup') {
        const dryRun = args.includes('--dry-run');
        const result = cleanupSessions(dryRun);
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    }

    // 默认：parallel tool 执行
    if (args.length === 0) {
        console.log(JSON.stringify({
            error: '用法: node executor.js <json_input>',
            example: 'node executor.js \'{"tools":[{"tool":"Read","params":{"path":"fileA.txt"}}]}\'  OR  node executor.js cleanup [--dry-run]'
        }, null, 2));
        process.exit(1);
    }
    const result = execute(args[0]);
    console.log(JSON.stringify(result, null, 2));
} else {
    module.exports = { execute, isConcurrencySafe, partitionTools, cleanupSessions };
}
