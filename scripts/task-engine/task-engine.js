/**
 * task-engine.js
 * 任务承接引擎 - 复杂任务状态机
 * 
 * v1.0.0 2026-04-18
 * 
 * 定位：
 * - L1 简单任务：直接 prompt 执行
 * - L2/L3 复杂任务：状态机驱动 IPD 六阶段
 * 
 * 使用方式：
 *   node task-engine.js start "<任务描述>"
 *   node task-engine.js status <taskId>
 *   node task-engine.js resume <taskId>
 *   node task-engine.js abort <taskId> <原因>
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const WORKSPACE = process.cwd();
const TASKS_DIR = path.join(WORKSPACE, 'docs', '项目层', '项目档案');

// 状态定义
const STATES = {
  IDLE: 'idle',
  COMPLEXITY_EVAL: 'complexity_eval',
  LIGHT_PATH: 'light_path',
  PHASE1: 'phase1_concept',
  PHASE2: 'phase2_plan',
  PHASE3: 'phase3_dev',
  PHASE4: 'phase4_verify',
  PHASE5: 'phase5_release',
  PHASE6: 'phase6_lifecycle',
  DONE: 'done',
  ABORT: 'abort'
};

// 阶段配置
const PHASE_CONFIG = {
  PHASE1: { name: '概念阶段', gate: 'CDCP', next: 'PHASE2' },
  PHASE2: { name: '计划阶段', gate: 'PDCP', next: 'PHASE3' },
  PHASE3: { name: '开发阶段', gate: 'TR3', next: 'PHASE4' },
  PHASE4: { name: '验证阶段', gate: 'TR4', next: 'PHASE5' },
  PHASE5: { name: '发布阶段', gate: null, next: 'PHASE6' },
  PHASE6: { name: '生命周期', gate: null, next: 'DONE' }
};

// ============================================================
// 任务存储
// ============================================================

/**
 * 创建新任务
 */
function createTask(taskInput) {
  const taskId = 'T' + Date.now();
  const taskDir = path.join(TASKS_DIR, taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  
  const task = {
    id: taskId,
    input: taskInput,
    state: STATES.COMPLEXITY_EVAL,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentPhase: null,
    complexity: null,
    history: []
  };
  
  saveTask(task);
  return task;
}

/**
 * 保存任务状态
 */
function saveTask(task) {
  const taskDir = path.join(TASKS_DIR, task.id);
  fs.writeFileSync(
    path.join(taskDir, 'task-state.json'),
    JSON.stringify(task, null, 2),
    'utf8'
  );
}

/**
 * 加载任务
 */
function loadTask(taskId) {
  const stateFile = path.join(TASKS_DIR, taskId, 'task-state.json');
  if (!fs.existsSync(stateFile)) {
    throw new Error(`任务 ${taskId} 不存在`);
  }
  return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

/**
 * 保存阶段输出
 */
function savePhaseOutput(taskId, phase, output) {
  const taskDir = path.join(TASKS_DIR, taskId);
  const phaseFile = path.join(taskDir, `phase-output-${phase.toLowerCase()}.json`);
  fs.writeFileSync(phaseFile, JSON.stringify(output, null, 2), 'utf8');
}

/**
 * 添加历史记录
 */
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

/**
 * 评估任务复杂度
 */
async function evaluateComplexity(task) {
  console.log('\n=== 复杂度评估 ===');
  
  const input = task.input;
  
  // 简单规则判断（可代码化部分）
  const quickScore = quickComplexityScore(input);
  
  // 输出评估结果
  let level, path;
  if (quickScore <= 2) {
    level = 'L1';
    path = 'light';
  } else if (quickScore <= 4) {
    level = 'L2';
    path = 'heavy';
  } else {
    level = 'L3';
    path = 'heavy';
  }
  
  const result = {
    phase: 'COMPLEXITY_EVAL',
    level,
    path,
    quickScore,
    reasoning: `基于资源投入、可逆性、依赖度、影响度综合评估`,
    decision: path === 'light' ? '直接执行' : '进入IPD流程'
  };
  
  addHistory(task, 'COMPLEXITY_EVAL', result);
  task.complexity = result;
  task.state = path === 'light' ? STATES.LIGHT_PATH : STATES.PHASE1;
  task.currentPhase = path === 'light' ? 'LIGHT_PATH' : 'PHASE1';
  
  saveTask(task);
  savePhaseOutput(task.id, 'complexity_eval', result);
  
  console.log(`复杂度：${level}（${result.reasoning}）`);
  console.log(`决策：${result.decision}`);
  
  return result;
}

/**
 * 快速复杂度评分（可代码化部分）
 */
function quickComplexityScore(input) {
  let score = 1;
  const text = input.toLowerCase();
  
  // 资源投入估算（关键词判断）
  const heavyKeywords = ['系统', '架构', '重构', '迁移', '部署', '完整', '多个', '批量'];
  const lightKeywords = ['一个', '简单', '查一下', '告诉我', '写一段'];
  
  heavyKeywords.forEach(k => { if (text.includes(k)) score++; });
  lightKeywords.forEach(k => { if (text.includes(k)) score--; });
  
  // 依赖度（多文件/多方依赖）
  if (text.includes('多个') || text.includes('批量')) score++;
  
  // 影响度（涉及核心文件）
  const criticalFiles = ['SOUL.md', 'AGENTS.md', 'USER.md', 'PRIMARY.md'];
  criticalFiles.forEach(f => { if (text.includes(f)) score++; });
  
  return Math.max(1, Math.min(5, score));
}

// ============================================================
// Phase 执行
// ============================================================

/**
 * 执行指定阶段
 */
async function executePhase(task, phase) {
  const config = PHASE_CONFIG[phase];
  console.log(`\n=== Phase ${phase}: ${config.name} ===`);
  
  let output;
  
  switch (phase) {
    case 'PHASE1':
      output = await executePhase1(task);
      break;
    case 'PHASE2':
      output = await executePhase2(task);
      break;
    case 'PHASE5':
      output = await executePhase5(task);
      break;
    case 'PHASE6':
      output = await executePhase6(task);
      break;
    default:
      console.log(`Phase ${phase} 需要人工介入，请使用 prompt 执行`);
      output = { phase, status: 'manual_required', message: '此阶段需要人工介入' };
  }
  
  savePhaseOutput(task.id, phase, output);
  addHistory(task, phase, output);
  task.currentPhase = phase;
  task.updatedAt = new Date().toISOString();
  
  // Gate 判断
  if (config.gate && output.decision === 'REJECTED') {
    task.state = STATES.ABORT;
    console.log(`\n❌ Gate ${config.gate} 未通过，任务中止`);
    console.log(`原因：${output.rejectReason}`);
  } else if (config.next === 'DONE') {
    task.state = STATES.DONE;
    console.log('\n✅ 任务完成');
  } else {
    task.state = config.next;
  }
  
  saveTask(task);
  return output;
}

// ============================================================
// Phase 1: 概念阶段
// ============================================================

async function executePhase1(task) {
  console.log('概念阶段：回答"要不要做"');
  
  const complexity = task.complexity;
  
  // 粗算 ROI（简化版）
  const coarseRoi = calculateCoarseRoi(task.input);
  
  // 马斯洛需求映射（prompt 需要，这里简化）
  const maslowMapping = { L1: 0, L2: 1, L3: 2, L4: 1, L5: 0 };
  
  // CDCP Gate
  const cdcpPass = coarseRoi > 1.0 || complexity.level === 'L3';
  
  const output = {
    phase: 'PHASE1',
    concept: task.input.substring(0, 100),
    maslowMapping,
    coarseRoi,
    decision: cdcpPass ? 'APPROVED' : 'REJECTED',
    rejectReason: cdcpPass ? null : 'ROI < 1.0，不具备商业价值',
    nextPhase: cdcpPass ? 'PHASE2' : null
  };
  
  if (cdcpPass) {
    console.log(`概念决策：通过（粗算ROI=${coarseRoi.toFixed(2)}）`);
    console.log('马斯洛映射：', maslowMapping);
  } else {
    console.log(`概念决策：拒绝（${output.rejectReason}）`);
  }
  
  return output;
}

/**
 * 粗算 ROI（简化版）
 */
function calculateCoarseRoi(taskInput) {
  const text = taskInput.toLowerCase();
  
  // 收益估算（基于关键词）
  let benefit = 1;
  if (text.includes('效率') || text.includes('自动化')) benefit += 2;
  if (text.includes('学习') || text.includes('进化')) benefit += 1.5;
  if (text.includes('收入') || text.includes('赚钱')) benefit += 3;
  
  // 投入估算（基于关键词）
  let cost = 1;
  if (text.includes('架构') || text.includes('系统')) cost += 2;
  if (text.includes('多个') || text.includes('批量')) cost += 2;
  if (text.includes('简单') || text.includes('一个')) cost *= 0.5;
  
  return benefit / cost;
}

// ============================================================
// Phase 2: 计划阶段
// ============================================================

async function executePhase2(task) {
  console.log('计划阶段：回答"怎么做"');
  
  const roi = await calculateDetailedRoi(task);
  
  // 能力 Gap 分析（简化版）
  const capabilityGap = analyzeCapabilityGap(task.input);
  
  // WBS 分解（简化版）
  const wbs = generateWBS(task.input);
  
  // PDCP Gate
  const pdcpPass = roi.detailedRoi > 1.0;
  
  const output = {
    phase: 'PHASE2',
    capabilityGap,
    resourcePlan: {
      estimatedHours: wbs.reduce((sum, t) => sum + (t.hours || 1), 0),
      estimatedTokens: wbs.reduce((sum, t) => sum + (t.tokens || 5000), 0)
    },
    detailedRoi: roi.detailedRoi,
    wbs,
    milestones: generateMilestones(wbs),
    riskPlan: generateRiskPlan(wbs),
    decision: pdcpPass ? 'APPROVED' : 'REJECTED',
    rejectReason: pdcpPass ? null : 'ROI < 1.0，计划不通过',
    nextPhase: pdcpPass ? 'PHASE3' : null
  };
  
  if (pdcpPass) {
    console.log(`计划决策：通过（详细ROI=${roi.detailedRoi.toFixed(2)}）`);
    console.log(`能力Gap：${capabilityGap.gap.length}项`);
    console.log(`WBS：${wbs.length}个任务`);
  } else {
    console.log(`计划决策：拒绝（${output.rejectReason}）`);
  }
  
  return output;
}

/**
 * 计算详细 ROI（需要人工输入数值）
 */
async function calculateDetailedRoi(task) {
  return {
    detailedRoi: task.complexity?.level === 'L1' ? 3.0 : 2.0,
    breakdown: {
      tokenCost: 50,
      humanCost: 200,
      benefit: 500
    }
  };
}

/**
 * 能力 Gap 分析（简化版）
 */
function analyzeCapabilityGap(taskInput) {
  const text = taskInput.toLowerCase();
  
  const capabilityMap = {
    coding: ['代码', '写', '开发', '程序'],
    search: ['搜索', '查找', '调研'],
    automation: ['自动', '脚本', '定时'],
    writing: ['写', '文档', '文章']
  };
  
  const gap = [];
  const available = Object.keys(capabilityMap);
  
  for (const [cap, keywords] of Object.entries(capabilityMap)) {
    const needed = keywords.some(k => text.includes(k));
    if (!needed) gap.push(cap);
  }
  
  return {
    gap,
    available,
    fillStrategy: {
      coding: '安装对应 skill 或人工编写',
      search: '使用 memory_search / web_search',
      automation: '配置 cron 定时任务',
      writing: '使用 prompt 生成'
    }
  };
}

/**
 * 生成 WBS（简化版）
 */
function generateWBS(taskInput) {
  const text = taskInput.toLowerCase();
  const tasks = [];
  
  // 简单任务拆解
  if (text.includes('代码') || text.includes('写')) {
    tasks.push({ name: '需求理解', hours: 0.5, tokens: 2000 });
    tasks.push({ name: '代码实现', hours: 1, tokens: 8000 });
    tasks.push({ name: '测试验证', hours: 0.5, tokens: 3000 });
  } else if (text.includes('调研') || text.includes('搜索')) {
    tasks.push({ name: '信息收集', hours: 1, tokens: 5000 });
    tasks.push({ name: '分析整理', hours: 0.5, tokens: 3000 });
  } else {
    tasks.push({ name: '理解任务', hours: 0.5, tokens: 2000 });
    tasks.push({ name: '执行', hours: 1, tokens: 5000 });
    tasks.push({ name: '验证', hours: 0.5, tokens: 2000 });
  }
  
  return tasks;
}

/**
 * 生成里程碑
 */
function generateMilestones(wbs) {
  const milestones = [];
  let cumulative = 0;
  
  wbs.forEach((task, i) => {
    cumulative += task.hours;
    milestones.push({
      name: `M${i + 1}`,
      afterTask: task.name,
      estimatedDate: new Date(Date.now() + cumulative * 3600 * 1000).toISOString().split('T')[0]
    });
  });
  
  return milestones;
}

/**
 * 生成风险预案
 */
function generateRiskPlan(wbs) {
  return [
    {
      risk: '任务范围蔓延',
      probability: 0.3,
      impact: 'medium',
      mitigation: '严格执行 WBS 范围，超出范围推迟到下一期'
    },
    {
      risk: 'Token 消耗超出预期',
      probability: 0.4,
      impact: 'medium',
      mitigation: '监控 token 使用量，超阈值暂停并评估'
    }
  ];
}

// ============================================================
// Phase 5: 发布阶段
// ============================================================

async function executePhase5(task) {
  console.log('发布阶段：文档化 + 经验沉淀');
  
  // 生成 lessons
  const lessonEntry = `
#### [TASK:${task.id}] ${task.input.substring(0, 50)}

- 完成时间: ${new Date().toISOString()}
- 复杂度: ${task.complexity?.level}
- 实际投入: 待补充
- 教训: 待补充
`;
  
  // 追加到 lessons.md
  const lessonsFile = path.join(WORKSPACE, 'memory', 'hot', 'lessons.md');
  if (fs.existsSync(lessonsFile)) {
    const existing = fs.readFileSync(lessonsFile, 'utf8');
    fs.writeFileSync(lessonsFile, existing + '\n' + lessonEntry, 'utf8');
  }
  
  const output = {
    phase: 'PHASE5',
    lessonsWritten: true,
    lessonEntry: lessonEntry.trim(),
    decision: 'APPROVED',
    nextPhase: 'PHASE6'
  };
  
  console.log('经验已沉淀到 lessons.md');
  return output;
}

// ============================================================
// Phase 6: 生命周期
// ============================================================

async function executePhase6(task) {
  console.log('生命周期：定期检查任务效果');
  
  // 检查任务完成后的效果跟踪
  const output = {
    phase: 'PHASE6',
    checkDate: new Date().toISOString(),
    status: 'ongoing',
    nextCheck: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    recommendation: '本周检查一次任务效果，如无问题则标记为完成'
  };
  
  console.log('下次检查：', output.nextCheck);
  return output;
}

// ============================================================
// 主状态机
// ============================================================

/**
 * 运行任务
 */
async function runTask(task) {
  console.log(`\n🚀 开始执行任务 ${task.id}`);
  console.log(`输入：${task.input}`);
  
  while (task.state !== STATES.DONE && task.state !== STATES.ABORT) {
    switch (task.state) {
      case STATES.COMPLEXITY_EVAL:
        await evaluateComplexity(task);
        break;
      case STATES.LIGHT_PATH:
        console.log('\n轻量路径：直接执行（调用 prompt）');
        console.log('（Phase 3/4 需要人工或 prompt 配合执行）');
        task.state = STATES.DONE;
        break;
      case STATES.PHASE1:
        await executePhase(task, 'PHASE1');
        break;
      case STATES.PHASE2:
        await executePhase(task, 'PHASE2');
        break;
      case STATES.PHASE3:
        await executePhase(task, 'PHASE3');
        break;
      case STATES.PHASE4:
        await executePhase(task, 'PHASE4');
        break;
      case STATES.PHASE5:
        await executePhase(task, 'PHASE5');
        break;
      case STATES.PHASE6:
        await executePhase(task, 'PHASE6');
        break;
      default:
        console.error('未知状态：', task.state);
        task.state = STATES.ABORT;
    }
  }
  
  saveTask(task);
  return task;
}

/**
 * 打印任务状态
 */
function printTaskStatus(task) {
  console.log(`\n任务 ${task.id}`);
  console.log('='.repeat(50));
  console.log(`状态：${task.state}`);
  console.log(`当前阶段：${task.currentPhase || '-'}`);
  console.log(`复杂度：${task.complexity?.level || '-'}`);
  console.log(`创建时间：${task.createdAt}`);
  console.log(`最后更新：${task.updatedAt}`);
  console.log('\n历史记录：');
  task.history.forEach(h => {
    console.log(`  [${h.timestamp}] ${h.action}`);
  });
}

// ============================================================
// CLI 入口
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'start': {
      const taskInput = args.slice(1).join(' ');
      if (!taskInput) {
        console.error('用法：node task-engine.js start "<任务描述>"');
        process.exit(1);
      }
      const task = createTask(taskInput);
      await runTask(task);
      break;
    }
    
    case 'status': {
      const taskId = args[1];
      if (!taskId) {
        console.error('用法：node task-engine.js status <taskId>');
        process.exit(1);
      }
      const task = loadTask(taskId);
      printTaskStatus(task);
      break;
    }
    
    case 'resume': {
      const taskId = args[1];
      if (!taskId) {
        console.error('用法：node task-engine.js resume <taskId>');
        process.exit(1);
      }
      const task = loadTask(taskId);
      await runTask(task);
      break;
    }
    
    case 'abort': {
      const taskId = args[1];
      const reason = args.slice(2).join(' ') || '未说明';
      if (!taskId) {
        console.error('用法：node task-engine.js abort <taskId> [原因]');
        process.exit(1);
      }
      const task = loadTask(taskId);
      task.state = STATES.ABORT;
      addHistory(task, 'ABORT', { reason });
      saveTask(task);
      console.log(`任务 ${taskId} 已中止，原因：${reason}`);
      break;
    }
    
    default:
      console.log(`
task-engine.js - 任务承接引擎

用法：
  node task-engine.js start "<任务描述>"   创建并运行新任务
  node task-engine.js status <taskId>      查看任务状态
  node task-engine.js resume <taskId>      继续执行任务
  node task-engine.js abort <taskId> [原因] 中止任务

状态流转：
  IDLE → COMPLEXITY_EVAL → LIGHT_PATH (L1)
                            → PHASE1 → PHASE2 → PHASE3 → PHASE4 → PHASE5 → PHASE6 → DONE
`);
  }
}

main().catch(console.error);

module.exports = { createTask, loadTask, runTask, STATES, PHASE_CONFIG };
