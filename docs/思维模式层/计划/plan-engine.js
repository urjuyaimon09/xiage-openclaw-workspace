/**
 * plan-engine.js v1.0.0
 * 计划生成引擎 - 对接 PLAN_MODEL
 *
 * 功能：
 * - 目标分解（MBO）
 * - 里程碑设定
 * - 时间线生成
 * - 资源规划
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.cwd();
const PROJECTS_DIR = path.join(__dirname, '项目档案');

// ============================================================
// 计划状态
// ============================================================

const PLAN_STATES = {
  DRAFT: 'draft',       // 草稿
  DECOMPOSED: 'decomposed', // 已分解
  MILESTONED: 'milestoned', // 已定里程碑
  SCHEDULED: 'scheduled',   // 已排期
  EXECUTING: 'executing',   // 执行中
  COMPLETED: 'completed',   // 完成
  ABORTED: 'aborted'        // 终止
};

// ============================================================
// 目标分解
// ============================================================

function decomposeGoal(goal, depth = 3) {
  if (depth <= 0) return { goal, type: 'atomic' };

  const subGoals = [];
  const text = goal.toLowerCase();

  // 智能分解关键词
  const decomposeTriggers = [
    { pattern: /学习|掌握|学会/, type: 'learning', subs: ['理论学习', '实践练习', '总结输出'] },
    { pattern: /开发|构建|实现|制作/, type: 'development', subs: ['需求分析', '设计实现', '测试验证', '部署上线'] },
    { pattern: /研究|调研|分析/, type: 'research', subs: ['收集资料', '整理分析', '形成结论'] },
    { pattern: /优化|改进|提升/, type: 'improvement', subs: ['现状分析', '方案设计', '实施验证'] },
    { pattern: /准备|计划/, type: 'preparation', subs: ['信息收集', '方案规划', '资源协调'] }
  ];

  let found = false;
  for (const trigger of decomposeTriggers) {
    if (trigger.pattern.test(text)) {
      found = true;
      for (const sub of trigger.subs) {
        subGoals.push({
          name: sub,
          type: depth > 1 ? 'compound' : 'atomic',
          children: depth > 1 ? decomposeGoal(sub, depth - 1).subGoals : undefined
        });
      }
      break;
    }
  }

  if (!found) {
    return { goal, type: 'atomic' };
  }

  return { goal, type: 'compound', subGoals };
}

// ============================================================
// 里程碑生成
// ============================================================

function generateMilestones(decomposed) {
  const milestones = [];
  let order = 1;

  function traverse(node, parentPath = '') {
    const currentPath = parentPath ? `${parentPath} > ${node.goal}` : node.goal;
    if (node.type === 'atomic') {
      milestones.push({
        id: `M${order.toString().padStart(3, '0')}`,
        name: node.goal,
        path: currentPath,
        status: 'pending',
        estimatedHours: 1
      });
      order++;
    }
    if (node.subGoals) {
      for (const child of node.subGoals) {
        traverse(child, currentPath);
      }
    }
  }

  traverse(decomposed);
  return milestones;
}

// ============================================================
// 时间线排期（简单版）
// ============================================================

function scheduleMilestones(milestones, startDate = new Date()) {
  const WORKING_HOURS_PER_DAY = 4; // 假设每天4小时投入
  let currentDate = new Date(startDate);

  return milestones.map((m, idx) => {
    const daysNeeded = Math.ceil(m.estimatedHours / WORKING_HOURS_PER_DAY);
    const start = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + daysNeeded);
    const end = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1); // 缓冲1天

    return {
      ...m,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      order: idx + 1
    };
  });
}

// ============================================================
// 状态读写
// ============================================================

function createPlanId() {
  return 'P' + Date.now();
}

function savePlan(plan) {
  const dir = path.join(PROJECTS_DIR, plan.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'plan-state.json');
  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2), 'utf8');
  return filePath;
}

function loadPlan(id) {
  const filePath = path.join(PROJECTS_DIR, id, 'plan-state.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listPlans() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => fs.existsSync(path.join(PROJECTS_DIR, f, 'plan-state.json')))
    .map(f => loadPlan(f));
}

// ============================================================
// 主流程
// ============================================================

function generatePlan(goal, options = {}) {
  const id = createPlanId();
  const depth = options.depth || 3;
  const startDate = options.startDate ? new Date(options.startDate) : new Date();

  const decomposed = decomposeGoal(goal, depth);
  const milestones = generateMilestones(decomposed);
  const scheduled = scheduleMilestones(milestones, startDate);

  const plan = {
    id,
    goal,
    state: PLAN_STATES.SCHEDULED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    decomposed,
    milestones,
    timeline: scheduled,
    totalEstimatedDays: scheduled.length + Math.floor(scheduled.length / 3),
    completionRate: 0
  };

  const filePath = savePlan(plan);
  return { plan, filePath };
}

function updateMilestoneStatus(planId, milestoneId, status) {
  const plan = loadPlan(planId);
  if (!plan) return null;

  const milestone = plan.milestones.find(m => m.id === milestoneId);
  if (milestone) {
    milestone.status = status;
    plan.updatedAt = new Date().toISOString();

    // 更新完成率
    const completed = plan.milestones.filter(m => m.status === 'completed').length;
    plan.completionRate = Math.round(completed / plan.milestones.length * 100);

    if (completed === plan.milestones.length) {
      plan.state = PLAN_STATES.COMPLETED;
    }

    savePlan(plan);
  }
  return plan;
}

// ============================================================
// CLI 入口
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

if (command === 'generate') {
  const goal = args.slice(1).join(' ');
  if (!goal) {
    console.error('用法: node plan-engine.js generate <目标>');
    process.exit(1);
  }
  const result = generatePlan(goal, { depth: 3 });
  console.log(JSON.stringify(result, null, 2));
} else if (command === 'list') {
  console.log(JSON.stringify(listPlans(), null, 2));
} else if (command === 'show' && args[1]) {
  console.log(JSON.stringify(loadPlan(args[1]), null, 2));
} else if (command === 'complete' && args[1] && args[2]) {
  console.log(JSON.stringify(updateMilestoneStatus(args[1], args[2], 'completed'), null, 2));
} else if (command === 'decompose') {
  const goal = args.slice(1).join(' ');
  console.log(JSON.stringify(decomposeGoal(goal, 3), null, 2));
} else {
  console.log(`plan-engine.js v1.0.0
用法:
  node plan-engine.js generate <目标>     生成计划
  node plan-engine.js list               列出所有计划
  node plan-engine.js show <id>           查看计划详情
  node plan-engine.js complete <planId> <milestoneId>  标记里程碑完成
  node plan-engine.js decompose <目标>    仅分解目标测试`);
}

module.exports = { generatePlan, decomposeGoal, generateMilestones, scheduleMilestones, updateMilestoneStatus, PLAN_STATES };
