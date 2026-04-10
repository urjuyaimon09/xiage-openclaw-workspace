#!/usr/bin/env node
/**
 * refresh-dashboard.js - rules-dashboard 全量刷新
 *
 * 从各规则文档实时解析，重新生成 rules-dashboard.md
 * 由 preWriteCheck / cron / executor 调用
 *
 * 动态发现机制：
 *   - 扫描 LEGISLATION.md 2.4 规则任命表格，动态获取所有规则文档
 *   - 新文档通过 LEGISLATION.md 立法流程产生后，下次刷新自动出现
 *
 * 用法: node refresh-dashboard.js [force]
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..', '..');
const DASHBOARD_PATH = path.join(WORKSPACE, 'docs', 'archive', 'rules-dashboard.md');
const EXECUTION_LOG = path.join(WORKSPACE, 'docs', 'core', 'supervision', 'rules-execution-log.jsonl');
const SUPERVISION_LOG = path.join(WORKSPACE, 'docs', 'core', 'supervision', 'supervision-issues.jsonl');

const SIGNAL_LAMP = { Live: '🟢', Rule: '🔵', Pending: '🟡', Missing: '🔴' };

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

function today() { return new Date().toISOString().slice(0, 10); }

// ─────────────────────────────────────────
// 核心：动态解析 LEGISLATION.md 2.4 规则任命表
// ─────────────────────────────────────────
function parseAppointmentTable() {
    const legPath = path.join(WORKSPACE, 'docs', 'core', 'LEGISLATION.md');
    if (!fs.existsSync(legPath)) return { rows: [], error: 'LEGISLATION.md not found' };
    const content = fs.readFileSync(legPath, 'utf8');

    const sectionMatch = content.match(/### 2\.4 规则任命\n\n([\s\S]*?)(?=\n## |\n# )/);
    if (!sectionMatch) return { rows: [], error: '2.4 not found' };

    const rows = [];
    // 匹配三列表格：| `doc` | duty | category |
    const rowMatches = sectionMatch[1].match(/\| `([^`]+)` \| ([^|]+) \| ([^|]+) \|/g) || [];
    for (const row of rowMatches) {
        const m = row.match(/\| `([^`]+)` \| ([^|]+) \| ([^|]+) \|/);
        if (m) {
            rows.push({
                doc: m[1].trim(),
                duty: m[2].trim(),
                category: m[3].trim()
            });
        }
    }
    return { rows, error: null };
}

// ─────────────────────────────────────────
// 从文档头部读取落地状态
// ─────────────────────────────────────────
function extractLandingState(filePath) {
    if (!fs.existsSync(filePath)) return 'Missing';
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const m = content.match(/^落地：(.+)$/m);
        if (m) {
            const s = m[1].trim();
            if (s.includes('Live')) return 'Live';
            if (s.includes('Pending')) return 'Pending';
            if (s.includes('Reference')) return 'Reference';
            return 'Rule';
        }
        return 'Rule';
    } catch {
        return 'Rule';
    }
}

function getRuleStatus(filePath) {
    const state = extractLandingState(filePath);
    const lamp = SIGNAL_LAMP[state] || '🔵';
    return { state, lamp };
}

// ─────────────────────────────────────────
// 执行日志统计（近7天）
// ─────────────────────────────────────────
function getLogStats() {
    const entries = readJsonl(EXECUTION_LOG);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();
    const recent = entries.filter(e => e.timestamp >= cutoff);
    return {
        pass: recent.filter(e => e.result === 'pass').length,
        fail: recent.filter(e => e.result === 'fail').length,
        total: recent.length
    };
}

// ─────────────────────────────────────────
// 监督问题记录（近30天）
// ─────────────────────────────────────────
function getRecentIssues() {
    const entries = readJsonl(SUPERVISION_LOG);
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const cutoff = last30Days.toISOString();
    return entries.filter(e => e.timestamp >= cutoff && e.type === 'supervision_issue');
}

// ─────────────────────────────────────────
// 生成 dashboard
// ─────────────────────────────────────────
function generateDashboard() {
    const date = today();
    const { rows: appointments, error } = parseAppointmentTable();

    if (error) {
        console.error('Warning: ' + error);
    }

    // 按分类分组（category 来自 LEGISLATION.md 2.4 第三列）
    const groupMap = {
        '立法权（规则制定）': [],
        '行政权（规则执行）': [],
        '司法权（规则监督）': [],
        '元治理': [],
    };

    for (const { doc, duty, category } of appointments) {
        // 文档路径：先查根目录，再查 docs/core/
        const candidates = [path.join(WORKSPACE, doc), path.join(WORKSPACE, 'docs', 'core', doc)];
        const filePath = candidates.find(p => fs.existsSync(p)) || candidates[0];
        const { state, lamp } = getRuleStatus(filePath);
        const group = category || null;
        if (group && groupMap[group] !== undefined) {
            groupMap[group].push({
                ruleDomain: duty,
                doc,
                lamp,
                state,
                remark: `引用 ${doc}`
            });
        }
    }

    const logStats = getLogStats();
    const recentIssues = getRecentIssues();

    // 监督问题行
    const issueRows = recentIssues.slice(0, 10).map(i => ({
        time: i.timestamp.slice(0, 10),
        rule: i.rule || '未知',
        issue: (i.issue || '').slice(0, 60),
        source: i.source || '',
        status: '🟠 待改善'
    }));

    // 生成 markdown
    function sectionTable(title, items) {
        if (items.length === 0) return `### ${title}\n\n（暂无记录）\n`;
        const header = '| 规则领域 | 对应文档 | 信号灯 | 备注 |\n|---|---|---|---|';
        const rows = items.map(r =>
            `| ${r.ruleDomain} | ${r.doc} | ${r.lamp} ${r.state} | ${r.remark} |`
        ).join('\n');
        return `### ${title}\n\n${header}\n${rows}\n`;
    }

    const md = `# 规则治理仪表盘

> ⚠️ 本文件由 doc-manager / code-manager / supervision-skill 自动维护，请勿手动修改。
> 定位：L4 元治理工具，为坚果和虾哥提供规则体系全局视图
> 内容由 refresh-dashboard.js 自动生成

最后刷新：${date}

---

## 一、规则体系三层架构

| 层级 | 范围 | 说明 |
|---|---|---|
| 核心文档层 | L0宪法 + L1立法 | 五基座文档，现有规则体系根基 |
| 业务层 | L2-L5 | 能力/协作/治理/元治理，2-5阶段落地后填充 |
| 项目层 | 具体项目/任务 | 后续项目级规则，按需填充 |

---

## 二、规则体系全景图

> 文档列表动态解析自 LEGISLATION.md 2.4 规则任命；新文档通过立法流程产生后，下次刷新自动出现。

${sectionTable('2.1 立法权（规则制定）', groupMap['立法权（规则制定）'])}
${sectionTable('2.2 行政权（规则执行）', groupMap['行政权（规则执行）'])}
${sectionTable('2.3 司法权（规则监督）', groupMap['司法权（规则监督）'])}

---

## 三、执行日志摘要

| 指标 | 数值 |
|---|---|
| 近7天执行日志 | ${logStats.total} 条（通过 ${logStats.pass} / 失败 ${logStats.fail}）|

---

## 四、信号灯说明

| 信号灯 | 状态 | 含义 |
|---|---|---|
| 🟢 绿 | Live | 有规则 + 代码已写 + 函数已运行 |
| 🔵 蓝 | Rule | 有规则 + 已入架构 + 制度性监督就绪 |
| 🟡 黄 | Pending | 有规则 + 待落地/待实现 |
| 🔴 红 | Missing | 应有规则但尚无对应文档 |
| 🟠 橙 | 监督问题 | 规则存在但执行发现偏差 |

---

## 五，监督反馈记录

| 时间 | 规则 | 问题描述 | 来源 | 状态 |
|---|---|---|---|---|
${issueRows.length > 0 ? issueRows.map(i => `| ${i.time} | ${i.rule} | ${i.issue} | ${i.source} | ${i.status} |`).join('\n') : '（暂无记录，有问题实时追加）'}
`;

    return md;
}

// ─────────────────────────────────────────
// 主执行
// ─────────────────────────────────────────
const [, , force] = process.argv;

try {
    const newContent = generateDashboard();
    const existing = fs.existsSync(DASHBOARD_PATH) ? fs.readFileSync(DASHBOARD_PATH, 'utf8') : '';
    const lastRefresh = existing.match(/最后刷新：(\d{4}-\d{2}-\d{2})/)?.[1];
    const todayStr = today();

    if (!force && lastRefresh === todayStr) {
        console.log(JSON.stringify({ updated: false, reason: 'already-refreshed-today', date: todayStr }));
        process.exit(0);
    }

    fs.writeFileSync(DASHBOARD_PATH, newContent, 'utf8');
    console.log(JSON.stringify({ updated: true, date: todayStr }));
} catch (err) {
    console.error(JSON.stringify({ updated: false, error: err.message }));
    process.exit(1);
}
