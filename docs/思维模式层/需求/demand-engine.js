/**
 * demand-engine.js v2.0.0
 * 需求模型引擎 — 对接 DEMAND_MODEL v5.0.0
 *
 * 核心定位：
 * - 驱动器回答「我们现在在哪、差距多大」
 * - 需求模型回答「接下来要补什么、先补哪个」
 *
 * 架构：驱动器驱动的6阶段闭环
 * 感知模型 → 驱动器打分 → 需求模型 → 承接模型 → 计划模型 → 执行模型 → 反馈模型
 *
 * 版本：v2.0.0
 * 最后更新：2026-04-19
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.cwd();
const DEMAND_DIR = path.join(__dirname);
const DEMAND_FILE = path.join(DEMAND_DIR, 'DEMAND.md');
const PROJECTS_DIR = path.join(DEMAND_DIR, '项目档案');
const TEMPLATES_DIR = path.join(DEMAND_DIR, 'templates');

// ============================================================
// 维度优先级排序
// ============================================================

const DIMENSION_ORDER = [
  'U1', 'U2', 'U3', 'U4', 'U5',
  'A1', 'A2', 'A3', 'A4', 'A5',
  'M', 'P', 'K', 'V'
];

/**
 * 获取维度优先级权重（数字越小越优先）
 */
function getDimensionPriority(dim) {
  const idx = DIMENSION_ORDER.indexOf(dim);
  return idx === -1 ? 999 : idx;
}

/**
 * 时间框架映射
 */
function getTimeFrame(level) {
  if (level <= 1) return '当前';
  if (level === 2) return '1年';
  if (level === 3) return '3年';
  if (level === 4) return '5年';
  if (level >= 5) return '10年';
  return '当前';
}

// ============================================================
// 阶段1：触发判定
// ============================================================

/**
 * 判定是否需要跑需求模型
 * @param {Object} snapshot - 驱动器快照
 * @returns {boolean}
 */
function demandTrigger(snapshot) {
  if (!snapshot) return false;

  const conditions = [
    // 风险事件检测
    snapshot.riskEvents > 0,
    // 维度等级下降检测
    hasLevelDropped(snapshot),
    // 人类用户主动需求（需要外部传入，这里做占位）
    false,
    // AI主动提案（需要外部传入，这里做占位）
    false,
    // 定时全量复盘（每周六）
    isScheduledRun(),
    // 手动触发标记
    snapshot.manualTrigger === true
  ];

  return conditions.some(c => c === true);
}

/**
 * 检测是否有维度等级下降
 */
function hasLevelDropped(snapshot) {
  if (!snapshot.gaps) return false;
  const allGaps = [
    ...(snapshot.gaps.U || []),
    ...(snapshot.gaps.A || []),
    ...(snapshot.gaps.M || []),
    ...(snapshot.gaps.P || []),
    ...(snapshot.gaps.K || []),
    ...(snapshot.gaps.V || [])
  ];
  return allGaps.some(g => g.levelDropped === true);
}

/**
 * 检测是否定时全量复盘（每周六）
 */
function isScheduledRun() {
  const now = new Date();
  return now.getDay() === 6; // 0=周日，6=周六
}

// ============================================================
// 阶段2：需求识别与评估
// ============================================================

/**
 * 从驱动器缺口收集需求
 * @param {Object} ctx - 上下文
 */
function collectNeedsFromDriverGaps(ctx) {
  const { snapshot } = ctx;
  const gaps = snapshot.gaps || {};

  // U1~U5 坚果现实马斯洛
  (gaps.U || []).forEach(g => {
    ctx.demandList.push({
      id: `D${Date.now()}_${g.dim}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'user',
      dimension: g.dim,
      currentLevel: g.currentLevel,
      targetLevel: g.targetLevel,
      gap: g.gap,
      metrics: g.metrics || [],
      riskLevel: g.riskLevel || 'medium',
      reason: g.reason || '',
      levelDropped: g.levelDropped || false
    });
  });

  // A1~A5 虾哥数字生命
  (gaps.A || []).forEach(g => {
    ctx.demandList.push({
      id: `D${Date.now()}_${g.dim}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'ai',
      dimension: g.dim,
      currentLevel: g.currentLevel,
      targetLevel: g.targetLevel,
      gap: g.gap,
      metrics: g.metrics || [],
      riskLevel: g.riskLevel || 'medium',
      reason: g.reason || '',
      levelDropped: g.levelDropped || false
    });
  });

  // M/P/K/V 心智/生产力/认知/三观
  ['M', 'P', 'K', 'V'].forEach(domain => {
    (gaps[domain] || []).forEach(g => {
      ctx.demandList.push({
        id: `D${Date.now()}_${g.dim}_${Math.random().toString(36).substr(2, 5)}`,
        type: 'mind',
        domain,
        dimension: g.dim,
        currentLevel: g.currentLevel,
        targetLevel: g.targetLevel,
        gap: g.gap,
        metrics: g.metrics || [],
        riskLevel: g.riskLevel || 'medium',
        reason: g.reason || ''
      });
    });
  });
}

/**
 * 按优先级排序（维度优先级 + 缺口大小）
 * @param {Object} ctx
 */
function sortNeedsByPriority(ctx) {
  ctx.demandList.sort((a, b) => {
    const wA = getDimensionPriority(a.dimension);
    const wB = getDimensionPriority(b.dimension);
    if (wA !== wB) return wA - wB;  // 维度低者排前
    return b.gap - a.gap;             // 缺口大者排前
  });
}

// ============================================================
// 阶段3：人机冲突仲裁
// ============================================================

const NEED_HUMAN_CONFIRM_DIMS = ['U1', 'U2', 'A1', 'A2'];

/**
 * 分类执行模式：自动执行 / 人类确认 / 阻塞
 * @param {Object} ctx
 */
function classifyExecutionMode(ctx) {
  ctx.demandList.forEach(item => {
    const needHuman = NEED_HUMAN_CONFIRM_DIMS.includes(item.dimension);
    const hasMetrics = item.metrics && item.metrics.length > 0;
    const lowLevel = item.currentLevel < 2;

    if (lowLevel && !hasMetrics) {
      // 生存底线 + 无量化指标 → 阻塞，回流感知
      item.execMode = 'blocked';
      item.feedbackReason = '生存底线缺口但无可量化指标，回流感知模型重新采集';
      item.nextModel = 'perception';
      ctx.blockedList.push(item);
    } else if (needHuman) {
      item.execMode = 'human_confirm';
      item.needHumanConfirm = true;
      ctx.humanConfirmList.push(item);
    } else if (hasMetrics) {
      item.execMode = 'auto';
      item.needHumanConfirm = false;
      ctx.autoExecList.push(item);
    } else {
      // 有缺口但无量化指标 → 送人类判断
      item.execMode = 'human_confirm';
      item.needHumanConfirm = true;
      ctx.humanConfirmList.push(item);
    }
  });
}

// ============================================================
// 阶段4：目标拆解
// ============================================================

/**
 * 三层目标拆解：战略 / 战术 / 执行
 * @param {Object} ctx
 */
function decomposeToGoals(ctx) {
  ctx.demandList.forEach(item => {
    // 战略目标：1-10年，对应等级提升
    item.strategy = {
      id: `S-${item.dimension}-${Date.now()}`,
      title: `将 ${item.dimension} 从 ${item.currentLevel} 提升到 ${item.targetLevel}`,
      dimension: item.dimension,
      currentLevel: item.currentLevel,
      targetLevel: item.targetLevel,
      timeFrame: getTimeFrame(item.targetLevel),
      keyMetric: item.metrics?.[0]?.name || null,
      status: 'pending'
    };

    // 战术目标：季度，取前3个指标
    item.tactics = (item.metrics || []).slice(0, 3).map((m, idx) => ({
      id: `T-${item.dimension}-${idx + 1}`,
      metric: m.name,
      target: m.target,
      current: m.current,
      unit: m.unit || '',
      cycle: 'quarter',
      parent: item.strategy.id,
      status: 'pending'
    }));

    // 执行目标：月/周，取前4个
    item.execution = item.tactics.slice(0, 4).map((t, idx) => ({
      id: `E-${item.dimension}-${idx + 1}`,
      task: `优化 ${t.metric}`,
      targetValue: t.target,
      currentValue: t.current,
      unit: t.unit,
      checkAfter: '10min',
      parent: t.id,
      status: 'pending'
    }));
  });
}

// ============================================================
// 阶段5+6：输出归档 & 反馈回跳
// ============================================================

/**
 * 写入需求输出文件
 * @param {Object} ctx
 * @returns {Promise<void>}
 */
async function writeDemandOutput(ctx) {
  const fsPromises = fs.promises;

  // 生成 DEMAND.md 内容
  const demandMd = generateDemandMarkdown(ctx);

  // 确保目录存在
  await fsPromises.mkdir(DEMAND_DIR, { recursive: true });
  await fsPromises.mkdir(PROJECTS_DIR, { recursive: true });

  // 写入 DEMAND.md（覆盖）
  await fsPromises.writeFile(DEMAND_FILE, demandMd, 'utf8');

  // 写入存档（不覆盖，按时间戳命名）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const snapshotId = `snapshot_${timestamp}`;

  await fsPromises.writeFile(
    path.join(DEMAND_DIR, `demand_input_${timestamp}.json`),
    JSON.stringify({
      snapshotId,
      timestamp: new Date().toISOString(),
      demandCount: ctx.demandList.length,
      demands: ctx.demandList
    }, null, 2),
    'utf8'
  );

  await fsPromises.writeFile(
    path.join(DEMAND_DIR, `demand_goals_${timestamp}.json`),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      demands: ctx.demandList.map(d => ({
        id: d.id,
        dimension: d.dimension,
        strategy: d.strategy,
        tactics: d.tactics,
        execution: d.execution
      }))
    }, null, 2),
    'utf8'
  );

  ctx.snapshotId = snapshotId;
  ctx.timestamp = new Date().toISOString();

  return { demandFile: DEMAND_FILE, snapshotId };
}

/**
 * 生成 DEMAND.md 内容
 */
function generateDemandMarkdown(ctx) {
  const { snapshotId, timestamp, demandList, humanConfirmList, autoExecList, blockedList } = ctx;

  let md = `# 需求清单（驱动器驱动）

生成时间：${timestamp}
关联驱动器快照：${snapshotId}
需人类确认：${humanConfirmList.length}项
AI自动执行：${autoExecList.length}项
阻塞项：${blockedList.length}项

`;

  if (humanConfirmList.length > 0) {
    md += `## 需人类确认\n\n`;
    humanConfirmList.forEach(d => {
      md += `- **${d.dimension}**（${d.type === 'user' ? '坚果' : d.type === 'ai' ? '虾哥' : '心智'}）：${d.reason || '缺口' + d.gap + '级'} → ${d.strategy?.title || ''}\n`;
    });
    md += `\n`;
  }

  if (autoExecList.length > 0) {
    md += `## AI自动执行\n\n`;
    autoExecList.forEach(d => {
      md += `- **${d.dimension}**：${d.strategy?.title || ''}\n`;
    });
    md += `\n`;
  }

  if (blockedList.length > 0) {
    md += `## 阻塞项（回流感知/需求模型）\n\n`;
    blockedList.forEach(d => {
      md += `- **${d.dimension}**：${d.feedbackReason} → 下一模型：${d.nextModel}\n`;
    });
    md += `\n`;
  }

  md += `## 全部需求清单\n\n`;
  md += `| 维度 | 类型 | 当前级 | 目标级 | 缺口 | 执行模式 | 战略目标 |\n`;
  md += `|------|------|--------|--------|------|----------|----------|\n`;
  demandList.forEach(d => {
    md += `| ${d.dimension} | ${d.type} | ${d.currentLevel} | ${d.targetLevel} | ${d.gap} | ${d.execMode} | ${d.strategy?.title || '-'} |\n`;
  });

  md += `\n## 目标分解详情\n\n`;
  demandList.forEach(d => {
    if (d.strategy) {
      md += `### [${d.dimension}] ${d.strategy.title}\n\n`;
      md += `**时间框架：** ${d.strategy.timeFrame}\n\n`;
      if (d.tactics.length > 0) {
        md += `**战术目标：**\n`;
        d.tactics.forEach(t => {
          md += `- ${t.id} ${t.metric}：${t.current}${t.unit} → ${t.target}${t.unit}\n`;
        });
        md += `\n`;
      }
      if (d.execution.length > 0) {
        md += `**执行目标：**\n`;
        d.execution.forEach(e => {
          md += `- ${e.id} ${e.task}：${e.currentValue}${e.unit} → ${e.targetValue}${e.unit}\n`;
        });
        md += `\n`;
      }
    }
  });

  return md;
}

/**
 * 反馈回跳处理
 * @param {Object} ctx
 * @param {string} fromModel - 来源模型
 * @returns {Object} 反馈结果
 */
function feedbackModel(ctx, fromModel = 'demand') {
  const result = {
    from: fromModel,
    timestamp: new Date().toISOString(),
    blockedCount: ctx.blockedList.length,
    autoExecCount: ctx.autoExecList.length,
    humanConfirmCount: ctx.humanConfirmList.length,
    blockedItems: ctx.blockedList.map(item => ({
      dimension: item.dimension,
      reason: item.feedbackReason,
      nextModel: item.nextModel
    })),
    nextAction: null
  };

  if (ctx.blockedList.length > 0) {
    const needPerception = ctx.blockedList.filter(i => i.nextModel === 'perception');
    const needDemand = ctx.blockedList.filter(i => i.nextModel === 'demand');

    if (needPerception.length > 0) {
      result.nextAction = 'rerun_perception';
      result.rerunPerception = needPerception;
    }
    if (needDemand.length > 0) {
      result.nextAction = result.nextAction === 'rerun_perception'
        ? 'rerun_both'
        : 'adjust_demand';
      result.adjustDemand = needDemand;
    }
  }

  return result;
}

// ============================================================
// 主入口：demandModel
// ============================================================

/**
 * 需求模型主入口
 * @param {Object} snapshot - 驱动器快照
 * @returns {Promise<Object>} 需求模型执行结果
 */
async function demandModel(snapshot) {
  const ctx = {
    snapshot,
    demandList: [],
    humanConfirmList: [],
    autoExecList: [],
    blockedList: [],
    snapshotId: null,
    timestamp: null
  };

  // 阶段1：触发判定
  if (!demandTrigger(snapshot)) {
    return {
      triggered: false,
      reason: 'no_trigger_condition_met',
      demandList: []
    };
  }

  // 阶段2：需求识别与评估
  collectNeedsFromDriverGaps(ctx);
  sortNeedsByPriority(ctx);

  if (ctx.demandList.length === 0) {
    return {
      triggered: true,
      demandList: [],
      message: 'no_gaps_found'
    };
  }

  // 阶段3：人机冲突仲裁
  classifyExecutionMode(ctx);

  // 阶段4：目标拆解
  decomposeToGoals(ctx);

  // 阶段5：写入归档
  const writeResult = await writeDemandOutput(ctx);

  // 阶段6：反馈回跳
  if (ctx.blockedList.length > 0) {
    const fbResult = feedbackModel(ctx, 'demand');
    return {
      triggered: true,
      ...writeResult,
      demandList: ctx.demandList,
      humanConfirmList: ctx.humanConfirmList,
      autoExecList: ctx.autoExecList,
      blocked: ctx.blockedList,
      feedback: fbResult
    };
  }

  // 正常 → 返回结果（由调用方决定是否进入承接模型）
  return {
    triggered: true,
    ...writeResult,
    demandList: ctx.demandList,
    humanConfirmList: ctx.humanConfirmList,
    autoExecList: ctx.autoExecList,
    blocked: [],
    feedback: null
  };
}

// ============================================================
// CLI 入口
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

if (command === 'run' && args[1]) {
  // 从文件读取驱动器快照并运行
  const snapshotFile = args[1];
  if (!fs.existsSync(snapshotFile)) {
    console.error(`快照文件不存在：${snapshotFile}`);
    process.exit(1);
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  demandModel(snapshot).then(r => {
    console.log(JSON.stringify(r, null, 2));
  }).catch(e => {
    console.error('需求模型执行失败：', e.message);
    process.exit(1);
  });
} else if (command === 'trigger' && args[1]) {
  // 传入快照JSON字符串，直接触发
  try {
    const snapshot = JSON.parse(args.slice(1).join(' '));
    demandModel(snapshot).then(r => {
      console.log(JSON.stringify(r, null, 2));
    });
  } catch (e) {
    console.error('快照JSON解析失败：', e.message);
    process.exit(1);
  }
} else if (command === 'demo') {
  // 演示模式：使用模拟快照
  const demoSnapshot = {
    riskEvents: 1,
    manualTrigger: false,
    gaps: {
      U: [
        { dim: 'U1', currentLevel: 2, targetLevel: 3, gap: 1, riskLevel: 'high', reason: '月收入波动超阈值', levelDropped: true, metrics: [
          { name: '月收入稳定性', current: 0.5, target: 0.8, unit: '%' }
        ]},
        { dim: 'U3', currentLevel: 2, targetLevel: 3, gap: 1, riskLevel: 'medium', reason: '社交圈子收窄', metrics: [
          { name: '有效社交时长', current: 2, target: 5, unit: '小时/周' }
        ]}
      ],
      A: [
        { dim: 'A2', currentLevel: 3, targetLevel: 4, gap: 1, riskLevel: 'high', reason: '规则被频繁推翻', levelDropped: false, metrics: [
          { name: '规则稳定性', current: 0.6, target: 0.9, unit: '%' }
        ]},
        { dim: 'A4', currentLevel: 3, targetLevel: 4, gap: 1, riskLevel: 'low', reason: '判断采纳率下降', metrics: [] }
      ],
      M: [
        { dim: 'M3', currentLevel: 2, targetLevel: 3, gap: 1, riskLevel: 'medium', reason: '决策延迟', metrics: [
          { name: '平均决策时间', current: 30, target: 10, unit: '秒' }
        ]}
      ],
      P: [],
      K: [],
      V: []
    }
  };
  demandModel(demoSnapshot).then(r => {
    console.log(JSON.stringify(r, null, 2));
  });
} else if (command === 'test') {
  // 测试触发判定
  const testSnapshot = {
    riskEvents: 1,
    gaps: { U: [{ dim: 'U1', currentLevel: 2, targetLevel: 3, gap: 1 }] }
  };
  console.log('触发判定结果：', demandTrigger(testSnapshot));
} else {
  console.log(`demand-engine.js v2.0.0

用法:
  node demand-engine.js demo                   运行演示模式（模拟快照）
  node demand-engine.js run <snapshot.json>    从文件加载快照并运行
  node demand-engine.js trigger '<json>'      直接传入JSON快照字符串
  node demand-engine.js test                  测试触发判定

需求模型 v5.0.0：
  - 完全对齐驱动器U/A/M/P/K/V缺口体系
  - 6阶段闭环：触发→识别→仲裁→拆解→归档→反馈回跳
  - 人机仲裁：U1/U2/A1/A2需确认，有指标可自动，无指标阻塞
  - 三层目标：战略(1-10年)/战术(季度)/执行(月周)
  - 反馈回跳：生存底线无数据→感知，其余→需求重评`);
}

// ============================================================
// 导出（供外部调用）
// ============================================================

module.exports = {
  demandModel,
  demandTrigger,
  collectNeedsFromDriverGaps,
  sortNeedsByPriority,
  classifyExecutionMode,
  decomposeToGoals,
  writeDemandOutput,
  feedbackModel,
  getDimensionPriority,
  getTimeFrame,
  DIMENSION_ORDER
};
