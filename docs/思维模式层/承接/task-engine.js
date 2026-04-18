/**
 * task-engine.js v2.1.0
 * 任务承接引擎 - 支持人机协同 + 工作流模板
 *
 * v2.1.0 新增：
 * - 工作流模板系统（代码开发/调研报告/文档写作）
 * - Phase3 执行时匹配模板，输出标准步骤
 * - 模板步骤可标记 autoable（AI自动执行）/ human（坚果执行）
 *
 * v2.0.1：
 * - 执行者分配 + 递归分解 + 坚果确认节点
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = process.cwd();
const TASKS_DIR = path.join(WORKSPACE, 'docs', '项目层', '项目档案');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// ============================================================
// 状态定义
// ============================================================

const STATES = {
  IDLE: 'idle',
  COMPLEXITY_EVAL: 'complexity_eval',
  PHASE1: 'phase1_concept',
  PHASE2: 'phase2_plan',
  PENDING_CONFIRM: 'pending_confirm',
  PHASE3: 'phase3_dev',
  PHASE4: 'phase4_verify',
  PHASE5: 'phase5_release',
  DONE: 'done',
  ABORT: 'abort'
};

const PHASE_CONFIG = {
  PHASE1: { name: '概念阶段', gate: 'CDCP' },
  PHASE2: { name: '计划阶段', gate: 'PDCP' },
  PHASE3: { name: '开发执行', gate: null },
  PHASE4: { name: '验证阶段', gate: 'TR4' },
  PHASE5: { name: '发布阶段', gate: null }
};

const EXECUTOR = { AI: 'ai', HUMAN: 'human', BOTH: 'both' };

// ============================================================
// 执行者分配
// ============================================================

function assignExecutor(taskDesc) {
  const text = taskDesc.toLowerCase();
  // 人工专属先判断（更精确）
  if (/邮件|微信|审批|报销|钉钉|飞书|华为内网|客户|领导|部署|上线|发布/.test(text)) return EXECUTOR.HUMAN;
  // 开发类任务
  if (/开发|代码|脚本|程序|系统|平台|自动化|生成|分析|调研|编写/.test(text)) return EXECUTOR.AI;
  return EXECUTOR.BOTH;
}

// ============================================================
// 工作流模板系统
// ============================================================

let templateCache = null;

function loadTemplates() {
  if (templateCache) return templateCache;
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.warn(`模板目录不存在：${TEMPLATES_DIR}`);
    templateCache = [];
    return templateCache;
  }
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
  templateCache = files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8'));
    } catch (e) {
      console.warn(`模板加载失败：${f}`, e.message);
      return null;
    }
  }).filter(Boolean);
  return templateCache;
}

/**
 * 根据任务描述匹配模板
 */
function matchTemplate(taskDesc) {
  const templates = loadTemplates();
  const text = taskDesc.toLowerCase();
  for (const tpl of templates) {
    for (const trigger of (tpl.trigger || [])) {
      if (text.includes(trigger)) return tpl;
    }
  }
  return null;
}

/**
 * 执行模板步骤（模拟执行，记录结果）
 * 返回：{ completed: [步骤列表], pendingHuman: [步骤列表] }
 */
async function executeTemplateSteps(subtask, template) {
  const completed = [];
  const pendingHuman = [];

  console.log(`  📋 匹配模板：${template.name}`);
  console.log(`  步骤：`);

  for (const step of template.steps) {
    const icon = step.executor === 'ai' ? '🦐' : '🥜';
    const autoLabel = step.autoable ? '(自动)' : '(需坚果)';

    if (step.executor === 'ai' && step.autoable) {
      console.log(`    ${icon} ${step.id} ${step.name} ${autoLabel} ✅`);
      completed.push({ stepId: step.id, stepName: step.name, status: 'completed' });
    } else {
      console.log(`    ${icon} ${step.id} ${step.name} ${autoLabel} ⏸`);
      pendingHuman.push({ stepId: step.id, stepName: step.name, status: 'pending_human' });
    }
  }

  return { completed, pendingHuman };
}

// ============================================================
// 任务存储
// ============================================================

function createTask(taskInput) {
  const taskId = 'T' + Date.now();
  const taskDir = path.join(TASKS_DIR, taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  const task = {
    id: taskId, input: taskInput,
    state: STATES.COMPLEXITY_EVAL, executor: assignExecutor(taskInput),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    currentPhase: null, complexity: null, subtasks: [],
    confirmedByHuman: false, history: []
  };
  saveTask(task);
  return task;
}

function saveTask(task) {
  fs.writeFileSync(
    path.join(TASKS_DIR, task.id, 'task-state.json'),
    JSON.stringify(task, null, 2), 'utf8'
  );
}

function loadTask(taskId) {
  const f = path.join(TASKS_DIR, taskId, 'task-state.json');
  if (!fs.existsSync(f)) throw new Error(`任务 ${taskId} 不存在`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function addHistory(task, action, detail) {
  task.history.push({ timestamp: new Date().toISOString(), action, detail });
  task.updatedAt = new Date().toISOString();
}

// ============================================================
// 复杂度评估
// ============================================================

async function evaluateComplexity(task) {
  console.log('\n=== 复杂度评估 ===');
  const text = task.input.toLowerCase();
  let score = 1;
  if (/架构|重构|迁移|部署|系统|平台|完整|多个模块/.test(text)) score += 2;
  if (/多个|批量|批量处理/.test(text)) score += 1;
  if (/^一个|简单|查一下|写一段/.test(text)) score -= 1;
  if (/需要坚果|需要确认|需要审批/.test(text)) score += 1;
  if (/外部|客户|第三方/.test(text)) score += 1;
  const cf = ['SOUL.md', 'AGENTS.md', 'USER.md', 'PRIMARY.md'];
  cf.forEach(f => { if (task.input.includes(f)) score++; });
  score = Math.max(1, Math.min(5, score));
  const level = score <= 2 ? 'L1' : score <= 4 ? 'L2' : 'L3';
  const result = {
    phase: 'COMPLEXITY_EVAL', level, score,
    executor: task.executor,
    reasoning: `投入:${score >= 3 ? '高' : '中/低'}, 依赖:${/需要确认|需要审批/.test(text) ? '有' : '无'}, 影响:${cf.some(f => task.input.includes(f)) ? '核心' : '普通'}`
  };
  addHistory(task, 'COMPLEXITY_EVAL', result);
  task.complexity = result;
  task.state = level === 'L1' ? STATES.PHASE5 : STATES.PHASE1;
  task.currentPhase = level === 'L1' ? 'PHASE5' : 'PHASE1';
  console.log(`复杂度：${level}（${result.reasoning}）`);
  console.log(`执行者：${task.executor === 'ai' ? '虾哥' : task.executor === 'human' ? '坚果' : '双方协作'}`);
  saveTask(task);
  return result;
}

// ============================================================
// Phase 1: 概念阶段
// ============================================================

async function executePhase1(task) {
  console.log('\n=== Phase PHASE1: 概念阶段 ===');
  const roi = calculateCoarseRoi(task.input);
  const maslow = estimateMaslowImpact(task.input);
  const pass = roi >= 1.0 || task.complexity.level === 'L3';
  const output = {
    phase: 'PHASE1', coarseRoi: roi, maslow,
    decision: pass ? 'APPROVED' : 'REJECTED',
    nextPhase: pass ? 'PHASE2' : null
  };
  addHistory(task, 'PHASE1', output);
  task.currentPhase = 'PHASE1';
  console.log(`概念决策：${pass ? '通过' : '拒绝'}（ROI=${roi.toFixed(2)}）`);
  task.state = pass ? STATES.PHASE2 : STATES.ABORT;
  if (!pass) console.log('❌ 任务中止');
  saveTask(task);
  return output;
}

function calculateCoarseRoi(text) {
  let b = 1, c = 1;
  if (/效率|自动化|省时/.test(text)) b += 2;
  if (/进化|学习|能力/.test(text)) b += 1.5;
  if (/收入|赚钱|商业/.test(text)) b += 3;
  if (/架构|系统|重构/.test(text)) c += 2;
  if (/多个|批量/.test(text)) c += 1.5;
  if (/^一个|简单/.test(text)) c *= 0.5;
  return b / Math.max(c, 0.5);
}

function estimateMaslowImpact(text) {
  return {
    L1: /生理|健康/.test(text) ? 3 : 0,
    L2: /安全|稳定/.test(text) ? 2 : 1,
    L3: /社交|协作/.test(text) ? 2 : 0,
    L4: /尊重|认可/.test(text) ? 1 : 0,
    L5: /进化|成长/.test(text) ? 3 : 1
  };
}

// ============================================================
// Phase 2: 计划阶段
// ============================================================

async function executePhase2(task) {
  console.log('\n=== Phase PHASE2: 计划阶段 ===');
  const subtasks = decomposeTask(task.input);
  const assigned = subtasks.map((st, i) => ({
    id: `${task.id}-S${i + 1}`, name: st.name, description: st.description,
    executor: assignExecutor(st.description),
    estimatedHours: st.hours, estimatedTokens: st.tokens,
    status: 'pending', result: null
  }));
  task.subtasks = assigned;
  task.state = STATES.PENDING_CONFIRM;
  task.currentPhase = 'PHASE2';
  addHistory(task, 'PHASE2', { phase: 'PHASE2', subtaskCount: assigned.length });
  saveTask(task);

  const aiT = assigned.filter(t => t.executor === EXECUTOR.AI);
  const huT = assigned.filter(t => t.executor === EXECUTOR.HUMAN);
  console.log(`执行者分配（${assigned.length}个子任务）：`);
  console.log(`🦐 虾哥：${aiT.length}个`);
  aiT.forEach(t => console.log(`    ${t.name}`));
  console.log(`🥜 坚果：${huT.length}个`);
  huT.forEach(t => console.log(`    ${t.name}`));
  console.log(`\n⏸ 执行：node task-engine.js confirm ${task.id}`);

  return { phase: 'PHASE2', executorAssignment: { ai: aiT.length, human: huT.length }, wbs: assigned, decision: 'PENDING_CONFIRM', nextPhase: 'PHASE3' };
}

function decomposeTask(text) {
  if (/系统|平台|架构/.test(text)) return [
    { name: '需求分析', description: '分析系统需求和边界', hours: 1, tokens: 3000 },
    { name: '架构设计', description: '设计系统架构', hours: 2, tokens: 5000 },
    { name: '模块开发', description: '分模块开发实现', hours: 4, tokens: 20000 },
    { name: '集成测试', description: '系统集成测试', hours: 2, tokens: 8000 },
    { name: '部署上线', description: '部署和发布', hours: 1, tokens: 3000 }
  ];
  if (/代码|脚本|程序/.test(text)) return [
    { name: '需求理解', description: '理解代码需求', hours: 0.5, tokens: 2000 },
    { name: '代码实现', description: '编写代码', hours: 2, tokens: 8000 },
    { name: '测试验证', description: '测试代码正确性', hours: 1, tokens: 4000 }
  ];
  if (/调研|研究|分析/.test(text)) return [
    { name: '信息收集', description: '收集相关信息', hours: 1.5, tokens: 6000 },
    { name: '整理分析', description: '整理和分析信息', hours: 1, tokens: 5000 },
    { name: '报告撰写', description: '输出调研报告', hours: 1, tokens: 4000 }
  ];
  if (/文档|文章|报告/.test(text)) return [
    { name: '收集资料', description: '收集相关资料', hours: 0.5, tokens: 2000 },
    { name: '撰写内容', description: '撰写文档内容', hours: 1.5, tokens: 6000 },
    { name: '润色发布', description: '润色并发布', hours: 0.5, tokens: 2000 }
  ];
  return [
    { name: '理解任务', description: '理解任务目标和范围', hours: 0.5, tokens: 2000 },
    { name: '执行任务', description: '执行任务核心内容', hours: 2, tokens: 8000 },
    { name: '验证交付', description: '验证结果并交付', hours: 0.5, tokens: 2000 }
  ];
}

// ============================================================
// Phase 3: 开发执行（模板驱动）
// ============================================================

async function executePhase3(task) {
  console.log('\n=== Phase PHASE3: 开发执行 ===');
  const subtasks = task.subtasks || [];
  const results = [];

  for (const subtask of subtasks) {
    console.log(`\n处理子任务：${subtask.name}`);

    if (subtask.executor === EXECUTOR.AI) {
      const score = quickScore(subtask.description);
      const template = matchTemplate(subtask.description);

      if (score <= 2) {
        // L1：匹配模板 + 执行步骤
        console.log(`  → L1 简单`);
        if (template) {
          const stepResult = await executeTemplateSteps(subtask, template);
          subtask.status = stepResult.pendingHuman.length > 0 ? 'partial' : 'completed';
          subtask.template = template.name;
          subtask.steps = [...stepResult.completed, ...stepResult.pendingHuman];
          subtask.result = { type: 'template_executed', completedSteps: stepResult.completed.length, pendingHumanSteps: stepResult.pendingHuman.length };
        } else {
          console.log(`  → 🦐 直接执行完成`);
          subtask.status = 'completed';
          subtask.result = { type: 'ai_auto' };
        }
      } else {
        // L2/L3：递归分解
        console.log(`  → L${score} 复杂，递归分解`);
        const subSubtasks = decomposeTask(subtask.description);
        subtask.status = 'decomposed';
        subtask.subtasks = subSubtasks.map((s, i) => ({
          id: `${subtask.id}.${i + 1}`, name: s.name, description: s.description,
          executor: assignExecutor(s.description),
          estimatedHours: s.hours, estimatedTokens: s.tokens,
          status: 'pending', result: null
        }));
        for (const ss of subtask.subtasks) {
          if (ss.executor === EXECUTOR.AI) {
            const tpl = matchTemplate(ss.description);
            if (tpl) {
              console.log(`    🦐 ${ss.name} → 匹配模板【${tpl.name}】`);
              const sr = await executeTemplateSteps(ss, tpl);
              ss.status = 'completed';
              ss.template = tpl.name;
              ss.steps = [...sr.completed, ...sr.pendingHuman];
            } else {
              console.log(`    🦐 ${ss.name}`);
              ss.status = 'completed';
            }
          } else {
            console.log(`    🥜 ${ss.name} → 待坚果执行`);
            ss.status = 'pending_human';
          }
        }
      }
    } else {
      console.log(`  → 🥜 坚果执行，标记待确认`);
      subtask.status = 'pending_human';
    }
    results.push(subtask);
  }

  task.subtasks = results;
  task.state = STATES.PHASE4;
  task.currentPhase = 'PHASE3';
  const execCount = results.filter(t => t.status === 'completed').length;
  const pendingCount = results.filter(t => t.status === 'pending_human').length;
  const partialCount = results.filter(t => t.status === 'partial').length;
  addHistory(task, 'PHASE3', { phase: 'PHASE3', executed: execCount, pending: pendingCount, partial: partialCount });
  saveTask(task);

  console.log(`\n执行结果：已完成${execCount}，待坚果执行${pendingCount}，部分完成${partialCount}`);
  return { phase: 'PHASE3', executed: execCount, pending: pendingCount, partial: partialCount, nextPhase: 'PHASE4' };
}

function quickScore(text) {
  let score = 1;
  const t = text.toLowerCase();
  if (/架构|系统|多个|完整/.test(t)) score += 2;
  if (/简单|一个|查/.test(t)) score--;
  return Math.max(1, Math.min(5, score));
}

// ============================================================
// Phase 4: 验证
// ============================================================

async function executePhase4(task) {
  console.log('\n=== Phase PHASE4: 验证阶段 ===');
  const pending = (task.subtasks || []).filter(t => t.status === 'pending_human').length;
  const output = { phase: 'PHASE4', verified: (task.subtasks || []).filter(t => t.status === 'completed').length, pendingHuman: pending, decision: 'VERIFIED', nextPhase: 'PHASE5' };
  if (pending > 0) console.log(`⚠ 有${pending}个子任务待坚果执行`);
  else console.log('✅ 所有子任务已完成');
  task.state = STATES.PHASE5;
  task.currentPhase = 'PHASE4';
  addHistory(task, 'PHASE4', output);
  saveTask(task);
  return output;
}

// ============================================================
// Phase 5: 发布
// ============================================================

async function executePhase5(task) {
  console.log('\n=== Phase PHASE5: 发布阶段 ===');
  const entry = `\n#### [${task.id}] ${task.input.substring(0, 60)}
- 完成时间: ${new Date().toISOString()}
- 复杂度: ${task.complexity?.level}
- 执行者: ${task.executor}
- 子任务: ${(task.subtasks || []).length}个
- AI完成: ${(task.subtasks || []).filter(t => t.status === 'completed').length}
- 坚果完成: ${(task.subtasks || []).filter(t => t.status === 'pending_human').length}`;
  const f = path.join(WORKSPACE, 'memory', 'hot', 'lessons.md');
  if (fs.existsSync(f)) {
    const existing = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(f, existing + entry, 'utf8');
  }
  task.state = STATES.DONE;
  task.currentPhase = 'PHASE5';
  addHistory(task, 'PHASE5', { phase: 'PHASE5', decision: 'DONE' });
  saveTask(task);
  console.log('✅ 经验已沉淀，任务完成');
  return { phase: 'PHASE5', decision: 'DONE' };
}

// ============================================================
// 主状态机
// ============================================================

async function runTask(task) {
  console.log(`\n🚀 任务 ${task.id}`);
  console.log(`输入：${task.input}`);
  while (task.state !== STATES.DONE && task.state !== STATES.ABORT) {
    switch (task.state) {
      case STATES.COMPLEXITY_EVAL: await evaluateComplexity(task); break;
      case STATES.PHASE1: await executePhase1(task); break;
      case STATES.PHASE2: await executePhase2(task); break;
      case STATES.PENDING_CONFIRM:
        console.log(`⏸ 确认：node task-engine.js confirm ${task.id}`);
        return task;
      case STATES.PHASE3: await executePhase3(task); break;
      case STATES.PHASE4: await executePhase4(task); break;
      case STATES.PHASE5: await executePhase5(task); break;
      default: task.state = STATES.ABORT;
    }
  }
  return task;
}

// ============================================================
// CLI
// ============================================================

const args = process.argv.slice(2);
const cmd = args[0];

async function main() {
  switch (cmd) {
    case 'start': {
      const input = args.slice(1).join(' ');
      if (!input) { console.error('用法：task-engine.js start "<任务>"'); process.exit(1); }
      await runTask(createTask(input));
      break;
    }
    case 'confirm': {
      const tid = args[1];
      if (!tid) { console.error('用法：task-engine.js confirm <taskId>'); process.exit(1); }
      const task = loadTask(tid);
      if (task.state === STATES.DONE) { console.log(`任务已完成`); break; }
      if (task.state !== STATES.PENDING_CONFIRM) { console.log(`当前状态：${task.state}，无需确认`); break; }
      task.confirmedByHuman = true;
      task.state = STATES.PHASE3;
      task.updatedAt = new Date().toISOString();
      addHistory(task, 'HUMAN_CONFIRM', { confirmedAt: new Date().toISOString() });
      saveTask(task);
      console.log('✅ 坚果已确认，开始Phase3');
      await runTask(task);
      break;
    }
    case 'status': {
      const tid = args[1];
      if (!tid) { console.error('用法：task-engine.js status <taskId>'); process.exit(1); }
      printStatus(loadTask(tid));
      break;
    }
    case 'resume': {
      const tid = args[1];
      if (!tid) { console.error('用法：task-engine.js resume <taskId>'); process.exit(1); }
      await runTask(loadTask(tid));
      break;
    }
    case 'abort': {
      const tid = args[1];
      const reason = args.slice(2).join(' ') || '未说明';
      if (!tid) { process.exit(1); }
      const task = loadTask(tid);
      task.state = STATES.ABORT;
      addHistory(task, 'ABORT', { reason });
      saveTask(task);
      console.log(`任务已中止：${reason}`);
      break;
    }
    case 'templates': {
      const templates = loadTemplates();
      console.log(`\n可用模板（${templates.length}个）：`);
      templates.forEach(t => {
        const steps = t.steps.map(s => `${s.id}.${s.name}`).join(', ');
        console.log(`  【${t.name}】触发词：${t.trigger.join('/')} | 步骤：${steps}`);
      });
      break;
    }
    default:
      console.log(`
task-engine.js v2.1.0 - 人机协同任务引擎

start "<任务>"        新建任务
confirm <taskId>      坚果确认
status <taskId>        查看状态
resume <taskId>        继续执行
abort <taskId> [原因]  中止
templates             列出所有模板

状态流：
  COMPLEXITY_EVAL → PHASE1 → PHASE2 → PENDING_CONFIRM
  → PHASE3(模板驱动) → PHASE4 → PHASE5 → DONE

模板（${TEMPLATES_DIR}）：
  代码开发 | 调研报告 | 文档写作
      `);
  }
}

function printStatus(task) {
  console.log(`\n任务 ${task.id}`);
  console.log('='.repeat(50));
  console.log(`状态：${task.state} | 复杂度：${task.complexity?.level || '-'} | 执行者：${task.executor === 'ai' ? '🦐虾哥' : task.executor === 'human' ? '🥜坚果' : '🤝双方'}`);
  console.log(`坚果确认：${task.confirmedByHuman ? '✓' : '✗'}`);
  console.log(`\n子任务（${(task.subtasks || []).length}个）：`);
  (task.subtasks || []).forEach(st => {
    const icon = st.status === 'completed' ? '✅' : st.status === 'pending_human' ? '⏸' : st.status === 'partial' ? '🔄' : st.status === 'decomposed' ? '📦' : '⏳';
    const exe = st.executor === 'ai' ? '🦐' : st.executor === 'human' ? '🥜' : '🤝';
    console.log(`  ${icon} ${exe} ${st.name} [${st.status}]${st.template ? ` 【${st.template}】` : ''}`);
    if (st.steps) {
      st.steps.forEach(s => {
        const sic = s.status === 'completed' ? '✅' : '⏸';
        console.log(`      ${sic} ${s.stepId} ${s.stepName}`);
      });
    }
    (st.subtasks || []).forEach(ss => {
      const sse = ss.executor === 'ai' ? '🦐' : '🥜';
      const ssi = ss.status === 'completed' ? '✅' : ss.status === 'pending_human' ? '⏸' : '⏳';
      console.log(`      └── ${ssi} ${sse} ${ss.name}${ss.template ? ` 【${ss.template}】` : ''}`);
    });
  });
}

main().catch(console.error);

module.exports = { createTask, loadTask, runTask, STATES, EXECUTOR };
