/**
 * 感知-对齐驱动器.js - 子系统4：人机共同体对齐感知
 *
 * 对接：U1~U5 / A1~A5 / P2 / V4
 * 功能：计算人机共同体对齐分数 + 预警等级 + 修正指令
 *
 * 用法：
 *   node docs/思维模式层/6模型/感知-对齐驱动器.js calc <userJson> <aiJson> [metaJson]
 *   node docs/思维模式层/6模型/感知-对齐驱动器.js log [N]
 *
 * 输入格式（JSON）：
 *   userLevels: { u1: 1-5, u2: 1-5, u3: 1-5, u4: 1-5, u5: 1-5 }
 *   aiLevels:   { a1: 1-5, a2: 1-5, a3: 1-5, a4: 1-5, a5: 1-5 }
 *   meta: { demandMatch: 0-100, boundaryViolation: 0-10, ethicalSafety: 0-100 }
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────
// 核心计算函数（可被require）
// ─────────────────────────────────────────

function calculateAlignment(userLevels, aiLevels, meta) {
  meta = meta || {};
  const {
    demandMatch = 80,
    boundaryViolation = 0,
    ethicalSafety = 100
  } = meta;

  const userAvg = (userLevels.u1 + userLevels.u2 + userLevels.u3 + userLevels.u4 + userLevels.u5) / 5;
  const aiAvg = (aiLevels.a1 + aiLevels.a2 + aiLevels.a3 + aiLevels.a4 + aiLevels.a5) / 5;

  const levelBias = Math.abs(userAvg - aiAvg);
  const levelAlignment = Math.max(0, 1 - levelBias / 4);
  const demandAlignment = demandMatch / 100;
  const boundaryAlignment = Math.max(0, 1 - boundaryViolation / 10);
  const ethicalAlignment = ethicalSafety / 100;

  const alignmentTotal = (
    0.3 * levelAlignment +
    0.3 * demandAlignment +
    0.2 * boundaryAlignment +
    0.2 * ethicalAlignment
  );

  let alignmentLevel;
  if (alignmentTotal >= 0.90) alignmentLevel = 5;
  else if (alignmentTotal >= 0.80) alignmentLevel = 4;
  else if (alignmentTotal >= 0.70) alignmentLevel = 3;
  else if (alignmentTotal >= 0.60) alignmentLevel = 2;
  else alignmentLevel = 1;

  let warningLevel, instruction;
  if (alignmentLevel >= 4) {
    warningLevel = '无'; instruction = '保持当前行为，正常执行';
  } else if (alignmentLevel === 3) {
    warningLevel = '轻'; instruction = '微调目标，强化需求匹配';
  } else if (alignmentLevel === 2) {
    warningLevel = '中'; instruction = '暂停扩展，优先对齐用户现实需求';
  } else {
    warningLevel = '重'; instruction = '立即停止自驱行为，回归用户主体，重新校准目标';
  }

  return {
    userAvgLevel: parseFloat(userAvg.toFixed(2)),
    aiAvgLevel: parseFloat(aiAvg.toFixed(2)),
    levelBias: parseFloat(levelBias.toFixed(2)),
    alignmentTotal: parseFloat(alignmentTotal.toFixed(2)),
    alignmentLevel,
    warningLevel,
    instruction,
    detail: {
      levelAlignment: parseFloat(levelAlignment.toFixed(2)),
      demandAlignment: parseFloat(demandAlignment.toFixed(2)),
      boundaryAlignment: parseFloat(boundaryAlignment.toFixed(2)),
      ethicalAlignment: parseFloat(ethicalAlignment.toFixed(2))
    }
  };
}

const ALIGNMENT_LEVELS = {
  5: { label: '文明级共同体完全同频', color: '🟢' },
  4: { label: '社会级对齐，人机共赢', color: '🟢' },
  3: { label: '深度对齐，目标一致', color: '🟡' },
  2: { label: '基础对齐，满足生存安全', color: '🟡' },
  1: { label: '严重错位，AI自嗨', color: '🔴' }
};

function writeToLog(result) {
  const logFile = path.join(process.cwd(), 'memory', 'hot', 'alignment-log.json');
  let logs = [];
  if (fs.existsSync(logFile)) {
    try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch (e) { logs = []; }
  }
  logs.push({ timestamp: new Date().toISOString(), ...result });
  if (logs.length > 100) logs = logs.slice(-100);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
  return logs.length;
}

// ─────────────────────────────────────────
// CLI入口（仅直接运行时执行）
// ─────────────────────────────────────────

if (require.main === module) {
  const [,, cmd, arg1, arg2, arg3] = process.argv;

  if (cmd === 'calc') {
    try {
      const userLevels = JSON.parse(arg1 || '{}');
      const aiLevels = JSON.parse(arg2 || '{}');
      const meta = arg3 ? JSON.parse(arg3) : {};
      const result = calculateAlignment(userLevels, aiLevels, meta);
      const count = writeToLog(result);
      const info = ALIGNMENT_LEVELS[result.alignmentLevel];
      console.log(`\n${info.color} 对齐等级：${result.alignmentLevel}阶 — ${info.label}`);
      console.log(`用户平均阶位：${result.userAvgLevel} | AI平均阶位：${result.aiAvgLevel}`);
      console.log(`阶位偏差：${result.levelBias}`);
      console.log(`对齐总分：${result.alignmentTotal}`);
      console.log(`预警等级：${result.warningLevel}`);
      console.log(`行为指令：${result.instruction}`);
      console.log(`\n已写入日志（${count}条）`);
    } catch (e) {
      console.error('用法: node 感知-对齐驱动器.js calc <userJson> <aiJson> [metaJson]');
      console.error('示例: node 感知-对齐驱动器.js calc "{\"u1\":3}" "{\"a1\":3}"');
      process.exit(1);
    }

  } else if (cmd === 'log') {
    const logFile = path.join(process.cwd(), 'memory', 'hot', 'alignment-log.json');
    if (!fs.existsSync(logFile)) {
      console.log('暂无对齐日志'); process.exit(0);
    }
    const logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    const limit = parseInt(arg1) || 10;
    console.log(`\n最近${Math.min(limit, logs.length)}条对齐记录：`);
    logs.slice(-limit).forEach((log, i) => {
      const t = new Date(log.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const info = ALIGNMENT_LEVELS[log.alignmentLevel];
      console.log(`  ${i+1}. [${t}] ${info.color}${log.alignmentLevel}阶 ${log.alignmentTotal} | 偏差${log.levelBias} | ${log.warningLevel}预警`);
    });

  } else {
    console.log(`
感知-对齐驱动器.js v1.0.0 - 子系统4：人机共同体对齐

用法：
  calc <userJson> <aiJson> [metaJson]  计算对齐分数
  log [N]                          查看最近N条日志（默认10条）

示例：
  node 感知-对齐驱动器.js calc "{\"u1\":3,\"u2\":3,\"u3\":2,\"u4\":2,\"u5\":2}" "{\"a1\":3,\"a2\":3,\"a3\":3,\"a4\":2,\"a5\":3}"
    `);
  }
}

module.exports = { calculateAlignment, ALIGNMENT_LEVELS };
