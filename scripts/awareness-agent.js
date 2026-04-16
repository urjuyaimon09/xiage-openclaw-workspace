#!/usr/bin/env node
/**
 * awareness-agent.js - 意识循环状态控制器
 * 
 * 职责（纯数据管理，不执行任何 Prompt）：
 * - 意识循环状态维护（当前阶段/触发类型/阶段输出）
 * - 阶段流转控制（跳进/恢复/推进）
 * - 状态查询和展示
 * 
 * 设计原则：
 * - 不调用任何 LLM/Prompt
 * - 不访问 18789 端口
 * - Prompt 执行由 OpenClaw Agent Loop 本身处理
 * 
 * 用法：
 *   node awareness-agent.js status                    查看当前状态
 *   node awareness-agent.js current                  查看当前阶段
 *   node awareness-agent.js next                    推进到下一阶段
 *   node awareness-agent.js jump <phase>           跳转到指定阶段
 *   node awareness-agent.js resume                自动恢复（断点续执）
 *   node awareness-agent.js clear                  清理循环状态
 *   node awareness-agent.js render <model>        渲染指定模型 Prompt（调用 prompt-renderer）
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const WORKSPACE = path.join(__dirname, '..');
const LOOP_STATE_FILE = path.join(WORKSPACE, 'memory', 'hot', 'loop-state.json');

// 阶段映射
const PHASES = {
  1: 'perception',
  2: 'demand',
  3: 'acceptance',
  4: 'plan',
  5: 'execution',
  6: 'feedback'
};

const NEXT_PHASE = {
  1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: null
};

// ─────────────────────────────────────────
// 状态读写
// ─────────────────────────────────────────
function loadState() {
  if (fs.existsSync(LOOP_STATE_FILE)) {
    return JSON.parse(fs.readFileSync(LOOP_STATE_FILE, 'utf8'));
  }
  return null;
}

function saveState(state) {
  const dir = path.dirname(LOOP_STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOOP_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function clearState() {
  if (fs.existsSync(LOOP_STATE_FILE)) {
    fs.unlinkSync(LOOP_STATE_FILE);
  }
}

// ─────────────────────────────────────────
// 状态查询
// ─────────────────────────────────────────
function showStatus() {
  const state = loadState();
  if (!state) {
    console.log('No active loop');
    return;
  }
  console.log(JSON.stringify(state, null, 2));
}

function showCurrent() {
  const state = loadState();
  if (!state) {
    console.log('No active loop');
    return;
  }
  console.log(`Loop: ${state.loopId}`);
  console.log(`Phase: ${state.currentPhase} (${PHASES[state.currentPhase]})`);
  console.log(`Trigger: ${state.triggerType}`);
  console.log(`Started: ${state.startTime}`);
  console.log('\nPhase outputs:');
  Object.keys(state.phaseOutputs || {}).forEach(key => {
    const output = state.phaseOutputs[key];
    const summary = typeof output === 'object' 
      ? JSON.stringify(output).slice(0, 100) + '...'
      : output;
    console.log(`  ${key}: ${summary}`);
  });
}

// ─────────────────────────────────────────
// 阶段流转
// ─────────────────────────────────────────
function nextPhase() {
  const state = loadState();
  if (!state) {
    console.log('No active loop');
    return;
  }
  
  const current = state.currentPhase;
  const next = NEXT_PHASE[current];
  
  if (!next) {
    console.log(`Phase ${current} (${PHASES[current]}) is final - loop complete`);
    clearState();
    console.log('Loop state cleared');
    return;
  }
  
  state.currentPhase = next;
  saveState(state);
  console.log(`Advanced: ${current} → ${next} (${PHASES[next]})`);
}

function jumpToPhase(targetPhase) {
  const state = loadState();
  if (!state) {
    console.log('No active loop');
    return;
  }
  
  if (!PHASES[targetPhase]) {
    console.log(`Invalid phase: ${targetPhase}. Valid: 1-6`);
    return;
  }
  
  state.currentPhase = targetPhase;
  saveState(state);
  console.log(`Jumped to phase ${targetPhase} (${PHASES[targetPhase]})`);
}

function autoResume() {
  const state = loadState();
  if (!state) {
    console.log('No active loop');
    return;
  }
  
  const trigger = state.triggerType;
  let targetPhase;
  
  if (trigger === 'executionBlock') {
    // 执行卡住 → 从执行恢复
    targetPhase = 5;
    console.log(`Auto-resume: execution block → phase ${targetPhase}`);
  } else if (trigger === 'demandChange') {
    // 需求变化 → 从承接恢复
    targetPhase = 3;
    console.log(`Auto-resume: demand changed → phase ${targetPhase}`);
  } else {
    // 默认推进到下一阶段
    targetPhase = NEXT_PHASE[state.currentPhase];
    if (!targetPhase) {
      console.log('Already at final phase');
      return;
    }
    console.log(`Auto-resume: continue → phase ${targetPhase}`);
  }
  
  state.currentPhase = targetPhase;
  saveState(state);
  console.log(`Resumed at phase ${targetPhase} (${PHASES[targetPhase]})`);
}

// ─────────────────────────────────────────
// Prompt 渲染（仅渲染，不执行）
// ─────────────────────────────────────────
function renderPrompt(model) {
  const rendererPath = path.join(WORKSPACE, 'scripts', 'prompt-renderer.js');
  
  try {
    const state = loadState();
    const context = {
      objective: { context: state?.objective || {} },
      triggerType: state?.triggerType || 'userInput',
      phaseOutputs: state?.phaseOutputs || {},
      recentMemoryLimit: 5,
      longTermMemoryLimit: 3,
      scene: state?.objective?.perceptionType || 'general'
    };
    
    const rendered = execSync(
      `node "${rendererPath}" render ${model} '${JSON.stringify(context).replace(/'/g, "'\"'\"'")}'`,
      { cwd: WORKSPACE, encoding: 'utf8', timeout: 10000 }
    );
    
    console.log(rendered);
    return rendered;
  } catch (e) {
    console.error(`Render failed: ${e.message}`);
    return null;
  }
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────
const [,, command, arg1] = process.argv;

if (command === 'status') {
  showStatus();
} else if (command === 'current') {
  showCurrent();
} else if (command === 'next') {
  nextPhase();
} else if (command === 'jump') {
  const phase = parseInt(arg1);
  if (!phase) {
    console.error('Usage: node awareness-agent.js jump <phase(1-6)>');
    process.exit(1);
  }
  jumpToPhase(phase);
} else if (command === 'resume') {
  autoResume();
} else if (command === 'clear') {
  clearState();
  console.log('Loop state cleared');
} else if (command === 'render') {
  const model = arg1 || 'perception';
  if (!['perception', 'demand', 'acceptance', 'plan', 'execution', 'feedback'].includes(model)) {
    console.error(`Invalid model: ${model}`);
    process.exit(1);
  }
  renderPrompt(model);
} else {
  console.log(`
Awareness Agent - 意识循环状态控制器

职责：纯数据管理，不执行 Prompt

Usage:
  node awareness-agent.js status    # 查看完整状态
  node awareness-agent.js current   # 查看当前阶段
  node awareness-agent.js next      # 推进到下一阶段
  node awareness-agent.js jump <n>  # 跳转到指定阶段(1-6)
  node awareness-agent.js resume    # 自动恢复（根据触发类型）
  node awareness-agent.js clear    # 清理循环状态
  node awareness-agent.js render <model>  # 渲染 Prompt（不执行）

Phase mapping:
  1: perception
  2: demand
  3: acceptance
  4: plan
  5: execution
  6: feedback

Note: Prompt 执行由 OpenClaw Agent Loop 本身处理
`);
}

module.exports = {
  loadState,
  saveState,
  clearState,
  showStatus,
  showCurrent,
  nextPhase,
  jumpToPhase,
  autoResume,
  renderPrompt,
  PHASES,
  NEXT_PHASE
};
