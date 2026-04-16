#!/usr/bin/env node
/**
 * consciousness-loop.js - 意识循环总控脚本
 * 
 * 功能：状态机管理 + 循环路由
 * 状态存储：memory/hot/loop-state.json
 * 
 * 用法：
 *   node consciousness-loop.js trigger <type> <data>   触发新循环
 *   node consciousness-loop.js status                   查看当前状态
 *   node consciousness-loop.js resume                    从断点恢复
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const LOOP_STATE_FILE = path.join(WORKSPACE, 'memory', 'hot', 'loop-state.json');
const IMPLICIT_MEMORY_FILE = path.join(WORKSPACE, 'config', 'implicit-memory.json');

// 意识循环轮次
const PHASES = {
  PERCEPTION: 1,
  DEMAND: 2,
  ACCEPTANCE: 3,
  PLAN: 4,
  EXECUTION: 5,
  FEEDBACK: 6
};

const PHASE_NAMES = {
  1: 'perception',
  2: 'demand',
  3: 'acceptance',
  4: 'plan',
  5: 'execution',
  6: 'feedback'
};

// 触发类型 → 起始轮次
const TRIGGER_START_PHASE = {
  userInput: 1,       // 用户输入 → 从感知开始
  cronPerception: 1,  // Cron主动感知 → 从感知开始
  executionBlock: 5,  // 执行卡住 → 从执行恢复
  demandChange: 2     // 需求变化 → 从需求开始（重新评估）
};

// ─────────────────────────────────────────
// 状态读写
// ─────────────────────────────────────────
function loadState() {
  if (fs.existsSync(LOOP_STATE_FILE)) {
    return JSON.parse(fs.readFileSync(LOOP_STATE_FILE, 'utf8'));
  }
  return {
    active: false,
    currentPhase: 0,
    triggerType: null,
    objective: null,
    phaseOutputs: {},
    loopId: null,
    startTime: null
  };
}

function saveState(state) {
  const memDir = path.dirname(LOOP_STATE_FILE);
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true });
  }
  fs.writeFileSync(LOOP_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function clearState() {
  if (fs.existsSync(LOOP_STATE_FILE)) {
    fs.unlinkSync(LOOP_STATE_FILE);
  }
}

// ─────────────────────────────────────────
// 循环控制
// ─────────────────────────────────────────
function startLoop(triggerType, objectiveData) {
  const startPhase = TRIGGER_START_PHASE[triggerType] || 1;
  const state = {
    active: true,
    currentPhase: startPhase,
    triggerType,
    objective: objectiveData,
    phaseOutputs: {},
    loopId: generateLoopId(),
    startTime: new Date().toISOString()
  };
  saveState(state);
  console.log(`[Loop ${state.loopId}] Started: trigger=${triggerType}, startPhase=${PHASE_NAMES[startPhase]}`);
  return state;
}

function advancePhase() {
  const state = loadState();
  if (!state.active) {
    console.log('[Loop] No active loop to advance');
    return null;
  }
  
  const nextPhase = state.currentPhase + 1;
  if (nextPhase > 6) {
    console.log(`[Loop ${state.loopId}] Completed`);
    clearState();
    return { done: true };
  }
  
  state.currentPhase = nextPhase;
  saveState(state);
  console.log(`[Loop ${state.loopId}] Advanced to phase ${nextPhase}: ${PHASE_NAMES[nextPhase]}`);
  return state;
}

function savePhaseOutput(phase, output) {
  const state = loadState();
  state.phaseOutputs[PHASE_NAMES[phase]] = output;
  saveState(state);
}

function getPhaseOutput(phase) {
  const state = loadState();
  return state.phaseOutputs[PHASE_NAMES[phase]] || null;
}

// ─────────────────────────────────────────
// 快速恢复通道（断点跳转）
// ─────────────────────────────────────────
function skipToPhase(targetPhase) {
  const state = loadState();
  if (!state.active) {
    console.log('[Loop] No active loop to skip');
    return null;
  }
  
  if (targetPhase < 1 || targetPhase > 6) {
    console.log(`[Loop] Invalid phase: ${targetPhase}`);
    return null;
  }
  
  console.log(`[Loop ${state.loopId}] Skipping to phase ${targetPhase}: ${PHASE_NAMES[targetPhase]}`);
  state.currentPhase = targetPhase;
  saveState(state);
  return state;
}

function autoResume() {
  const state = loadState();
  if (!state.active) {
    console.log('[Loop] No active loop to resume');
    return null;
  }
  
  const triggerType = state.triggerType;
  let targetPhase;
  
  // 根据触发类型和卡点状态自动判断恢复点
  if (triggerType === 'executionBlock') {
    // 执行卡住 → 检查卡住信息判断恢复点
    const execOutput = state.phaseOutputs['execution'];
    if (execOutput?.执行结果?.卡住信息) {
      // 有卡住信息 → 从执行继续
      targetPhase = 5;
      console.log(`[Loop ${state.loopId}] Auto-resume: execution block detected, resuming at execution`);
    } else {
      // 无卡住信息 → 从执行开始重新评估
      targetPhase = 5;
      console.log(`[Loop ${state.loopId}] Auto-resume: no block info, resuming at execution`);
    }
  } else if (triggerType === 'demandChange') {
    // 需求变化 → 从承接重新评估
    targetPhase = 3;
    console.log(`[Loop ${state.loopId}] Auto-resume: demand changed, resuming at acceptance`);
  } else {
    // 默认继续当前阶段
    targetPhase = state.currentPhase;
    console.log(`[Loop ${state.loopId}] Auto-resume: continuing at phase ${targetPhase}`);
  }
  
  state.currentPhase = targetPhase;
  saveState(state);
  return state;
}

// ─────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────
function generateLoopId() {
  const now = new Date();
  return `loop-${now.toISOString().slice(0, 13).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadImplicitMemory() {
  if (fs.existsSync(IMPLICIT_MEMORY_FILE)) {
    return JSON.parse(fs.readFileSync(IMPLICIT_MEMORY_FILE, 'utf8'));
  }
  return null;
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, command, arg1, arg2] = process.argv;

if (command === 'trigger') {
  const triggerType = arg1;
  const objectiveData = arg2 || '{}';
  try {
    const obj = JSON.parse(objectiveData);
    startLoop(triggerType, obj);
  } catch (e) {
    console.error('Invalid objective JSON:', e.message);
    process.exit(1);
  }
} else if (command === 'status') {
  const state = loadState();
  console.log(JSON.stringify(state, null, 2));
} else if (command === 'advance') {
  const result = advancePhase();
  if (result && result.done) {
    console.log('Loop completed');
  }
} else if (command === 'save') {
  const [phase, output] = [arg1, arg2];
  if (!phase || !output) {
    console.error('Usage: node consciousness-loop.js save <phase> <outputJSON>');
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(output);
    savePhaseOutput(parseInt(phase), parsed);
    console.log(`Phase ${phase} output saved`);
  } catch (e) {
    console.error('Invalid output JSON:', e.message);
    process.exit(1);
  }
} else if (command === 'get') {
  const phase = parseInt(arg1);
  if (!phase) {
    console.error('Usage: node consciousness-loop.js get <phaseNum>');
    process.exit(1);
  }
  const output = getPhaseOutput(phase);
  console.log(JSON.stringify(output, null, 2));
} else if (command === 'clear') {
  clearState();
  console.log('Loop state cleared');
} else if (command === 'implicit-memory') {
  const mem = loadImplicitMemory();
  console.log(JSON.stringify(mem, null, 2));
} else if (command === 'skip') {
  const phase = parseInt(arg1);
  if (!phase) {
    console.error('Usage: node consciousness-loop.js skip <phaseNum>');
    process.exit(1);
  }
  skipToPhase(phase);
} else if (command === 'resume') {
  autoResume();
} else {
  console.log(`
Consciousness Loop Controller

Usage:
  node consciousness-loop.js trigger <type> <objectiveJSON>  Start new loop
  node consciousness-loop.js status                           Show current state
  node consciousness-loop.js advance                           Advance to next phase
  node consciousness-loop.js save <phase> <outputJSON>        Save phase output
  node consciousness-loop.js get <phaseNum>                    Get phase output
  node consciousness-loop.js clear                             Clear loop state
  node consciousness-loop.js implicit-memory                   Load implicit memory

Trigger types:
  userInput       - User input → starts at perception (1)
  cronPerception  - Cron trigger → starts at perception (1)
  executionBlock  - Execution blocked → resumes at execution (5)
  demandChange    - Demand changed → resumes at demand (2)

Quick Recovery:
  node consciousness-loop.js skip <phase>   Jump to specific phase
  node consciousness-loop.js resume         Auto-detect recovery point
`);
}

module.exports = {
  startLoop,
  advancePhase,
  savePhaseOutput,
  getPhaseOutput,
  skipToPhase,
  autoResume,
  loadState,
  PHASES,
  PHASE_NAMES
};
