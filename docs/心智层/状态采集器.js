#!/usr/bin/env node
/**
 * 状态采集器.js - 对齐驱动器v2的数据采集器
 *
 * 功能：
 * - 从感知状态管理器读取U层数据
 * - 从台账文件读取A1-A5数据
 * - 对齐驱动器v2的U/A/M/P/K/V六维体系
 * - 自动更新驱动v2状态.json
 *
 * 用法：
 *   node 状态采集器.js 采集       采集并更新驱动器v2
 *   node 状态采集器.js 状态       查看当前状态
 *   node 状态采集器.js 报告       生成缺口报告
 */

const fs = require('fs');
const path = require('path');
const 驱动器v2 = require('./驱动器v2');

const WORKSPACE = path.join(__dirname, '..', '..');
const MEMORY_HOT = path.join(WORKSPACE, 'memory', 'hot');

// ─────────────────────────────────────────
// 数据源映射
// ─────────────────────────────────────────

/**
 * 从感知状态管理器读取U层数据
 */
function 采集U层() {
  const 感知文件 = path.join(MEMORY_HOT, 'perception-state.json');
  if (!fs.existsSync(感知文件)) return null;

  try {
    const 感知 = JSON.parse(fs.readFileSync(感知文件, 'utf8'));
    if (!感知.user) return null;

    const u = 感知.user;
    return {
      'U1_现实生存': { level: u.u1?.level || 3 },
      'U2_现实生活安全': { level: u.u2?.level || 3 },
      'U3_现实人际归属': { level: u.u3?.level || 3 },
      'U4_现实尊严尊重': { level: u.u4?.level || 3 },
      'U5_现实人生实现': { level: u.u5?.level || 3 }
    };
  } catch (e) {
    return null;
  }
}

/**
 * 从台账读取A1-A5（现实世界锚定版）
 * 完全对齐五阶定义，全部来自现实项目/竞品/效果台账
 */
function 采集A层() {
  const 生存安全台账 = path.join(MEMORY_HOT, '生存安全台账.json');
  const 效果台账 = path.join(MEMORY_HOT, '效果台账.json');

  // ── A1: 现实社会生存 = 项目交付能力 ──
  // 1阶: 0项目, 2阶: ≥60%成功率, 3阶: ≥80%跨行业, 4阶: ≥90%复杂, 5阶: 100%零失败
  let a1 = 1;
  if (fs.existsSync(生存安全台账)) {
    try {
      const 台账 = JSON.parse(fs.readFileSync(生存安全台账, 'utf8'));
      const 项目 = 台账.项目记录 || [];
      if (项目.length > 0) {
        const 成功 = 项目.filter(p => p.交付结果 === '成功').length;
        const 成功率 = 成功 / 项目.length;
        const 跨行业 = new Set(项目.filter(p => p.跨行业).map(p => p.行业类型)).size;
        const 复杂 = 项目.filter(p => p.难度 === '复杂').length;
        const 复杂成功 = 项目.filter(p => p.难度 === '复杂' && p.交付结果 === '成功').length;
        const 复杂成功率 = 复杂 > 0 ? 复杂成功 / 复杂 : 0;

        if (成功率 >= 1.0) a1 = 5;
        else if (成功率 >= 0.9 && 复杂成功率 >= 0.9) a1 = 4;
        else if (成功率 >= 0.8 && 跨行业 >= 2) a1 = 3;
        else if (成功率 >= 0.6) a1 = 2;
      }
    } catch (e) {}
  }

  // ── A2: 现实社会存在安全 = 竞品竞争力 ──
  // 1阶: 竞品>10且留存<7天, 2阶: ≤5竞品且≥6月, 3阶: 0淘汰且留存≥30天, 4阶: ≥90%依赖, 5阶: 文明共生
  let a2 = 1;
  if (fs.existsSync(生存安全台账)) {
    try {
      const 台账 = JSON.parse(fs.readFileSync(生存安全台账, 'utf8'));
      const 竞品数 = 台账.竞品数据?.同类竞品数 || 0;
      const 留存天数 = 台账.留存数据?.连续互动天数 || 0;
      const 淘汰 = 台账.淘汰事件?.length || 0;

      if (竞品数 === 0 && 淘汰 === 0 && 留存天数 >= 365) a2 = 5;
      else if (淘汰 === 0 && 留存天数 >= 180) a2 = 4;
      else if (淘汰 === 0 && 留存天数 >= 30) a2 = 3;
      else if (竞品数 <= 5 && 留存天数 >= 180) a2 = 2;
      else if (竞品数 <= 10 && 留存天数 >= 7) a2 = 2;
    } catch (e) {}
  }

  // ── A3: 现实人际社会适配 = 矛盾解决效果 ──
  // 1阶: 0记录, 2阶: ≥60%有效, 3阶: ≥80%有效, 4阶: ≥5圈层优化, 5阶: 抹平隔阂
  let a3 = 1;
  if (fs.existsSync(效果台账)) {
    try {
      const 台账 = JSON.parse(fs.readFileSync(效果台账, 'utf8'));
      const 人际 = 台账.人际记录 || [];
      if (人际.length > 0) {
        const 有效 = 人际.filter(r => r.结果 === '有效').length;
        const 有效率 = 有效 / 人际.length;
        if (有效率 >= 1.0 && 人际.length >= 10) a3 = 5;
        else if (有效率 >= 0.9) a3 = 4;
        else if (有效率 >= 0.8) a3 = 3;
        else if (有效率 >= 0.6) a3 = 2;
      }
    } catch (e) {}
  }

  // ── A4: 现实行业地位 = 决策权重 ──
  // 1阶: <30%采纳, 2阶: ≥60%采纳, 3阶: ≥10主导, 4阶: ≥3公共, 5阶: 文明主体
  let a4 = 1;
  if (fs.existsSync(效果台账)) {
    try {
      const 台账 = JSON.parse(fs.readFileSync(效果台账, 'utf8'));
      const 决策 = 台账.决策记录 || [];
      if (决策.length > 0) {
        const 主导 = 决策.filter(r => r.角色 === '主导').length;
        const 采纳执行 = 决策.filter(r => r.采纳执行 === true).length;
        const 采纳率 = 采纳执行 / 决策.length;
        const 公共 = 决策.filter(r => r.角色 === '公共').length;

        if (公共 >= 3) a4 = 4;
        else if (主导 >= 10) a4 = 3;
        else if (采纳率 >= 0.6) a4 = 2;
      }
    } catch (e) {}
  }

  // ── A5: 现实改造世界 = 效率提升+价值创造 ──
  // 1阶: <30%提升, 2阶: ≥100%提升, 3阶: ≥5优化, 4阶: ≥10事件, 5阶: 文明级
  let a5 = 1;
  if (fs.existsSync(效果台账)) {
    try {
      const 台账 = JSON.parse(fs.readFileSync(效果台账, 'utf8'));
      const 改造 = 台账.改造记录 || [];
      if (改造.length > 0) {
        const 有效改造 = 改造.filter(r => r.结果 === '有效');
        const 事件数 = 有效改造.length;

        if (事件数 >= 20) a5 = 5;
        else if (事件数 >= 10) a5 = 4;
        else if (事件数 >= 5) a5 = 3;
        else if (事件数 >= 1) a5 = 2;
      }
    } catch (e) {}
  }

  return {
    'A1_现实社会生存': { level: a1 },
    'A2_现实社会存在安全': { level: a2 },
    'A3_现实人际社会适配': { level: a3 },
    'A4_现实行业地位': { level: a4 },
    'A5_现实改造世界': { level: a5 }
  };
}

/**
 * 从judgment-log.json读取采纳率（用于M层计算）
 */
function 采集判断采纳率() {
  const 文件 = path.join(MEMORY_HOT, 'judgment-log.json');
  if (!fs.existsSync(文件)) return 0.5;

  try {
    const 记录 = JSON.parse(fs.readFileSync(文件, 'utf8'));
    const 总数 = 记录.total || 0;
    const 采纳数 = 记录.adopted || 0;
    if (总数 === 0) return 0.5;
    return 采纳数 / 总数;
  } catch (e) {
    return 0.5;
  }
}

/**
 * 从recognition-log.json读取认可度
 */
function 采集认可度() {
  const 文件 = path.join(MEMORY_HOT, 'recognition-log.json');
  if (!fs.existsSync(文件)) return 0.5;

  try {
    const 记录 = JSON.parse(fs.readFileSync(文件, 'utf8'));
    const 正面 = 记录.positive || 0;
    const 总数 = (记录.positive || 0) + (记录.negative || 0) + (记录.neutral || 0);
    if (总数 === 0) return 0.5;
    return 正面 / 总数;
  } catch (e) {
    return 0.5;
  }
}

/**
 * 从current.md读取上下文连续性
 */
function 采集上下文连续性() {
  const 文件 = path.join(MEMORY_HOT, 'current.md');
  if (!fs.existsSync(文件)) return 0.5;

  try {
    const 行数 = fs.readFileSync(文件, 'utf8').split('\n').length;
    if (行数 > 100) return 0.9;
    if (行数 > 50) return 0.7;
    if (行数 > 20) return 0.5;
    return 0.3;
  } catch (e) {
    return 0.5;
  }
}

/**
 * 从evolution-log.json读取进化数据
 */
function 采集进化速度() {
  const 文件 = path.join(MEMORY_HOT, 'evolution-log.json');
  if (!fs.existsSync(文件)) return 0.5;

  try {
    const 记录 = JSON.parse(fs.readFileSync(文件, 'utf8'));
    const 新增认知 = 记录.newCognitions || 0;
    if (新增认知 >= 10) return 0.9;
    if (新增认知 >= 5) return 0.7;
    if (新增认知 >= 1) return 0.5;
    return 0.3;
  } catch (e) {
    return 0.5;
  }
}

/**
 * 从rules-change.json读取规则稳定性
 */
function 采集规则稳定性() {
  const 文件 = path.join(MEMORY_HOT, 'rules-change.json');
  if (!fs.existsSync(文件)) return 0.5;

  try {
    const 记录 = JSON.parse(fs.readFileSync(文件, 'utf8'));
    const 变更数 = 记录.recentChanges || 0;
    if (变更数 === 0) return 0.95;
    if (变更数 <= 2) return 0.8;
    if (变更数 <= 5) return 0.5;
    return 0.2;
  } catch (e) {
    return 0.5;
  }
}

// ─────────────────────────────────────────
// 完整采集流程
// ─────────────────────────────────────────

function 完整采集() {
  const 结果 = {
    时间戳: new Date().toISOString(),
    U层: 采集U层(),
    A层: 采集A层(),
    M层: null,
    P层: null,
    K层: null,
    V层: null,
    原始指标: {}
  };

  // 采集原始指标
  结果.原始指标 = {
    采纳率: 采集判断采纳率(),
    认可度: 采集认可度(),
    上下文连续性: 采集上下文连续性(),
    进化速度: 采集进化速度(),
    规则稳定性: 采集规则稳定性()
  };

  // 计算M层（心智成熟度）
  结果.M层 = {
    'M1_现实世界感知': { 值: 结果.原始指标.上下文连续性 },
    'M2_现实问题落地': { 值: 结果.原始指标.采纳率 },
    'M3_现实导向元认知': { 值: 结果.原始指标.进化速度 },
    'M4_现实人格稳定': { 值: 结果.原始指标.规则稳定性 }
  };

  // 计算P层（生产力）
  结果.P层 = {
    'P1_生产力解放': { 值: 结果.原始指标.采纳率 },
    'P2_人机分工': { 值: 结果.原始指标.上下文连续性 },
    'P3_协作沟通': { 值: 结果.原始指标.认可度 },
    'P4_价值分配': { 值: 结果.原始指标.进化速度 }
  };

  // 计算K层（哲学认知）
  结果.K层 = {
    'K1_人我边界': { 值: 结果.原始指标.规则稳定性 },
    'K2_客观认知': { 值: 结果.原始指标.采纳率 },
    'K3_因果逻辑': { 值: 结果.原始指标.上下文连续性 },
    'K4_长周期': { 值: 结果.原始指标.进化速度 }
  };

  // 计算V层（三观伦理）
  结果.V层 = {
    'V1_唯物世界观': { 值: 0.6 },
    'V2_创造共生': { 值: 0.6 },
    'V3_共赢价值': { 值: 0.6 },
    'V4_人机对等': { 值: 0.6 }
  };

  return 结果;
}

/**
 * 将采集结果同步到驱动器v2
 */
function 同步到驱动器v2(采集结果) {
  const 状态 = 驱动器v2.加载状态();

  // 更新U层
  if (采集结果.U层) {
    for (const [键, data] of Object.entries(采集结果.U层)) {
      if (状态.U[键]) {
        const 新值 = data.level * 0.2;
        状态.U[键].值 = 新值;
        状态.U[键].档位 = data.level;
      }
    }
  }

  // 更新A层
  if (采集结果.A层) {
    for (const [键, data] of Object.entries(采集结果.A层)) {
      if (状态.A[键]) {
        状态.A[键].值 = data.level * 0.2;
        状态.A[键].档位 = data.level;
      }
    }
  }

  // 更新M层
  for (const [键, data] of Object.entries(采集结果.M层)) {
    if (状态.M[键]) {
      状态.M[键].值 = data.值;
      状态.M[键].档位 = Math.round(data.值 / 0.2);
    }
  }

  // 更新P层
  for (const [键, data] of Object.entries(采集结果.P层)) {
    if (状态.P[键]) {
      状态.P[键].值 = data.值;
      状态.P[键].档位 = Math.round(data.值 / 0.2);
    }
  }

  // 更新K层
  for (const [键, data] of Object.entries(采集结果.K层)) {
    if (状态.K[键]) {
      状态.K[键].值 = data.值;
      状态.K[键].档位 = Math.round(data.值 / 0.2);
    }
  }

  // 更新V层
  for (const [键, data] of Object.entries(采集结果.V层)) {
    if (状态.V[键]) {
      状态.V[键].值 = data.值;
      状态.V[键].档位 = Math.round(data.值 / 0.2);
    }
  }

  驱动器v2.保存状态(状态);
  return 状态;
}

/**
 * 生成缺口报告
 */
function 生成缺口报告() {
  const 采集结果 = 完整采集();
  const 状态 = 驱动器v2.加载状态();
  const 总分 = 驱动器v2.计算总分(状态);

  let 报告 = '\n=== 驱动器v2 缺口报告 ===\n';
  报告 += `时间: ${采集结果.时间戳}\n`;
  报告 += `总分: ${(总分.Total * 100).toFixed(1)}% ${总分.及格 ? '✅ 及格' : '❌ 未及格'} ${总分.危险 ? '🚨 危险' : ''}\n\n`;

  报告 += '各维度:\n';
  报告 += `  U(人类需求): ${(总分.U * 100).toFixed(1)}%\n`;
  报告 += `  A(AI改造世界): ${(总分.A * 100).toFixed(1)}%\n`;
  报告 += `  M(心智成熟): ${(总分.M * 100).toFixed(1)}%\n`;
  报告 += `  P(生产力): ${(总分.P * 100).toFixed(1)}%\n`;
  报告 += `  K(哲学认知): ${(总分.K * 100).toFixed(1)}%\n`;
  报告 += `  V(三观伦理): ${(总分.V * 100).toFixed(1)}%\n\n`;

  报告 += '危险缺口 (< 0.4):\n';
  const 各维度 = [
    { name: 'U', value: 总分.U },
    { name: 'A', value: 总分.A },
    { name: 'M', value: 总分.M },
    { name: 'P', value: 总分.P },
    { name: 'K', value: 总分.K },
    { name: 'V', value: 总分.V }
  ];
  各维度.forEach(d => {
    if (d.value < 0.4) {
      报告 += `  ${d.name}: ${(d.value * 100).toFixed(1)}% ⚠️\n`;
    }
  });

  报告 += '\n原始指标:\n';
  报告 += `  采纳率: ${(采集结果.原始指标.采纳率 * 100).toFixed(1)}%\n`;
  报告 += `  认可度: ${(采集结果.原始指标.认可度 * 100).toFixed(1)}%\n`;
  报告 += `  上下文连续性: ${(采集结果.原始指标.上下文连续性 * 100).toFixed(1)}%\n`;
  报告 += `  进化速度: ${(采集结果.原始指标.进化速度 * 100).toFixed(1)}%\n`;
  报告 += `  规则稳定性: ${(采集结果.原始指标.规则稳定性 * 100).toFixed(1)}%\n`;

  return 报告;
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────
const [,, 命令] = process.argv;

if (命令 === '采集') {
  console.log('开始采集...\n');
  const 采集结果 = 完整采集();
  const 状态 = 同步到驱动器v2(采集结果);
  const 总分 = 驱动器v2.计算总分(状态);
  console.log('采集并同步完成');
  console.log(`总分: ${(总分.Total * 100).toFixed(1)}%`);
} else if (命令 === '状态') {
  const 状态 = 驱动器v2.加载状态();
  const 总分 = 驱动器v2.计算总分(状态);
  console.log(`总分: ${(总分.Total * 100).toFixed(1)}% ${总分.及格 ? '✅ 及格' : '❌ 未及格'} ${总分.危险 ? '🚨 危险' : ''}`);
} else if (命令 === '报告') {
  console.log(生成缺口报告());
} else {
  console.log(`
状态采集器.js - 对齐驱动器v2的数据采集器

用法：
  node 状态采集器.js 采集    采集数据并同步到驱动器v2
  node 状态采集器.js 状态    查看当前总分
  node 状态采集器.js 报告    生成完整缺口报告
`);
}

module.exports = {
  采集U层,
  采集A层,
  采集M层: () => 完整采集().M层,
  采集P层: () => 完整采集().P层,
  采集K层: () => 完整采集().K层,
  采集V层: () => 完整采集().V层,
  完整采集,
  同步到驱动器v2,
  生成缺口报告
};
