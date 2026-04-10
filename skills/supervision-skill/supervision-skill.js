#!/usr/bin/env node
/**
 * supervision-skill.js - 监督巡检 skill
 *
 * 执行监督报告，扫描执行日志 + 生成对话探针
 * 发送至 webchat + 飞书群
 * 由 cron 定时任务触发（每日执行）
 *
 * 用法: node supervision-skill.js [mode]
 *   mode = 'report'  → 生成并发送每日监督报告（默认）
 *   mode = 'check'   → 仅扫描执行日志，不发报告
 *   mode = 'probe'   → 仅生成对话探针
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..', '..');
const EXECUTION_LOG = path.join(WORKSPACE, 'docs', 'core', 'supervision', 'rules-execution-log.jsonl');
const SUPERVISION_LOG = path.join(WORKSPACE, 'docs', 'core', 'supervision', 'supervision-issues.jsonl');
const MEMORY_DIR = path.join(WORKSPACE, 'memory');

// ─────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────
function readJsonl(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return content.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
}

function appendJsonl(filePath, obj) {
    fs.appendFileSync(filePath, JSON.stringify(obj, null, '') + '\n', 'utf8');
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}

// ─────────────────────────────────────────
// 自动化通道：扫描执行日志
// ─────────────────────────────────────────
function checkExecutionLog(days = 7) {
    const entries = readJsonl(EXECUTION_LOG);
    const cutoff = daysAgo(days);
    const recent = entries.filter(e => e.timestamp >= cutoff);

    const pass = recent.filter(e => e.result === 'pass').length;
    const fail = recent.filter(e => e.result === 'fail').length;
    const issues = recent.filter(e => e.result === 'fail');

    return { pass, fail, total: recent.length, issues };
}

// ─────────────────────────────────────────
// 对话探针：生成问题
// ─────────────────────────────────────────
const RULE_PROBES = [
    { rule: '核心文档修改必须先授权', question: '最近有没有未获授权就修改核心文档的情况？请举例' },
    { rule: '「看XX文档」必须走 query()', question: '最近有没有直接 read 而绕过了 query() 的情况？' },
    { rule: '提案格式必须包含四项', question: '最近有没有发现提案格式不完整的情况？' },
    { rule: 'Heartbeat 每30分钟必须执行', question: '最近有没有 Heartbeat 漏跑或超时的情况？' },
    { rule: 'commit 前必须跑 preCommitCheck', question: '最近有没有 commit 前忘记跑检查的情况？' },
];

function generateProbes(count = 2) {
    // 随机选两条探针
    const shuffled = [...RULE_PROBES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(p => ({
        rule: p.rule,
        question: p.question
    }));
}

// ─────────────────────────────────────────
// 监督报告格式化
// ─────────────────────────────────────────
function formatReport(execResult, probes) {
    const date = today();
    const execRate = execResult.total === 0 ? '无' :
        `${Math.round(execResult.pass / execResult.total * 100)}%`;

    let report = `【监督巡检报告】${date}\n\n`;
    report += `📊 自动化通道\n`;
    report += `- 近7天执行日志：${execResult.pass}条通过，${execResult.fail}条异常\n`;
    if (execResult.issues.length > 0) {
        report += `- 异常项：\n`;
        execResult.issues.forEach(i => {
            report += `  - [${i.result.toUpperCase()}] ${i.rule}（${i.detail || '无详情'}）\n`;
        });
    } else {
        report += `- 无异常项 ✅\n`;
    }

    report += `\n🎯 对话通道（Rule 规则探针）\n`;
    probes.forEach((p, idx) => {
        report += `${idx + 1}. ${p.question}\n`;
    });

    report += `\n回复后记录入监督日志。如无异常也请告知"无问题"。`;

    return report;
}

// ─────────────────────────────────────────
// 写监督问题日志（自动化通道发现异常时）
// ─────────────────────────────────────────
function logIssues(issues) {
    const timestamp = new Date().toISOString();
    issues.forEach(issue => {
        appendJsonl(SUPERVISION_LOG, {
            timestamp,
            type: 'supervision_issue',
            rule: issue.rule,
            issue: issue.detail || '执行结果为 fail',
            source: 'live_log',
            session: 'supervision-cron'
        });
    });
}

// ─────────────────────────────────────────
// 写探针记录（等待坚果回复）
// ─────────────────────────────────────────
function logProbes(probes) {
    const timestamp = new Date().toISOString();
    probes.forEach(probe => {
        appendJsonl(SUPERVISION_LOG, {
            timestamp,
            type: 'dialogue_probe_pending',
            rule: probe.rule,
            probe_question: probe.question,
            conclusion: 'pending',
            session: 'supervision-cron'
        });
    });
}

// ─────────────────────────────────────────
// 主执行
// ─────────────────────────────────────────
function run(mode = 'report') {
    const execResult = checkExecutionLog(7);

    if (mode === 'check') {
        console.log(JSON.stringify(execResult, null, 2));
        return;
    }

    if (mode === 'probe') {
        const probes = generateProbes(2);
        console.log(JSON.stringify(probes, null, 2));
        return;
    }

    // report 模式
    const probes = generateProbes(2);
    const report = formatReport(execResult, probes);

    // 异常写入监督问题日志
    if (execResult.issues.length > 0) {
        logIssues(execResult.issues);
    }

    // 探针写入监督日志（等待回复）
    logProbes(probes);

    console.log(JSON.stringify({ report, execResult, probes }, null, 2));
    return { report, execResult, probes };
}

const [,, mode] = process.argv;
run(mode || 'report');
