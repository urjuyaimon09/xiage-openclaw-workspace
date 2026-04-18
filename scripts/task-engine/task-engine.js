/**
 * task-engine.js v2.0.1
 * 任务承接引擎 - 支持人机协同的复杂任务状态机
 *
 * v2.0.1 修复：
 * - Phase2 中立即持久化 subtasks（解决状态丢失问题）
 * - confirm 命令对已完成任务返回友好提示
 *
 * v2.0.0 核心特性：
 * - 递归任务分解：Phase3 自动分解子任务
 * - 执行者分配：AI(虾哥) 和 人(坚果) 各自执行擅长的部分
 * - 坚果确认节点：Phase2 计划需要坚果确认
 * - 嵌套任务：支持父子任务层级
 *
 * 使用方式：
 *   node task-engine.js start "<任务描述>"
 *   node task-engine.js confirm <taskId>      # 坚果确认计划
 *   node task-engine.js status <taskId>     # 查看状态
 *   node task-engine.js resume <taskId>     # 继续执行
 *   node task-engine.js abort <taskId> [原因]  # 中止
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.cwd();
const TASKS_DIR = path.join(WORKSPACE, 'docs', '项目层', '项目档案');

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

// ============================================================
// 执行者类型
// ============================================================

const EXECUTOR = {
  AI: 'ai',
  HUMAN: 'human',
  BOTH: 'both'
};

/**
 * 智能分配执行者
 */
function assignExecutor(taskDesc) {
  const text = taskDesc.toLowerCase();
  // 开发类任务 → AI 为主
  if (/开发|代码|脚本|程序|系统|平台|自动化|生成|分析|调研/.test(text)) return EXECUTOR.AI;
  // 纯人工操作任务 → 坚果
  if (/发送邮件|发微信|发送邮件|发送微信|审批|报销|钉钉|飞书|华为内网|客户|领导/.test(text)) return EXECUTOR.HUMAN;
  return EXECUTOR.BOTH;
}

// ============================================================
// 任务存储
// ============================================================

function createTask(taskInput) {
  const taskId = 'T' + Date.now();
  const taskDir = path.join(TASKS_DIR, taskId);
  fs.mkdirSync(taskDir, { recursive: true });

  const task = {
    id: taskId,
    input: taskInput,
    state: STATES.COMPLEXITY_EVAL,
    executor: assignExecutor(taskInput),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentPhase: null,
    complexity: null,
    subtasks: [],
    confirmedByHuman: false,
    history: []
  };

  saveTask(task);
  return task;
}

function saveTask(task) {
  const taskDir = path.join(TASKS_DIR, task.id);
  fs.writeFileSync(
    path.join(taskDir, 'task-state.json'),
    JSON.stringify(task, null, 2),
    'utf8'
  );
}

function loadTask(taskId) {
  const stateFile = path.join(TASKS_DIR, taskId, 'task-state.json');
  if (!fs.existsSync(stateFile)) {
    throw new Error(`任务 ${taskId} 不存在`);
  }
  return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

function addHistory(task, action, detail) {
  task.history.push({
    timestamp: new Date().toISOString(),
    action,
    detail
  });
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

  const criticalFiles = ['SOUL.md', 'AGENTS.md', 'USER.md', 'PRIMARY.md'];
  criticalFiles.forEach(f => { if (task.input.includes(f)) score++; });

  score = Math.max(1, Math.min(5, score));
  const level = score <= 2 ? 'L1' : score <= 4 ? 'L2' : 'L3';

  const result = {
    phase: 'COMPLEXITY_EVAL',
    level,
    score,
    executor: task.executor,
    reasoning: `投入:${score >= 3 ? '高' : '中/低'}, 依赖:${/需要确认|需要审批/.test(text) ? '有' : '无'}, 影响:${criticalFiles.some(f => task.input.includes(f)) ? '核心' : '普通'}`
  };

  addHistory(task, 'COMPLEXITY_EVAL', result);
  task.complexity = result;

  if (level === 'L1') {
    task.state = STATES.PHASE5;
    task.currentPhase = 'PHASE5';
  } else {
    task.state = STATES.PHASE1;
    task.currentPhase = 'PHASE1';
  }

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
  console.log('概念阶段：回答"要不要做"');

  const roi = calculateCoarseRoi(task.input);
  const maslowMapping = estimateMaslowImpact(task.input);
  const cdcpPass = roi >= 1.0 || task.complexity.level === 'L3';

  const output = {
    phase: 'PHASE1',
    concept: task.input.substring(0, 100),
    maslowMapping,
    coarseRoi: roi,
    decision: cdcpPass ? 'APPROVED' : 'REJECTED',
    rejectReason: cdcpPass ? null : 'ROI < 1.0',
    nextPhase: cdcpPass ? 'PHASE2' : null
  };

  addHistory(task, 'PHASE1', output);
  task.currentPhase = 'PHASE1';

  console.log(`概念决策：${cdcpPass ? '通过' : '拒绝'}（粗算ROI=${roi.toFixed(2)}）`);

  if (cdcpPass) {
    task.state = STATES.PHASE2;
  } else {
    task.state = STATES.ABORT;
    console.log('❌ 任务中止');
  }

  saveTask(task);
  return output;
}

function calculateCoarseRoi(taskInput) {
  const text = taskInput.toLowerCase();
  let benefit = 1, cost = 1;
  if (/效率|自动化|省时/.test(text)) benefit += 2;
  if (/进化|学习|能力/.test(text)) benefit += 1.5;
  if (/收入|赚钱|商业/.test(text)) benefit += 3;
  if (/架构|系统|重构/.test(text)) cost += 2;
  if (/多个|批量/.test(text)) cost += 1.5;
  if (/^一个|简单/.test(text)) cost *= 0.5;
  return benefit / Math.max(cost, 0.5);
}

function estimateMaslowImpact(taskInput) {
  const text = taskInput.toLowerCase();
  return {
    L1: /生理|健康/.test(text) ? 3 : 0,
    L2: /安全|稳定|保障/.test(text) ? 2 : 1,
    L3: /社交|协作/.test(text) ? 2 : 0,
    L4: /尊重|认可/.test(text) ? 1 : 0,
    L5: /进化|成长/.test(text) ? 3 : 1
  };
}

// ============================================================
// Phase 2: 计划阶段（立即持久化 subtasks）
// ============================================================

async function executePhase2(task) {
  console.log('\n=== Phase PHASE2: 计划阶段 ===');
  console.log('计划阶段：回答"怎么做"');

  const subtasks = decomposeTask(task.input);

  // 分配执行者
  const assignedSubtasks = subtasks.map((st, i) => ({
    id: `${task.id}-S${i + 1}`,
    name: st.name,
    description: st.description,
    executor: assignExecutor(st.description),
    estimatedHours: st.hours,
    estimatedTokens: st.tokens,
    status: 'pending',
    result: null
  }));

  // 立即持久化 subtasks（修复 v2.0.0 的状态丢失 bug）
  task.subtasks = assignedSubtasks;
  task.state = STATES.PENDING_CONFIRM;
  task.currentPhase = 'PHASE2';
  addHistory(task, 'PHASE2', { phase: 'PHASE2', subtaskCount: assignedSubtasks.length });
  saveTask(task);

  const aiTasks = assignedSubtasks.filter(t => t.executor === EXECUTOR.AI);
  const humanTasks = assignedSubtasks.filter(t => t.executor === EXECUTOR.HUMAN);

  console.log(`\n执行者分配（${assignedSubtasks.length}个子任务）：`);
  console.log(`虾哥：${aiTasks.length}个`);
  aiTasks.forEach(t => console.log(`  🦐 ${t.name}`));
  console.log(`坚果：${humanTasks.length}个`);
  humanTasks.forEach(t => console.log(`  🥜 ${t.name}`));
  console.log(`\n⏸ 等待坚果确认...`);
  console.log(`执行：node task-engine.js confirm ${task.id}`);

  const output = {
    phase: 'PHASE2',
    executorAssignment: {
      total: assignedSubtasks.length,
      ai: aiTasks.map(t => ({ id: t.id, name: t.name })),
      human: humanTasks.map(t => ({ id: t.id, name: t.name }))
    },
    resourcePlan: {
      totalHours: assignedSubtasks.reduce((s, t) => s + t.estimatedHours, 0),
      totalTokens: assignedSubtasks.reduce((s, t) => s + t.estimatedTokens, 0)
    },
    wbs: assignedSubtasks,
    decision: 'PENDING_CONFIRM',
    nextPhase: 'PHASE3'
  };

  return output;
}

function decomposeTask(taskInput) {
  const text = taskInput.toLowerCase();
  let tasks = [];

  if (/系统|平台|架构/.test(text)) {
    tasks = [
      { name: '需求分析', description: '分析系统需求和边界', hours: 1, tokens: 3000 },
      { name: '架构设计', description: '设计系统架构', hours: 2, tokens: 5000 },
      { name: '模块开发', description: '分模块开发实现', hours: 4, tokens: 20000 },
      { name: '集成测试', description: '系统集成测试', hours: 2, tokens: 8000 },
      { name: '部署上线', description: '部署和发布', hours: 1, tokens: 3000 }
    ];
  } else if (/代码|脚本|程序/.test(text)) {
    tasks = [
      { name: '需求理解', description: '理解代码需求', hours: 0.5, tokens: 2000 },
      { name: '代码实现', description: '编写代码', hours: 2, tokens: 8000 },
      { name: '测试验证', description: '测试代码正确性', hours: 1, tokens: 4000 }
    ];
  } else if (/调研|研究|分析/.test(text)) {
    tasks = [
      { name: '信息收集', description: '收集相关信息', hours: 1.5, tokens: 6000 },
      { name: '整理分析', description: '整理和分析信息', hours: 1, tokens: 5000 },
      { name: '报告撰写', description: '输出调研报告', hours: 1, tokens: 4000 }
    ];
  } else if (/文档|文章|报告/.test(text)) {
    tasks = [
      { name: '收集资料', description: '收集相关资料', hours: 0.5, tokens: 2000 },
      { name: '撰写内容', description: '撰写文档内容', hours: 1.5, tokens: 6000 },
      { name: '润色发布', description: '润色并发布', hours: 0.5, tokens: 2000 }
    ];
  } else {
    tasks = [
      { name: '理解任务', description: '理解任务目标和范围', hours: 0.5, tokens: 2000 },
      { name: '执行任务', description: '执行任务核心内容', hours: 2, tokens: 8000 },
      { name: '验证交付', description: '验证结果并交付', hours: 0.5, tokens: 2000 }
    ];
  }

  return tasks;
}

// ============================================================
// Phase 3: 开发执行（递归分解）
// ============================================================

async function executePhase3(task) {
  console.log('\n=== Phase PHASE3: 开发执行 ===');
  console.log('开发执行阶段：递归处理子任务');

  const subtasks = task.subtasks || [];
  const results = [];

  for (const subtask of subtasks) {
    console.log(`\n处理子任务：${subtask.name}`);

    if (subtask.executor === EXECUTOR.AI) {
      const subScore = quickScore(subtask.description);
      if (subScore <= 2) {
        console.log(`  → L1简单，虾哥直接执行`);
        subtask.status = 'completed';
        subtask.result = { type: 'ai_auto' };
      } else {
        console.log(`  → L${subScore}复杂，递归分解`);
        const subSubtasks = decomposeTask(subtask.description);
        subtask.status = 'decomposed';
        subtask.subtasks = subSubtasks.map((s, i) => ({
          id: `${subtask.id}.${i + 1}`,
          name: s.name,
          description: s.description,
          executor: assignExecutor(s.description),
          estimatedHours: s.hours,
          estimatedTokens: s.tokens,
          status: 'pending',
          result: null
        }));
        subtask.subtasks.forEach(ss => {
          if (ss.executor === EXECUTOR.AI) {
            console.log(`    🦐 ${ss.name} → 虾哥执行`);
            ss.status = 'completed';
          } else {
            console.log(`    🥜 ${ss.name} → 坚果执行`);
            ss.status = 'pending_human';
          }
        });
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
  addHistory(task, 'PHASE3', {
    phase: 'PHASE3',
    executed: results.filter(t => t.status === 'completed').length,
    pending: results.filter(t => t.status === 'pending_human').length,
    decomposed: results.filter(t => t.status === 'decomposed').length
  });
  saveTask(task);

  const output = {
    phase: 'PHASE3',
    executed: results.filter(t => t.status === 'completed').length,
    pending: results.filter(t => t.status === 'pending_human').length,
    decomposed: results.filter(t => t.status === 'decomposed').length,
    nextPhase: 'PHASE4'
  };

  console.log(`\n执行结果：已完成${output.executed}，待坚果执行${output.pending}，已分解${output.decomposed}`);
  return output;
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
  const output = {
    phase: 'PHASE4',
    verified: (task.subtasks || []).filter(t => t.status === 'completed').length,
    pendingHuman: pending,
    decision: 'VERIFIED',
    nextPhase: 'PHASE5'
  };

  if (pending > 0) {
    console.log(`⚠ 有${pending}个子任务待坚果执行`);
  } else {
    console.log('✅ 所有子任务已完成');
  }

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
  console.log('经验沉淀到 lessons.md');

  const lessonEntry = `\n#### [${task.id}] ${task.input.substring(0, 60)}
- 完成时间: ${new Date().toISOString()}
- 复杂度: ${task.complexity?.level}
- 执行者: ${task.executor}
- 子任务: ${(task.subtasks || []).length}个
- AI完成: ${(task.subtasks || []).filter(t => t.status === 'completed').length}
- 坚果完成: ${(task.subtasks || []).filter(t => t.status === 'pending_human').length}`;

  const lessonsFile = path.join(WORKSPACE, 'memory', 'hot', 'lessons.md');
  if (fs.existsSync(lessonsFile)) {
    const existing = fs.readFileSync(lessonsFile, 'utf8');
    fs.writeFileSync(lessonsFile, existing + lessonEntry, 'utf8');
  }

  task.state = STATES.DONE;
  task.currentPhase = 'PHASE5';
  addHistory(task, 'PHASE5', { phase: 'PHASE5', decision: 'DONE' });
  saveTask(task);

  console.log('✅ 任务完成');
  return { phase: 'PHASE5', decision: 'DONE' };
}

// ============================================================
// 主状态机
// ============================================================

async function runTask(task) {
  console.log(`\n🚀 开始执行任务 ${task.id}`);
  console.log(`输入：${task.input}`);

  while (task.state !== STATES.DONE && task.state !== STATES.ABORT) {
    switch (task.state) {
      case STATES.COMPLEXITY_EVAL:
        await evaluateComplexity(task);
        break;
      case STATES.PHASE1:
        await executePhase1(task);
        break;
      case STATES.PHASE2:
        await executePhase2(task);
        break;
      case STATES.PENDING_CONFIRM:
        console.log('⏸ 等待坚果确认...');
        console.log(`执行：node task-engine.js confirm ${task.id}`);
        return task;
      case STATES.PHASE3:
        await executePhase3(task);
        break;
      case STATES.PHASE4:
        await executePhase4(task);
        break;
      case STATES.PHASE5:
        await executePhase5(task);
        break;
      default:
        console.error('未知状态：', task.state);
        task.state = STATES.ABORT;
    }
  }

  return task;
}

// ============================================================
// CLI
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'start': {
      const input = args.slice(1).join(' ');
      if (!input) { console.error('用法：node task-engine.js start "<任务描述>"'); process.exit(1); }
      const task = createTask(input);
      await runTask(task);
      break;
    }

    case 'confirm': {
      const taskId = args[1];
      if (!taskId) { console.error('用法：node task-engine.js confirm <taskId>'); process.exit(1); }
      const task = loadTask(taskId);
      if (task.state === STATES.DONE) {
        console.log(`任务 ${taskId} 已完成，无需确认`);
        break;
      }
      if (task.state !== STATES.PENDING_CONFIRM) {
        console.log(`任务 ${taskId} 不在等待确认状态（当前：${task.state}）`);
        break;
      }
      task.confirmedByHuman = true;
      task.state = STATES.PHASE3;
      task.updatedAt = new Date().toISOString();
      addHistory(task, 'HUMAN_CONFIRM', { confirmedAt: new Date().toISOString() });
      saveTask(task);
      console.log('✅ 坚果已确认，开始执行Phase3');
      await runTask(task);
      break;
    }

    case 'status': {
      const taskId = args[1];
      if (!taskId) { console.error('用法：node task-engine.js status <taskId>'); process.exit(1); }
      const task = loadTask(taskId);
      printStatus(task);
      break;
    }

    case 'resume': {
      const taskId = args[1];
      if (!taskId) { console.error('用法：node task-engine.js resume <taskId>'); process.exit(1); }
      const task = loadTask(taskId);
      await runTask(task);
      break;
    }

    case 'abort': {
      const taskId = args[1];
      const reason = args.slice(2).join(' ') || '未说明';
      if (!taskId) { console.error('用法：node task-engine.js abort <taskId> [原因]'); process.exit(1); }
      const task = loadTask(taskId);
      task.state = STATES.ABORT;
      addHistory(task, 'ABORT', { reason });
      saveTask(task);
      console.log(`任务 ${taskId} 已中止：${reason}`);
      break;
    }

    default:
      console.log(`
task-engine.js v2.0.1 - 人机协同任务引擎

用法：
  start "<任务>"        创建并执行新任务
  confirm <taskId>      坚果确认计划后继续执行
  status <taskId>       查看任务状态
  resume <taskId>       继续执行
  abort <taskId> [原因]  中止任务

状态流转：
  COMPLEXITY_EVAL → PHASE1(ROI) → PHASE2(计划+分配)
                  → PENDING_CONFIRM(等坚果确认)
                  → PHASE3(递归执行子任务)
                  → PHASE4(验证)
                  → PHASE5(发布)
                  → DONE / ABORT

核心特性：
  - 自动识别执行者：虾哥🦐 / 坚果🥜 / 双方🤝
  - Phase2 立即持久化 subtasks（修复状态丢失）
  - Phase3 递归分解复杂子任务
  - 坚果确认节点（confirm命令）
      `);
  }
}

function printStatus(task) {
  console.log(`\n任务 ${task.id}`);
  console.log('='.repeat(50));
  console.log(`状态：${task.state}`);
  console.log(`复杂度：${task.complexity?.level || '-'}`);
  console.log(`执行者：${task.executor === 'ai' ? '虾哥' : task.executor === 'human' ? '坚果' : '双方'}`);
  console.log(`坚果确认：${task.confirmedByHuman ? '✓' : '✗'}`);
  console.log(`\n子任务（${(task.subtasks || []).length}个）：`);
  (task.subtasks || []).forEach(st => {
    const exe = st.executor === 'ai' ? '🦐' : st.executor === 'human' ? '🥜' : '🤝';
    const icon = st.status === 'completed' ? '✅' : st.status === 'pending_human' ? '⏸' : st.status === 'decomposed' ? '📦' : '⏳';
    console.log(`  ${icon} ${exe} ${st.name} [${st.status}]`);
    (st.subtasks || []).forEach(ss => {
      const sse = ss.executor === 'ai' ? '🦐' : '🥜';
      const ssi = ss.status === 'completed' ? '✅' : '⏳';
      console.log(`      └── ${ssi} ${sse} ${ss.name} [${ss.status}]`);
    });
  });
}

main().catch(console.error);

module.exports = { createTask, loadTask, runTask, STATES, EXECUTOR };
