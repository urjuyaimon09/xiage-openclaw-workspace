#!/usr/bin/env node
/**
 * @exempt-from-check
 * doc-manager/preWriteCheck.js - 文档写入前全面检查 + 规则执行器
 *
 * 用法: node preWriteCheck.js <目标文件路径> [mode]
 *
 * mode:
 *   "new"       - 新建文档（跳过存档，执行新建检查）
 *   "delete"    - 删除/移动操作（执行核心文档保护检查）
 *   (空)        - 修改已有文档
 *
 * 检查项目：
 *   1. 格式检查（头部三字段 / 落地标注 / 层级深度 / 版本历史格式）
 *   2. 路径合规检查（Workspace 目录结构 2.3）
 *   3. 核心文档保护（2.1.1 列表禁止删除/移动）
 *   4. 存档（已有文档修改前）
 *   5. 仪表盘刷新（规则文档修改后）
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..', '..');
const OLD_VERSIONS_DIR = path.join(WORKSPACE, 'old-versions');
const MEMORY_DIR = path.join(WORKSPACE, 'memory');

// ─────────────────────────────────────────
// 工具：解析文档路径（支持根目录和 docs/规则层/ 两位置）
// ─────────────────────────────────────────
function resolveDocPath(docName) {
    const candidates = [
        path.join(WORKSPACE, docName),
        path.join(WORKSPACE, 'docs', '规则层', docName),
    ];
    return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

// ─────────────────────────────────────────
// 1. 获取核心文档列表（从 DOC_RULES 动态解析）
// ─────────────────────────────────────────
function getCoreDocuments() {
    const docRulesPath = resolveDocPath('DOC_RULES.md');
    try {
        const content = fs.readFileSync(docRulesPath, 'utf8');
        // 匹配 2.1.1 宪法级核心文档表格中的所有 `文件名.md`
        const sectionMatch = content.match(/\*\*2\.1\.1 宪法级核心文档\*\*[\s\S]*?\|\s*`([^`]+\.md)`\s*\|/g);
        if (!sectionMatch) return [];
        return sectionMatch.map(m => {
            const match = m.match(/`([^`]+\.md)`/);
            return match ? match[1] : null;
        }).filter(Boolean);
    } catch (e) {
        return [];
    }
}

// ─────────────────────────────────────────
// 2. 获取所有落地状态（从 DOC_RULES 动态解析）
// ─────────────────────────────────────────
function getLandingStates() {
    const docRulesPath = resolveDocPath('DOC_RULES.md');
    try {
        const content = fs.readFileSync(docRulesPath, 'utf8');
        const states = {};
        const regex = /^#{3,4}\s+(\d+\.\d+\.\d+)[^\n]*\n([\s\S]*?)(?=^#{1,4}\s+\d+\.\d+|^## |^# )/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const clause = match[1];
            const body = match[2] || '';
            const landingMatch = body.match(/落地：(?:\*\*)?([A-Za-z]+)(?:\*\*)?/);
            states[clause] = landingMatch ? landingMatch[1] : 'Rule';
        }
        return states;
    } catch (e) {
        return {};
    }
}

// ─────────────────────────────────────────
// 3. 判断是否为规则文档（五大规则）
// ─────────────────────────────────────────
const RULE_DOCS = [
    'DOC_RULES.md', 'CODE_RULES.md', 'LEGISLATION.md',
    'CAPABILITY_LIFE.md', 'SUPERVISION.md'
];

/**
 * 系统文档列表
 */
const SYSTEM_DOCS = [
    'openclaw.json',
    'gateway.cmd',
    'dump.pm2'
];

/**
 * 判断文件名是否属于五大规则文档
 * @param {string} fileName
 * @returns {boolean}
 */
function isRuleDoc(fileName) {
    return RULE_DOCS.includes(fileName);
}

/**
 * 判断文件名是否属于系统文档
 * @param {string} fileName
 * @returns {boolean}
 */
function isSystemDoc(fileName) {
    return SYSTEM_DOCS.includes(fileName);
}

// ─────────────────────────────────────────
// 4. 路径合规检查（Workspace 2.3 + 四层架构 2.5）
// ─────────────────────────────────────────

/**
 * 四层层级归属决策树（DOC_RULES 2.5.2）
 * @param {string} filePath
 * @returns {{ expectedDir: string, reason: string } | null} null=无需判断
 */
function getLayerDecision(filePath) {
    const fileName = path.basename(filePath);
    const relative = filePath.replace(WORKSPACE, '').replace(/\\/g, '/').replace(/^\//, '');
    const text = (fileName + ' ' + relative).toLowerCase();

    // 1. 核心配置文件 → 系统文档
    if (['openclaw.json', 'gateway.cmd', 'dump.pm2'].includes(fileName)) {
        return null; // 绕过层级检查
    }
    // 2. 身份定义文档 → workspace 根目录
    if (['soul.md', 'user.md', 'identity.md', 'agents.md', 'heartbeat.md', 'bootstrap.md', 'memory.md', 'skills-index.md'].includes(fileName.toLowerCase())) {
        if (relative.includes('/')) return null; // already in subdir, skip
        return { expectedDir: 'workspace root', reason: '身份定义文档在根目录白名单' };
    }
    // 3. 项目文档 → docs/项目层/
    if (text.includes('项目') || text.includes('project')) {
        return { expectedDir: 'docs/项目层/<项目名>/', reason: '项目文档' };
    }
    // 4. 思维执行工具 → docs/思维模式层/承接/
    if (text.includes('task-engine') || text.includes('工作流模板') || text.includes('workflow template')) {
        return { expectedDir: 'docs/思维模式层/承接/', reason: '思维执行工具' };
    }
    // 5. 认知/驱动机制 → docs/心智层/
    if (text.includes('认知') || text.includes('驱动') || text.includes('心智') || text.includes('状态采集') || text.includes('attention')) {
        return { expectedDir: 'docs/心智层/', reason: '认知/驱动机制' };
    }
    // 6. 文档索引/加载 → docs/意识层/
    if (text.includes('doc-index') || text.includes('doc-loader') || text.includes('索引') || text.includes('加载')) {
        return { expectedDir: 'docs/意识层/', reason: '文档索引/加载机制' };
    }
    // 7. 6模型文件 → docs/思维模式层/6模型/
    if (text.includes('model') || text.includes('模型') || text.includes('6模型') || text.includes('prompt')) {
        return { expectedDir: 'docs/思维模式层/6模型/', reason: '6模型/思维模式文件' };
    }
    // 8. 归档文档 → docs/archive/
    if (text.includes('archive') || text.includes('归档') || text.includes('废弃') || text.includes('old-version')) {
        return { expectedDir: 'docs/archive/', reason: '归档文档' };
    }
    return null; // 无法判断，交由人工
}

/**
 * 检查文件路径是否符合 Workspace 目录结构规则（DOC_RULES 2.3）
 * @param {string} filePath
 * @returns {string[]} 错误列表（空=合规）
 */
const ALLOWED_DIRS = [
    'docs/规则层/', 'docs/business/', 'docs/项目层/', 'docs/archive/',
    'docs/意识层/', 'docs/思维模式层/', 'docs/心智层/', 'docs/身份层/',
    'skills/', 'memory/', 'scripts/', 'scripts/archived/',
    'old-versions/'
];

const ROOT_ALLOWED_FILES = [
    'SOUL.md', 'USER.md', 'IDENTITY.md', 'AGENTS.md',
    'HEARTBEAT.md', 'BOOTSTRAP.md', 'MEMORY.md', 'SKILLS-INDEX.md'
];

function checkPathCompliance(filePath) {
    const errors = [];
    const fileName = path.basename(filePath);
    const relative = filePath.replace(WORKSPACE, '').replace(/\\/g, '/').replace(/^\//, '');

    // 根目录白名单文件允许在根目录
    if (!relative.includes('/')) {
        if (ROOT_ALLOWED_FILES.includes(fileName)) {
            return errors; // 合规
        }
        // 其他根目录文件检查是否应归入 docs/
        if (fileName.endsWith('.md') && !ROOT_ALLOWED_FILES.includes(fileName)) {
            errors.push(`❌ 路径不合规：${fileName} 应归入 docs/ 目录，不应放在根目录`);
            errors.push(`   正确路径示例：docs/规则层/${fileName} 或 docs/business/${fileName}`);
        }
        return errors;
    }

    // 检查是否在允许的目录树下
    const inAllowedDir = ALLOWED_DIRS.some(dir => relative.startsWith(dir));
    if (!inAllowedDir) {
        errors.push(`❌ 路径不合规：${relative}`);
        errors.push(`   允许的目录：${ALLOWED_DIRS.join(' / ')}`);
    }

    return errors;
}

// ─────────────────────────────────────────
// 5. 核心文档保护检查（禁止删除/移动 2.1.1 列表）
// ─────────────────────────────────────────
function checkCoreDocProtection(filePath, mode) {
    const errors = [];
    const fileName = path.basename(filePath);
    const coreDocs = getCoreDocuments();

    if (!coreDocs.includes(fileName)) {
        return errors; // 不是核心文档，不受限
    }

    if (mode === 'delete') {
        errors.push(`🔴 核心文档禁止删除：${fileName}`);
        errors.push(`   如需归档，请移入 docs/archive/，禁止直接删除`);
    }

    // 检查是否从正确位置删除
    const expectedPath = path.join(WORKSPACE, 'docs', 'core', fileName);
    if (!fs.existsSync(filePath) && fs.existsSync(expectedPath)) {
        errors.push(`🔴 核心文档禁止移动：${fileName} 必须保留在 docs/规则层/ 目录下`);
    }

    return errors;
}

// ─────────────────────────────────────────
// 6. 获取当前版本号
// ─────────────────────────────────────────
function getCurrentVersion(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const versionMatches = content.match(/^\| (v[\d.]+) \|/gm);
        if (!versionMatches || versionMatches.length === 0) return null;
        const lastMatch = versionMatches[versionMatches.length - 1];
        return lastMatch.match(/\| (v[\d.]+) \|/)[1];
    } catch (e) {
        return null;
    }
}

// ─────────────────────────────────────────
// 7. 核心文档存档
// ─────────────────────────────────────────
function archiveOldVersion(targetFile) {
    const fileName = path.basename(targetFile);
    const version = getCurrentVersion(targetFile) || 'v0.0.0';
    if (!fs.existsSync(OLD_VERSIONS_DIR)) {
        fs.mkdirSync(OLD_VERSIONS_DIR, { recursive: true });
    }
    const archivePath = path.join(OLD_VERSIONS_DIR, fileName + '.' + version + '.md');
    fs.writeFileSync(archivePath, fs.readFileSync(targetFile, 'utf8'), 'utf8');
    return { archivePath, version };
}

// ─────────────────────────────────────────
// 8. 新建文档检查（格式）
// ─────────────────────────────────────────
function checkNewDocument(content) {
    const errors = [];

    // 头部三字段
    if (!/落地：/.test(content)) errors.push('❌ 缺少「落地：{状态}」字段');
    if (!/当前版本：v\d+\.\d+\.\d+/.test(content)) errors.push('❌ 缺少「当前版本：vX.X.X」字段');
    if (!/最后更新：\d{4}-\d{2}-\d{2}/.test(content)) errors.push('❌ 缺少「最后更新：YYYY-MM-DD」字段');

    // 三级条款落地标记
    const clauseRegex = /^#{3,4}\s+(\d+\.\d+\.\d+)[^\n]*\n([\s\S]*?)(?=^#{1,4}\s+\d+\.\d+|^## |^# )/gm;
    let match;
    while ((match = clauseRegex.exec(content)) !== null) {
        const clauseId = match[1];
        const body = match[2] || '';
        if (!/落地：/.test(body)) {
            errors.push(`❌ 条款 ${clauseId} 缺少「落地：{状态}」标注`);
        }
    }

    // 层级深度（禁止超过三级）
    const lines = content.split('\n');
    for (const line of lines) {
        if (/^#{5,}\s/.test(line)) {
            errors.push(`❌ 存在四级或更深层级：${line.trim().slice(0, 50)}`);
        }
    }

    // 版本历史行格式
    const versionRowRegex = /^\| v\d+\.\d+\.\d+ \| \d{4}-\d{2}-\d{2} \|/;
    const badRows = lines.filter(l => l.startsWith('| v') && !versionRowRegex.test(l));
    if (badRows.length > 0) {
        errors.push(`❌ 版本历史行格式错误：${badRows[0].trim().slice(0, 60)}`);
    }

    return errors;
}

// ─────────────────────────────────────────
// 9. 系统文档格式检查（简化版）
// ─────────────────────────────────────────
function checkSystemDocFormat(filePath) {
    const errors = [];
    const fileName = path.basename(filePath);
    if (fileName === 'openclaw.json') {
        try {
            JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            errors.push(`❌ openclaw.json JSON 格式错误：${e.message}`);
        }
    }
    // gateway.cmd / dump.pm2 只检查存在性和非空
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content || content.trim().length === 0) {
        errors.push(`❌ ${fileName} 为空`);
    }
    return errors;
}

// ─────────────────────────────────────────
// 10. 已有文档修改检查（格式）
// ─────────────────────────────────────────
function checkExistingDocument(filePath) {
    const errors = [];
    const content = fs.readFileSync(filePath, 'utf8');

    // 三级条款落地标记
    const clauseRegex = /^#{3,4}\s+(\d+\.\d+\.\d+)[^\n]*\n([\s\S]*?)(?=^#{1,4}\s+\d+\.\d+|^## |^# )/gm;
    let match;
    while ((match = clauseRegex.exec(content)) !== null) {
        const clauseId = match[1];
        const body = match[2] || '';
        if (!/落地：/.test(body)) {
            errors.push(`❌ 条款 ${clauseId} 缺少「落地：{状态}」标注`);
        }
    }

    // 层级深度
    const lines = content.split('\n');
    for (const line of lines) {
        if (/^#{5,}\s/.test(line)) {
            errors.push(`❌ 存在四级或更深层级：${line.trim().slice(0, 50)}`);
        }
    }

    // 版本历史行格式
    const versionRowRegex = /^\| v\d+\.\d+\.\d+ \| \d{4}-\d{2}-\d{2} \|/;
    const badRows = lines.filter(l => l.startsWith('| v') && !versionRowRegex.test(l));
    if (badRows.length > 0) {
        errors.push(`❌ 版本历史行格式错误：${badRows[0].trim().slice(0, 60)}`);
    }

    return errors;
}

// ─────────────────────────────────────────
// 11. 刷新仪表盘
// ─────────────────────────────────────────
function refreshDashboard() {
    const { execSync } = require('child_process');
    try {
        const result = execSync('node "' + path.join(__dirname, 'refresh-dashboard.js') + '" force', {
            cwd: WORKSPACE, encoding: 'utf8', timeout: 10000
        });
        return JSON.parse(result.trim());
    } catch (e) {
        return { updated: false, reason: 'exec-error' };
    }
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, targetFile, mode] = process.argv;

if (!targetFile) {
    console.error('用法: node preWriteCheck.js <目标文件路径> [mode]');
    console.error('  mode: "new"=新建 | "delete"=删除/移动 | (空)=修改已有');
    process.exit(1);
}

const fileName = path.basename(targetFile);
const fileExists = fs.existsSync(targetFile);
let allErrors = [];

// ── 路径合规检查（所有操作模式均执行）──
const pathErrors = checkPathCompliance(targetFile);
allErrors = allErrors.concat(pathErrors);

// ── 删除/移动操作：核心文档保护 ──
if (mode === 'delete') {
    const protectionErrors = checkCoreDocProtection(targetFile, 'delete');
    allErrors = allErrors.concat(protectionErrors);
}

// ── 新建文档 ──
if (mode === 'new' || (!fileExists && pathErrors.length === 0)) {
    console.log(`\n📄 新建文档检查: ${fileName}`);
    console.log('─'.repeat(40));
    if (pathErrors.length > 0) {
        allErrors.forEach(e => console.log('  ' + e));
        console.log('\n❌ 路径不合规，禁止创建');
        process.exit(1);
    }
    console.log('✅ 路径合规');

    // 层归属决策检查（DOC_RULES 2.5.2）
    const decision = getLayerDecision(targetFile);
    if (decision) {
        const relative = targetFile.replace(WORKSPACE, '').replace(/\\/g, '/').replace(/^\//, '');
        const parentDir = relative.includes('/') ? relative.split('/').slice(0, -1).join('/') + '/' : '';
        if (parentDir !== decision.expectedDir && decision.expectedDir !== 'workspace root') {
            console.log(`\n❌ 层归属不合规：${fileName}`);
            console.log(`   判断依据：${decision.reason}`);
            console.log(`   当前路径：${parentDir || '(根目录)'}`);
            console.log(`   应归属：${decision.expectedDir}`);
            console.log('\n请先将文件移到正确目录，再执行写入');
            process.exit(1);
        }
        console.log(`✅ 层归属确认：${decision.reason} → ${decision.expectedDir}`);
    } else {
        console.log('⚠️  无法自动判断层归属，请确认文档应放在哪个层级');
    }

    console.log('📝 格式检查请在写入后由我（虾哥）确认');
    process.exit(0);
}

// ── 删除/移动操作 ──
if (mode === 'delete') {
    console.log(`\n🗑️  删除/移动检查: ${fileName}`);
    console.log('─'.repeat(40));
    if (allErrors.length > 0) {
        allErrors.forEach(e => console.log('  ' + e));
        console.log('\n🔴 核心文档禁止删除/移动');
        process.exit(1);
    }
    console.log('✅ 非核心文档，允许删除');
    process.exit(0);
}

// ── 修改已有文档 ──
console.log(`\n📝 文档修改检查: ${fileName}`);
console.log('─'.repeat(40));

// 系统文档 → 简化检查（存档在 beforeWrite 坚果同意后执行）
if (isSystemDoc(fileName)) {
    if (!fileExists) {
        console.log(`❌ 系统文档不存在：${fileName}`);
        process.exit(1);
    }
    const sysErrors = checkSystemDocFormat(targetFile);
    if (sysErrors.length > 0) {
        sysErrors.forEach(e => console.log('  ' + e));
        console.log('\n❌ 格式检查未通过');
        process.exit(1);
    }
    console.log('✅ 系统文档格式检查通过');
    console.log('✅ 存档将在「同意变更并升级版本」后由 beforeWrite 执行');
    console.log(JSON.stringify({ pass: true, archived: false, isSystemDoc: true, errors: [] }, null, 2));
    process.exit(0);
}

// 规则文档 → 完整检查（原有逻辑）
// 路径合规（针对已有文件重新确认）
if (pathErrors.length > 0) {
    pathErrors.forEach(e => console.log('  ' + e));
    console.log('\n❌ 路径不合规');
    process.exit(1);
}
console.log('✅ 路径合规');

// 存档
const { archivePath, version } = archiveOldVersion(targetFile);
console.log(`✅ 存档完成: ${fileName} → ${version}`);

// 格式检查
const formatErrors = checkExistingDocument(targetFile);
allErrors = allErrors.concat(formatErrors);

// 落地状态
const landingStates = getLandingStates();
const liveCount = Object.values(landingStates).filter(s => s === 'Live').length;
const pendingCount = Object.values(landingStates).filter(s => s.startsWith('Pending')).length;
console.log(`\n📊 落地状态：Live ${liveCount} 个 | Pending ${pendingCount} 个`);

// 结果
if (allErrors.length > 0) {
    console.log('\n❌ 检查未通过：');
    allErrors.forEach(e => console.log('  ' + e));
    console.log('\n⚠️  已存档但未执行写入，请修复后重试');
    process.exit(1);
} else {
    if (isRuleDoc(fileName)) {
        const dashResult = refreshDashboard();
        if (dashResult.updated) {
            console.log(`\n📊 仪表盘刷新完成（${dashResult.date}）`);
        }
    }
    console.log('\n✅ 全部检查通过，可以执行写入');
    console.log(JSON.stringify({ pass: true, archived: true, dashboardUpdated: isRuleDoc(fileName), errors: [] }, null, 2));
    process.exit(0);
}
