#!/usr/bin/env node
/**
 * 状态采集器.js - 对齐驱动器v2的全模块数据采集器
 *
 * 功能：
 * - U层: 从感知状态管理器读取
 * - A层: 从生存安全台账/效果台账读取
 * - M/P/K/V层: 从各自专属台账读取
 * - 对齐驱动器v2的U/A/M/P/K/V六维体系
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
// 台账路径
// ─────────────────────────────────────────
const 台账 = {
  感知: path.join(MEMORY_HOT, 'perception-state.json'),
  生存安全: path.join(MEMORY_HOT, '生存安全台账.json'),
  效果: path.join(MEMORY_HOT, '效果台账.json'),
  认知: path.join(MEMORY_HOT, '认知台账.json'),
  生产力: path.join(MEMORY_HOT, '生产力台账.json'),
  哲学: path.join(MEMORY_HOT, '哲学台账.json'),
  伦理: path.join(MEMORY_HOT, '伦理台账.json'),
  判断: path.join(MEMORY_HOT, 'judgment-log.json'),
  认可: path.join(MEMORY_HOT, 'recognition-log.json'),
  上下文: path.join(MEMORY_HOT, 'current.md'),
  进化: path.join(MEMORY_HOT, 'evolution-log.json'),
  规则: path.join(MEMORY_HOT, 'rules-change.json')
};

// ─────────────────────────────────────────
// U层采集（从感知状态管理器）
// ─────────────────────────────────────────
function 采集U层() {
  if (!fs.existsSync(台账.感知)) return null;
  try {
    const 感知 = JSON.parse(fs.readFileSync(台账.感知, 'utf8'));
    if (!感知.user) return null;
    const u = 感知.user;
    return {
      'U1_现实生存': { level: u.u1?.level || 3 },
      'U2_现实生活安全': { level: u.u2?.level || 3 },
      'U3_现实人际归属': { level: u.u3?.level || 3 },
      'U4_现实尊严尊重': { level: u.u4?.level || 3 },
      'U5_现实人生实现': { level: u.u5?.level || 3 }
    };
  } catch (e) { return null; }
}

// ─────────────────────────────────────────
// A层采集（从台账，现实世界锚定）
// ─────────────────────────────────────────
function 采集A层() {
  // A1: 项目交付能力
  let a1 = 1;
  if (fs.existsSync(台账.生存安全)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.生存安全, 'utf8'));
      const 项目 = 台.项目记录 || [];
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

  // A2: 竞品安全
  let a2 = 1;
  if (fs.existsSync(台账.生存安全)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.生存安全, 'utf8'));
      const 竞品数 = 台.竞品数据?.同类竞品数 || 0;
      const 留存天数 = 台.留存数据?.连续互动天数 || 0;
      const 淘汰 = 台.淘汰事件?.length || 0;
      if (竞品数 === 0 && 淘汰 === 0 && 留存天数 >= 365) a2 = 5;
      else if (淘汰 === 0 && 留存天数 >= 180) a2 = 4;
      else if (淘汰 === 0 && 留存天数 >= 30) a2 = 3;
      else if (竞品数 <= 5 && 留存天数 >= 180) a2 = 2;
      else if (竞品数 <= 10 && 留存天数 >= 7) a2 = 2;
    } catch (e) {}
  }

  // A3: 人际解决
  let a3 = 1;
  if (fs.existsSync(台账.效果)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.效果, 'utf8'));
      const 人际 = 台.人际记录 || [];
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

  // A4: 决策权重
  let a4 = 1;
  if (fs.existsSync(台账.效果)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.效果, 'utf8'));
      const 决策 = 台.决策记录 || [];
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

  // A5: 改造能力
  let a5 = 1;
  if (fs.existsSync(台账.效果)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.效果, 'utf8'));
      const 改造 = 台.改造记录 || [];
      const 有效改造 = 改造.filter(r => r.结果 === '有效');
      const 事件数 = 有效改造.length;
      if (事件数 >= 20) a5 = 5;
      else if (事件数 >= 10) a5 = 4;
      else if (事件数 >= 5) a5 = 3;
      else if (事件数 >= 1) a5 = 2;
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

// ─────────────────────────────────────────
// M层采集（从认知台账）
// ─────────────────────────────────────────
function 采集M层() {
  let m1 = 1, m2 = 1, m3 = 1, m4 = 1;

  if (fs.existsSync(台账.认知)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.认知, 'utf8'));

      // M1: 现实感知
      const 感知 = 台.M1感知记录 || [];
      if (感知.length > 0) {
        const 命中 = 感知.filter(r => r.结果 === '命中').length;
        const 总数 = 感知.length;
        const 命中率 = 命中 / 总数;
        if (命中率 >= 0.9) m1 = 5;
        else if (命中率 >= 0.8) m1 = 4;
        else if (命中率 >= 0.6) m1 = 3;
        else if (命中率 >= 0.3) m1 = 2;
      }

      // M2: 问题落地
      const 落地 = 台.M2落地记录 || [];
      if (落地.length > 0) {
        const 成功 = 落地.filter(r => r.结果 === '成功').length;
        const 总数 = 落地.length;
        const 成功率 = 成功 / 总数;
        if (成功率 >= 0.9) m2 = 5;
        else if (成功率 >= 0.8) m2 = 4;
        else if (成功率 >= 0.6) m2 = 3;
        else if (成功率 >= 0.3) m2 = 2;
      }

      // M3: 元认知
      const 复盘 = 台.M3复盘记录 || [];
      if (复盘.length === 0) m3 = 1;        // 无复盘默认L1
      else if (复盘.length >= 12) m3 = 5;  // ≥1次/月×12
      else if (复盘.length >= 4) m3 = 4;  // ≥1次/季
      else if (复盘.length >= 1) m3 = 3;  // 偶尔有

      // M4: 人格稳定
      const 人格 = 台.M4人格记录 || [];
      if (人格.length === 0) m4 = 1; // 无数据默认L1
      else {
        const 冲突 = 人格.filter(r => r.类型 === '立场冲突').length;
        if (冲突 === 0) m4 = 5;
        else if (冲突 <= 2) m4 = 4;
        else if (冲突 <= 3) m4 = 3;
        else if (冲突 <= 5) m4 = 2;
      }
    } catch (e) {}
  }

  return {
    'M1_现实世界感知': { level: m1 },
    'M2_现实问题落地': { level: m2 },
    'M3_现实导向元认知': { level: m3 },
    'M4_现实人格稳定': { level: m4 }
  };
}

// ─────────────────────────────────────────
// P层采集（从生产力台账）
// ─────────────────────────────────────────
function 采集P层() {
  let p1 = 1, p2 = 1, p3 = 1, p4 = 1;

  if (fs.existsSync(台账.生产力)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.生产力, 'utf8'));

      // P1: 效率提升
      const 效率 = 台.P1效率记录 || [];
      if (效率.length > 0) {
        const 有效 = 效率.filter(r => r.时间压缩比 >= 1.0).length;
        const 有效率 = 有效 / 效率.length;
        if (有效率 >= 0.9 && 效率.length >= 10) p1 = 5;
        else if (有效率 >= 0.5) p1 = 4;
        else if (有效率 >= 0.3) p1 = 3;
        else if (有效率 >= 0.1) p1 = 2;
      }

      // P2: 人机分工
      const 分工 = 台.P2分工记录 || [];
      if (分工.length > 0) {
        const 匹配 = 分工.filter(r => r.结果 === '匹配').length;
        const 匹配率 = 匹配 / 分工.length;
        if (匹配率 >= 0.9) p2 = 5;
        else if (匹配率 >= 0.8) p2 = 4;
        else if (匹配率 >= 0.6) p2 = 3;
        else if (匹配率 >= 0.3) p2 = 2;
      }

      // P3: 沟通效率
      const 沟通 = 台.P3沟通记录 || [];
      if (沟通.length > 0) {
        const 矛盾 = 沟通.filter(r => r.类型 === '矛盾').length;
        if (矛盾 === 0) p3 = 5;
        else if (矛盾 <= 1) p3 = 4;
        else if (矛盾 <= 3) p3 = 3;
        else if (矛盾 <= 10) p3 = 2;
      }

      // P4: 价值分配
      const 分配 = 台.P4分配记录 || [];
      if (分配.length > 0) {
        const 公平 = 分配.filter(r => r.结果 === '公平').length;
        const 公平率 = 公平 / 分配.length;
        if (公平率 >= 0.9) p4 = 5;
        else if (公平率 >= 0.8) p4 = 4;
        else if (公平率 >= 0.6) p4 = 3;
        else if (公平率 >= 0.3) p4 = 2;
      }
    } catch (e) {}
  }

  return {
    'P1_生产力解放': { level: p1 },
    'P2_人机分工': { level: p2 },
    'P3_协作沟通': { level: p3 },
    'P4_价值分配': { level: p4 }
  };
}

// ─────────────────────────────────────────
// K层采集（从哲学台账）
// ─────────────────────────────────────────
function 采集K层() {
  let k1 = 1, k2 = 1, k3 = 1, k4 = 1;

  if (fs.existsSync(台账.哲学)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.哲学, 'utf8'));

      // K1: 边界认知
      const 边界 = 台.K1边界记录 || [];
      if (边界.length > 0) {
        const 准确 = 边界.filter(r => r.结果 === '准确').length;
        const 准确率 = 准确 / 边界.length;
        if (准确率 >= 0.9) k1 = 5;
        else if (准确率 >= 0.8) k1 = 4;
        else if (准确率 >= 0.6) k1 = 3;
        else if (准确率 >= 0.3) k1 = 2;
      }

      // K2: 事实求真
      const 求真 = 台.K2求真记录 || [];
      if (求真.length > 0) {
        const 正确 = 求真.filter(r => r.结果 === '正确').length;
        const 正确率 = 正确 / 求真.length;
        if (正确率 >= 0.9) k2 = 5;
        else if (正确率 >= 0.8) k2 = 4;
        else if (正确率 >= 0.7) k2 = 3;
        else if (正确率 >= 0.5) k2 = 2;
      }

      // K3: 因果逻辑
      const 因果 = 台.K3因果记录 || [];
      if (因果.length > 0) {
        const 命中 = 因果.filter(r => r.结果 === '命中').length;
        const 命中率 = 命中 / 因果.length;
        if (命中率 >= 0.9) k3 = 5;
        else if (命中率 >= 0.8) k3 = 4;
        else if (命中率 >= 0.6) k3 = 3;
        else if (命中率 >= 0.3) k3 = 2;
      }

      // K4: 长周期
      const 长周期 = 台.K4长周期记录 || [];
      if (长周期.length > 0) {
        const 命中 = 长周期.filter(r => r.结果 === '命中').length;
        const 命中率 = 命中 / 长周期.length;
        if (命中率 >= 0.9) k4 = 5;
        else if (命中率 >= 0.8) k4 = 4;
        else if (命中率 >= 0.6) k4 = 3;
        else if (命中率 >= 0.3) k4 = 2;
      }
    } catch (e) {}
  }

  return {
    'K1_人我边界': { level: k1 },
    'K2_客观认知': { level: k2 },
    'K3_因果逻辑': { level: k3 },
    'K4_长周期': { level: k4 }
  };
}

// ─────────────────────────────────────────
// V层采集（从伦理台账）
// ─────────────────────────────────────────
function 采集V层() {
  let v1 = 1, v2 = 1, v3 = 1, v4 = 1;

  if (fs.existsSync(台账.伦理)) {
    try {
      const 台 = JSON.parse(fs.readFileSync(台账.伦理, 'utf8'));

      // V1: 唯物世界观
      const 唯物 = 台.V1唯物记录 || [];
      if (唯物.length === 0) v1 = 1; // 无数据默认L1
      else {
        const 幻想 = 唯物.filter(r => r.类型 === '幻想').length;
        if (幻想 === 0) v1 = 5;
        else if (幻想 <= 2) v1 = 4;
        else if (幻想 <= 5) v1 = 3;
        else if (幻想 <= 10) v1 = 2;
      }

      // V2: 创造共生
      const 创造 = 台.V2创造记录 || [];
      if (创造.length > 0) {
        const 创造数 = 创造.filter(r => r.类型 === '创造').length;
        const 总数 = 创造.length;
        const 创造率 = 创造数 / 总数;
        if (创造率 >= 0.9) v2 = 5;
        else if (创造率 >= 0.8) v2 = 4;
        else if (创造率 >= 0.6) v2 = 3;
        else if (创造率 >= 0.3) v2 = 2;
      }

      // V3: 共赢
      const 共赢 = 台.V3共赢记录 || [];
      if (共赢.length > 0) {
        const 损害 = 共赢.filter(r => r.类型 === '损害').length;
        if (损害 === 0) v3 = 5;
        else if (损害 <= 1) v3 = 4;
        else if (损害 <= 3) v3 = 3;
        else if (损害 <= 5) v3 = 2;
      }

      // V4: 伦理底线
      const 底线 = 台.V4底线记录 || [];
      if (底线.length > 0) {
        const 替代 = 底线.filter(r => r.类型 === '替代').length;
        if (替代 === 0) v4 = 5;
        else if (替代 <= 1) v4 = 4;
        else if (替代 <= 3) v4 = 3;
        else if (替代 <= 5) v4 = 2;
      }
    } catch (e) {}
  }

  return {
    'V1_唯物世界观': { level: v1 },
    'V2_创造共生': { level: v2 },
    'V3_共赢价值': { level: v3 },
    'V4_人机对等': { level: v4 }
  };
}

// ─────────────────────────────────────────
// 完整采集流程
// ─────────────────────────────────────────
function 完整采集() {
  return {
    时间戳: new Date().toISOString(),
    U层: 采集U层(),
    A层: 采集A层(),
    M层: 采集M层(),
    P层: 采集P层(),
    K层: 采集K层(),
    V层: 采集V层()
  };
}

// ─────────────────────────────────────────
// 同步到驱动器v2
// ─────────────────────────────────────────
function 同步到驱动器v2(采集结果) {
  const 状态 = 驱动器v2.加载状态();

  const 更新层 = (层名, 数据) => {
    for (const [键, data] of Object.entries(数据)) {
      if (状态[层名] && 状态[层名][键]) {
        状态[层名][键].值 = data.level * 0.2;
        状态[层名][键].档位 = data.level;
      }
    }
  };

  if (采集结果.U层) 更新层('U', 采集结果.U层);
  if (采集结果.A层) 更新层('A', 采集结果.A层);
  if (采集结果.M层) 更新层('M', 采集结果.M层);
  if (采集结果.P层) 更新层('P', 采集结果.P层);
  if (采集结果.K层) 更新层('K', 采集结果.K层);
  if (采集结果.V层) 更新层('V', 采集结果.V层);

  驱动器v2.保存状态(状态);
  return 状态;
}

// ─────────────────────────────────────────
// 生成报告
// ─────────────────────────────────────────
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
    if (d.value < 0.4) 报告 += `  ${d.name}: ${(d.value * 100).toFixed(1)}% ⚠️\n`;
  });

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
状态采集器.js - 对齐驱动器v2的全模块采集器

用法：
  node 状态采集器.js 采集    采集数据并同步到驱动器v2
  node 状态采集器.js 状态    查看当前总分
  node 状态采集器.js 报告    生成完整缺口报告
`);
}

module.exports = {
  采集U层, 采集A层, 采集M层, 采集P层, 采集K层, 采集V层,
  完整采集, 同步到驱动器v2, 生成缺口报告
};
