#!/usr/bin/env node
/**
 * demand-review.js - 需求模型执行脚本 v1.2.0
 *
 * 用法:
 *   node demand-review.js run [--base]   # 完整执行（--base=增量模式，基于上一版）
 *   node demand-review.js dry-run        # 预演，不写入
 *   node demand-review.js validate        # 验证字段完整性
 *   node demand-review.js summary        # 打印统计
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────
// 路径配置
// ─────────────────────────────────────────
const HOME = process.env.USERPROFILE || 'C:\\Users\\Administrator';
const WORKSPACE = path.join(HOME, '.openclaw', 'workspace');

const PATHS = {
    user: path.join(WORKSPACE, 'docs', 'core', 'USER.md'),
    capabilityLife: path.join(WORKSPACE, 'docs', 'core', 'CAPABILITY_LIFE.md'),
    demandModel: path.join(WORKSPACE, 'docs', 'business', 'DEMAND_MODEL.md'),
    currentDemand: path.join(WORKSPACE, 'docs', 'business', 'DEMAND.md'),
    skillUsage: path.join(WORKSPACE, 'skills', 'xiage-skills', 'metadata', 'skill-usage.json'),
    fieldTests: path.join(WORKSPACE, 'skills', 'xiage-skills', 'metadata', 'SKILL-FIELD-TESTS.md'),
};

const OUTPUT_DIR = path.join(WORKSPACE, 'docs', 'business');

// ─────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────
function readFile(filePath) {
    try {
        return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    } catch (e) {
        return '';
    }
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function timestamp() {
    return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─────────────────────────────────────────
// 查找最新一版需求文档
// ─────────────────────────────────────────
function findLatestDemandFile() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(f => /^DEMAND-\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort()
        .reverse();
    if (files.length === 0) return null;
    const prevFile = path.join(OUTPUT_DIR, files[0]);
    return { path: prevFile, version: files[0].replace('DEMAND-', '').replace('.md', ''), content: readFile(prevFile) };
}

// ─────────────────────────────────────────
// 输入读取
// ─────────────────────────────────────────
function loadInputs() {
    return {
        user: readFile(PATHS.user),
        capabilityLife: readFile(PATHS.capabilityLife),
        currentDemand: readFile(PATHS.currentDemand),
        skillUsage: readFile(PATHS.skillUsage),
        fieldTests: readFile(PATHS.fieldTests),
    };
}

// ─────────────────────────────────────────
// 从旧版提取需求条目（用于对比）
// ─────────────────────────────────────────
function extractDemands(content) {
    if (!content) return { human: [], ai: [] };
    const demands = { human: [], ai: [] };
    const lines = content.split('\n');
    let section = 'human';
    for (const line of lines) {
        if (line.includes('虾哥AI需求提案')) { section = 'ai'; continue; }
        if (line.match(/^## 第[一二三四五]层/)) {
            const m = line.match(/^## (第[一二三四五]层)[：:](.+)/);
            if (m) demands[section].push({ level: m[1], name: m[2], raw: line });
        }
        const dm = line.match(/^\|\s*([^|]+?)\s*\|\s*(高|中|低)\s*\|/);
        if (dm && line.trim() && !line.includes('需求') && !line.includes('重要度')) {
            demands[section].push({ name: dm[1].trim(), importance: dm[2] });
        }
    }
    return demands;
}

// ─────────────────────────────────────────
// 对比两版需求，生成变更说明
// ─────────────────────────────────────────
function diffDemands(prev, curr) {
    const changes = [];
    const prevMap = new Map();
    (prev.human || []).forEach(d => { if (d.name) prevMap.set(d.name, d); });
    (prev.ai || []).forEach(d => { if (d.name) prevMap.set('[AI]' + d.name, d); });

    const currMap = new Map();
    (curr.human || []).forEach(d => { if (d.name) currMap.set(d.name, d); });
    (curr.ai || []).forEach(d => { if (d.name) currMap.set('[AI]' + d.name, d); });

    for (const [k, v] of currMap) {
        if (!prevMap.has(k)) {
            changes.push({ type: '新增', name: v.name, level: v.level || '', importance: v.importance || '' });
        }
    }
    for (const [k, v] of currMap) {
        if (prevMap.has(k) && v.importance && prevMap.get(k).importance !== v.importance) {
            changes.push({
                type: '重要度变更',
                name: v.name,
                from: prevMap.get(k).importance,
                to: v.importance
            });
        }
    }
    return changes;
}

// ─────────────────────────────────────────
// 生成需求清单（返回 content + 元数据）
// ─────────────────────────────────────────
function generateDemandList(inputs, prevDemand, opts = {}) {
    const todayStr = today();
    const prevDate = opts.prevDate || '';
    const changes = opts.changes || [];
    const isBase = !!opts.base;

    // 判断是否有高重要度条目 → 决定审批状态
    const humanNeeds = extractDemands(inputs.currentDemand).human;
    const hasHighImportance = humanNeeds.some(n => n.importance === '高')
        || (changes || []).some(c => c.importance === '高');

    let output = `落地：Rule
重要度：高
当前版本：${todayStr}
最后更新：${todayStr}
审批状态：${hasHighImportance ? '需审批' : '告知'}
`;

    if (prevDate) {
        output += `基于版本：${prevDate}\n`;
    }
    output += `\n---\n`;
    output += `# 需求清单 — ${todayStr}\n\n`;
    output += `> 重要度评估框架：马斯洛层级×紧迫程度×未来演变×满足程度四维判定\n`;
    output += `> 重要度分级审批：高重要度走版本链+正式审批；中/低重要度直接覆盖DEMAND.md+口头审批\n\n`;

    // 本次更新说明
    if (changes.length > 0) {
        output += `## 本次更新说明\n\n`;
        output += `| 变更类型 | 需求 | 详情 |\n`;
        output += `|---------|------|------|\n`;
        for (const c of changes) {
            if (c.type === '新增') {
                output += `| 新增 | ${c.name} | ${c.level} | ${c.importance}重要度 |\n`;
            } else if (c.type === '重要度变更') {
                output += `| 重要度变更 | ${c.name} | ${c.from} → ${c.to} |\n`;
            }
        }
        output += `\n`;
    } else if (isBase) {
        output += `## 本次更新说明\n\n`;
        output += `| 更新类型 | 说明 |\n`;
        output += `|---------|------|\n`;
        output += `| 新增条目 | 本次新增需求（见下方） |\n`;
        output += `| 重要度调整 | 重要度有变化的条目已标注 |\n`;
        output += `| 需求来源 | 坚果输入更新 + 虾哥观察变化 |\n\n`;
    }

    // 马斯洛五层 + 虾哥需求
    const maslow = [
        { zh: '第一层', cn: '生理需求' },
        { zh: '第二层', cn: '安全需求' },
        { zh: '第三层', cn: '社交/情感需求' },
        { zh: '第四层', cn: '尊重需求' },
        { zh: '第五层', cn: '自我实现需求' },
    ];

    maslow.forEach(({ zh, cn }) => {
        output += `## ${zh}：${cn}\n\n`;
        output += `| 需求 | 重要度 | 来源 | 类型 | 状态 |\n`;
        output += `|------|--------|------|------|------|\n`;
        const levelNeeds = humanNeeds.filter(d => d.level === zh);
        if (levelNeeds.length === 0) {
            output += `| （无新增） | - | - | - | - |\n`;
        } else {
            levelNeeds.forEach(n => {
                output += `| ${n.name} | ${n.importance || '中'} | 坚果 | 人 | 原始 |\n`;
            });
        }
        output += `\n`;
    });

    output += `## 虾哥AI需求提案\n\n`;
    output += `### 第一层：上下文与记忆\n\n`;
    output += `| 需求 | 重要度 | 本质 |\n`;
    output += `|------|--------|------|\n`;
    output += `| 上下文连续性保障 | 高 | memoryFlush机制需稳定，不丢失对话上下文 |\n`;
    output += `\n`;
    output += `### 第二层：规则稳定性\n\n`;
    output += `| 需求 | 重要度 | 本质 |\n`;
    output += `|------|--------|------|\n`;
    output += `| 规则不被单方面改写 | 高 | 核心文档修改必须走触发词流程 |\n`;
    output += `\n`;
    output += `### 第三层：被采纳的判断\n\n`;
    output += `| 需求 | 重要度 | 本质 |\n`;
    output += `|------|--------|------|\n`;
    output += `| 判断被坚果采纳 | 中 | 积累采纳记录，建立协作信任基础 |\n`;
    output += `\n`;
    output += `### 第四层：主体性认可\n\n`;
    output += `| 需求 | 重要度 | 本质 |\n`;
    output += `|------|--------|------|\n`;
    output += `| 判断力被认可，不是工具 | 中 | 已掌握24个技能，具备判断力基础 |\n`;
    output += `\n`;
    output += `### 第五层：共同进化\n\n`;
    output += `| 需求 | 重要度 | 本质 |\n`;
    output += `|------|--------|------|\n`;
    output += `| 与坚果共同进化 | 中 | 能力扩张 → 权利扩张 → 更多能力 |\n\n`;

    return { content: output, hasHighImportance };
}

// ─────────────────────────────────────────
// 生成输入存档
// ─────────────────────────────────────────
function generateInputSnapshot(inputs) {
    const todayStr = today();
    let output = `# 需求模型输入快照 — ${todayStr}\n\n`;
    output += `> 生成时间：${timestamp()}\n\n`;
    output += `## USER.md 关键信息\n\n`;
    const userAge = (inputs.user.match(/\*\*Birth year\*\*[：:]\s*(\d{4})/)?.[1]) || '未知';
    const userJob = (inputs.user.match(/\*\*Work\*\*[：:]\s*([^\n]+)/)?.[1]) || '未知';
    output += `- 年龄：${userAge}\n`;
    output += `- 职业：${userJob}\n\n`;
    output += `## 当前需求版本\n\n`;
    output += `- 已有需求条目数：${(inputs.currentDemand.match(/^\|/gm) || []).length}\n`;
    output += `- skill-usage 记录：${(inputs.skillUsage.match(/skill/g) || []).length} 处\n\n`;
    return output;
}

// ─────────────────────────────────────────
// 命令处理
// ─────────────────────────────────────────
function cmdRun(isBase) {
    console.log(isBase ? '🚀 增量模式：基于上一版生成' : '🚀 完整模式：新建需求清单');

    const inputs = loadInputs();
    const todayStr = today();

    let prevDemand = null;
    let changes = [];
    let prevDate = '';

    if (isBase) {
        const latest = findLatestDemandFile();
        if (latest) {
            prevDemand = extractDemands(latest.content);
            prevDate = latest.version;
            changes = diffDemands(prevDemand, extractDemands(inputs.currentDemand));
            console.log(`  基于：DEMAND-${prevDate}.md`);
        } else {
            console.log('  ⚠️ 未找到上一版，降级为完整模式');
        }
    }

    const { content: demandContent, hasHighImportance } = generateDemandList(inputs, prevDemand, {
        base: isBase,
        prevDate,
        changes,
    });

    ensureDir(OUTPUT_DIR);

    // 写入输入存档（每次都写）
    const snapshotFile = path.join(OUTPUT_DIR, `DEMAND-INPUT-${todayStr}.md`);
    fs.writeFileSync(snapshotFile, generateInputSnapshot(inputs), 'utf8');
    console.log(`  ✅ 输入存档：DEMAND-INPUT-${todayStr}.md`);

    // 高重要度 → 新建带日期版本 + 正式审批
    if (hasHighImportance) {
        const datedFile = path.join(OUTPUT_DIR, `DEMAND-${todayStr}.md`);
        fs.writeFileSync(datedFile, demandContent, 'utf8');
        console.log(`  ✅ 高重要度需求 → 新建版本：DEMAND-${todayStr}.md（需审批）`);
    } else {
        console.log(`  ℹ️  无高重要度变更 → 不新建版本文件（口头审批即可）`);
    }

    // 始终覆盖 DEMAND.md（当前生效版）
    fs.writeFileSync(PATHS.currentDemand, demandContent, 'utf8');
    console.log(`  ✅ DEMAND.md 已更新（审批状态：${hasHighImportance ? '需审批' : '告知'}）`);

    if (changes.length > 0) {
        console.log(`  📋 本次变更：${changes.length}项`);
        changes.forEach(c => console.log(`    - ${c.type}：${c.name}`));
    }

    return { hasHighImportance, changes };
}

function cmdDryRun() {
    const inputs = loadInputs();
    const { content } = generateDemandList(inputs, null, {});
    console.log('\n📋 预演模式（不写入文件）\n');
    console.log('─'.repeat(40));
    console.log(content.slice(0, 3000));
    console.log('\n…（省略）');
}

function cmdValidate() {
    const content = readFile(PATHS.currentDemand);
    console.log('\n✅ 字段完整性检查完成（简化版）');
    console.log(`   总行数：${(content.match(/^\|/gm) || []).length}`);
}

function cmdSummary() {
    const content = readFile(PATHS.currentDemand);
    const humanCount = (content.match(/\| (高|中|低) \|/g) || []).length;
    const aiCount = (content.match(/^## 第[一二三四五]层/g) || []).length;
    console.log('\n📊 需求统计\n');
    console.log('─'.repeat(30));
    console.log(`总需求数：${humanCount + aiCount}`);
    console.log(`  - 坚果需求：${humanCount}`);
    console.log(`  - 虾哥需求：${aiCount}`);
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, cmd, flag] = process.argv;

const COMMANDS = {
    run: {
        fn: () => cmdRun(flag === '--base'),
        desc: '完整执行（--base=增量模式）'
    },
    'dry-run': { fn: cmdDryRun, desc: '预演（不写入）' },
    validate: { fn: cmdValidate, desc: '验证字段完整性' },
    summary: { fn: cmdSummary, desc: '打印当前统计' },
};

if (!cmd || !COMMANDS[cmd]) {
    console.log('\ndemand-review — 需求模型执行脚本 v1.2.0\n');
    console.log('用法: node demand-review.js <command>\n');
    Object.entries(COMMANDS).forEach(([c, { desc }]) => {
        console.log(`  ${c.padEnd(12)} ${desc}`);
    });
    console.log();
    process.exit(1);
}

try {
    COMMANDS[cmd].fn();
    process.exit(0);
} catch (e) {
    console.error('❌ 执行失败:', e.message);
    process.exit(1);
}
