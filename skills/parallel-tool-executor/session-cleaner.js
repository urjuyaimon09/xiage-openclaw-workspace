#!/usr/bin/env node
/**
 * session-cleaner - 清理 zombie subagent sessions
 *
 * 功能：
 * 1. 从 sessions.json 删除所有 subagent entries
 * 2. 清空 subagents/runs.json（需要 gateway restart 生效）
 *
 * 用法: node executor.js cleanup [--dry-run]
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────
// 路径配置
// ─────────────────────────────────────────
const AGENT_MAIN_PATH = path.join(
    process.env.USERPROFILE || 'C:\\Users\\Administrator',
    '.openclaw',
    'agents',
    'main'
);
const SESSIONS_FILE = path.join(AGENT_MAIN_PATH, 'sessions', 'sessions.json');
const SUBAGENTS_FILE = path.join(
    process.env.USERPROFILE || 'C:\\Users\\Administrator',
    '.openclaw',
    'subagents',
    'runs.json'
);

// ─────────────────────────────────────────
// 核心清理函数
// ─────────────────────────────────────────
function cleanup(dryRun = false) {
    const results = {
        sessionsFile: SESSIONS_FILE,
        subagentsFile: SUBAGENTS_FILE,
        dryRun,
        beforeSessions: null,
        afterSessions: null,
        deletedSubagents: [],
        errors: []
    };

    // ── Step 1: 清理 sessions.json ──
    if (!fs.existsSync(SESSIONS_FILE)) {
        results.errors.push(`sessions.json 不存在: ${SESSIONS_FILE}`);
    } else {
        try {
            const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
            const sessions = JSON.parse(raw);
            results.beforeSessions = Object.keys(sessions).length;

            const before = Object.keys(sessions).length;
            const filtered = {};
            Object.entries(sessions).forEach(([k, v]) => {
                if (k.includes('subagent:')) {
                    results.deletedSubagents.push(k);
                } else {
                    filtered[k] = v;
                }
            });
            results.afterSessions = Object.keys(filtered).length;

            if (!dryRun) {
                fs.writeFileSync(SESSIONS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
            }
        } catch (e) {
            results.errors.push(`sessions.json 操作失败: ${e.message}`);
        }
    }

    // ── Step 2: 清空 subagents/runs.json ──
    if (!fs.existsSync(SUBAGENTS_FILE)) {
        results.errors.push(`subagents/runs.json 不存在: ${SUBAGENTS_FILE}`);
    } else {
        results.subagentsBefore = Object.keys(
            JSON.parse(fs.readFileSync(SUBAGENTS_FILE, 'utf8'))
        ).length;
        if (!dryRun) {
            // 写一个空的 {runs:{}} 结构
            fs.writeFileSync(SUBAGENTS_FILE, JSON.stringify({runs: {}}, null, 2), 'utf8');
        }
    }

    return results;
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');

    if (args.includes('cleanup') || args.length === 0) {
        const result = cleanup(dryRun);
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(JSON.stringify({
            error: '用法: node executor.js cleanup [--dry-run]',
            example: 'node executor.js cleanup --dry-run'
        }, null, 2));
    }
} else {
    module.exports = { cleanup };
}
