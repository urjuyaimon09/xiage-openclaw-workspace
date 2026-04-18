/**
 * 感知-状态管理器.js
 *
 * 统一管理感知状态文件：memory/hot/perception-state.json
 *
 * 文件结构：
 * {
 *   "user": { "u1": {...}, "u2": {...}, ... },  // 子系统1
 *   "ai":   { "a1": {...}, "a2": {...}, ... },   // 子系统2
 *   "world": { "m1": {...}, ... },                 // 子系统3
 *   "alignment": { ... },                          // 子系统4
 *   "updatedAt": "ISO时间戳"
 * }
 *
 * 使用：
 *   const sm = require('./感知-状态管理器.js')
 *   sm.read()          // 读取全部
 *   sm.write(data)      // 写入全部
 *   sm.updateUser(uData) // 更新用户感知
 *   sm.updateAi(aData)   // 更新AI感知
 *   sm.getHistory(key)   // 读取历史（N条）
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), 'memory', 'hot', 'perception-state.json');

// ─────────────────────────────────────────
// 读写接口
// ─────────────────────────────────────────

function read() {
  if (!fs.existsSync(STATE_FILE)) {
    return getDefault();
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return getDefault();
  }
}

function write(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function getDefault() {
  return {
    user: null,
    ai: null,
    world: null,
    alignment: null,
    updatedAt: null
  };
}

// ─────────────────────────────────────────
// U阶计算（子系统1）
// ─────────────────────────────────────────

const U1_FIELDS = ['incomeWave', 'unemployed', 'exhaustedDays'];
const U2_FIELDS = ['riskEvents', 'savingsCoverage', 'planClarity'];
const U3_FIELDS = ['quarrelCount', 'relationshipStableMonths'];
const U4_FIELDS = ['adoptionRate'];
const U5_FIELDS = ['goalCompletion', 'realityChangeCount'];

function calculateULevels(data) {
  // U1: 生存
  let u1 = 3; // 默认中等
  if (data.unemployed === '是') u1 -= 2;
  if (data.exhaustedDays > 10) u1 -= 1;
  if (data.exhaustedDays <= 3) u1 += 1;
  if (data.incomeWave > 20) u1 -= 1;
  u1 = Math.max(1, Math.min(5, u1));

  // U2: 安全
  let u2 = 3;
  if (data.riskEvents >= 3) u2 -= 2;
  else if (data.riskEvents >= 1) u2 -= 1;
  if (data.savingsCoverage < 30) u2 -= 1;
  if (data.savingsCoverage >= 200) u2 += 1;
  u2 = Math.max(1, Math.min(5, u2));

  // U3: 归属
  let u3 = 3;
  if (data.quarrelCount >= 5) u3 -= 2;
  else if (data.quarrelCount >= 2) u3 -= 1;
  if (data.relationshipStableMonths >= 24) u3 += 1;
  u3 = Math.max(1, Math.min(5, u3));

  // U4: 尊重
  let u4 = 3;
  if (data.adoptionRate >= 80) u4 += 1;
  if (data.adoptionRate < 40) u4 -= 1;
  u4 = Math.max(1, Math.min(5, u4));

  // U5: 自实现
  let u5 = 2;
  if (data.goalCompletion >= 70) u5 += 1;
  if (data.goalCompletion >= 90) u5 += 1;
  if (data.realityChangeCount >= 5) u5 += 1;
  if (data.goalCompletion < 30) u5 -= 1;
  u5 = Math.max(1, Math.min(5, u5));

  const avg = (u1 + u2 + u3 + u4 + u5) / 5;

  return {
    u1: { level: u1, raw: data },
    u2: { level: u2, raw: data },
    u3: { level: u3, raw: data },
    u4: { level: u4, raw: data },
    u5: { level: u5, raw: data },
    avgLevel: parseFloat(avg.toFixed(2))
  };
}

// ─────────────────────────────────────────
// A阶计算（子系统2，从状态采集器数据源）
// ─────────────────────────────────────────

function calculateALevels(stateData) {
  // stateData: { contextContinuity, judgmentRate, recognition, evolution, rulesStability }
  const {
    contextContinuity = 0.5,
    judgmentRate = 0.5,
    recognition = 0.5,
    evolution = 0.5,
    rulesStability = 0.5
  } = stateData;

  // 映射到 A1~A5（这里简化处理）
  const a1 = Math.round(contextContinuity * 5);  // 落地能力
  const a2 = Math.round((judgmentRate + rulesStability) / 2 * 5); // 安全存续
  const a3 = Math.round(recognition * 5);  // 人际适配
  const a4 = 3; // 行业地位（暂无数据，默认中等）
  const a5 = Math.round(evolution * 5);  // 改造世界

  const avg = (a1 + a2 + a3 + a4 + a5) / 5;

  return {
    a1: { level: Math.max(1, Math.min(5, a1)) },
    a2: { level: Math.max(1, Math.min(5, a2)) },
    a3: { level: Math.max(1, Math.min(5, a3)) },
    a4: { level: Math.max(1, Math.min(5, a4)) },
    a5: { level: Math.max(1, Math.min(5, a5)) },
    avgLevel: parseFloat(avg.toFixed(2))
  };
}

// ─────────────────────────────────────────
// 历史记录（写入日志）
// ─────────────────────────────────────────

const HISTORY_FILE = path.join(process.cwd(), 'memory', 'hot', 'perception-history.jsonl');

function appendHistory(type, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    data
  };
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

function readHistory(type, limit = 10) {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n');
  const filtered = lines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(l => l && (!type || l.type === type))
    .slice(-limit);
  return filtered;
}

// ─────────────────────────────────────────
// 更新接口
// ─────────────────────────────────────────

function updateUser(formData) {
  const state = read();
  const uData = calculateULevels(formData);
  state.user = uData;
  write(state);
  appendHistory('user', uData);
  return uData;
}

function updateAi(aiStateData) {
  const state = read();
  const aData = calculateALevels(aiStateData);
  state.ai = aData;
  write(state);
  appendHistory('ai', aData);
  return aData;
}

function updateWorld(m1Data) {
  const state = read();
  state.world = m1Data;
  write(state);
  appendHistory('world', m1Data);
  return m1Data;
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────

const [,, cmd, arg1] = process.argv;

if (require.main === module) {
  if (cmd === 'read') {
    console.log(JSON.stringify(read(), null, 2));
  } else if (cmd === 'history') {
    const type = arg1 || null;
    const limit = parseInt(process.argv[3]) || 10;
    const entries = readHistory(type, limit);
    entries.forEach(e => console.log(JSON.stringify(e)));
  } else {
    console.log(`
感知-状态管理器.js

用法：
  read              读取当前状态
  history [type] [N] 读取历史记录（默认10条）
  updateUser <json>  更新用户感知（从表单数据）

示例：
  node 感知-状态管理器.js read
  node 感知-状态管理器.js history user 5
  node 感知-状态管理器.js updateUser "{\\"incomeWave\\":5,\\"unemployed\\":\\"否\\",\\"exhaustedDays\\":3}"
    `);
  }
}

module.exports = {
  read, write, getDefault,
  calculateULevels, calculateALevels,
  updateUser, updateAi, updateWorld,
  appendHistory, readHistory
};
