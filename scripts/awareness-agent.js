#!/usr/bin/env node
/**
 * awareness-agent.js - 意识Agent封装
 * 
 * 职责：
 * - 封装OpenCLAW Prompt调用
 * - 意识循环阶段流转控制
 * - 阶段间数据传递
 * 
 * 用法：
 *   node awareness-agent.js run [loopId]      运行一轮意识循环
 *   node awareness-agent.js continue          从断点继续
 *   node awareness-agent.js step <phase>      单步执行指定阶段
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const WORKSPACE = path.join(__dirname, '..');
const LOOP_STATE_FILE = path.join(WORKSPACE, 'memory', 'hot', 'loop-state.json');

// OpenCLAW配置
const OPENCLAW_CONFIG = {
  host: 'localhost',
  port: 18789,
  protocol: 'http'
};

// 阶段到模型的映射
const PHASE_TO_MODEL = {
  1: 'perception',
  2: 'demand',
  3: 'acceptance',
  4: 'plan',
  5: 'execution',
  6: 'feedback'
};

// 下一阶段映射
const NEXT_PHASE = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: null  // 结束
};

// ─────────────────────────────────────────
// 状态读写
// ─────────────────────────────────────────
function loadLoopState() {
  if (fs.existsSync(LOOP_STATE_FILE)) {
    return JSON.parse(fs.readFileSync(LOOP_STATE_FILE, 'utf8'));
  }
  return null;
}

function saveLoopState(state) {
  const dir = path.dirname(LOOP_STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOOP_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ─────────────────────────────────────────
// Prompt调用
// ─────────────────────────────────────────
function renderPrompt(model, context) {
  const rendererPath = path.join(WORKSPACE, 'scripts', 'prompt-renderer.js');
  const contextJSON = JSON.stringify(context).replace(/"/g, '\\"');
  
  try {
    const result = execSync(`node "${rendererPath}" render ${model} "${contextJSON}"`, {
      cwd: WORKSPACE,
      encoding: 'utf8',
      timeout: 30000
    });
    return result.trim();
  } catch (e) {
    console.error(`[AwarenessAgent] Render error: ${e.message}`);
    return null;
  }
}

function callPrompt(promptText) {
  // 调用OpenCLAW Gateway API
  // 当前版本：模拟调用，直接返回Prompt文本供调试
  // 实际对接：需要调用 sessions_spawn 或 gateway API
  
  console.log(`[AwarenessAgent] Calling prompt (${promptText.length} chars)...`);
  
  // 方案A：调用sessions_spawn
  // 方案B：调用gateway HTTP API
  
  // 临时方案：返回渲染后的prompt供手动执行
  return {
    success: true,
    prompt: promptText,
    note: 'Manual execution required - integrate with OpenCLAW API'
  };
  
  /* 未来对接Gateway API:
  const postData = JSON.stringify({ prompt: promptText });
  const options = {
    hostname: OPENCLAW_CONFIG.host,
    port: OPENCLAW_CONFIG.port,
    path: '/api/agent/exec',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  */
}

function parsePromptOutput(output, model) {
  // 尝试解析JSON输出
  try {
    // 提取JSON块
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/) || 
                      output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[jsonMatch.length - 1]);
    }
  } catch (e) {
    console.error(`[AwarenessAgent] Parse error for ${model}: ${e.message}`);
  }
  return null;
}

// ─────────────────────────────────────────
// 阶段执行
// ─────────────────────────────────────────
function executePhase(phaseNum, state) {
  const model = PHASE_TO_MODEL[phaseNum];
  if (!model) {
    console.error(`[AwarenessAgent] Unknown phase: ${phaseNum}`);
    return null;
  }
  
  console.log(`[AwarenessAgent] Executing phase ${phaseNum}: ${model}`);
  
  // 构建上下文
  const context = {
    objective: {
      context: state.objective
    },
    triggerType: state.triggerType,
    phaseOutputs: state.phaseOutputs || {},
    loopState: state,
    recentMemoryLimit: 5,
    longTermMemoryLimit: 3,
    scene: state.objective?.perceptionType || 'general'
  };
  
  // 渲染Prompt
  const promptText = renderPrompt(model, context);
  if (!promptText) {
    console.error(`[AwarenessAgent] Failed to render prompt for ${model}`);
    return null;
  }
  
  // 调用Prompt
  const result = callPrompt(promptText);
  if (!result.success) {
    console.error(`[AwarenessAgent] Prompt call failed`);
    return null;
  }
  
  // 解析输出
  const parsed = parsePromptOutput(result.prompt, model);
  
  // 保存阶段输出
  if (parsed) {
    state.phaseOutputs[model] = parsed;
    saveLoopState(state);
    
    console.log(`[AwarenessAgent] Phase ${phaseNum} output:`, JSON.stringify(parsed).slice(0, 200));
  }
  
  return parsed;
}

// ─────────────────────────────────────────
// 循环控制
// ─────────────────────────────────────────
function runLoop() {
  const state = loadLoopState();
  if (!state || !state.active) {
    console.log('[AwarenessAgent] No active loop');
    return;
  }
  
  console.log(`[AwarenessAgent] Running loop ${state.loopId}, current phase: ${state.currentPhase}`);
  
  // 执行当前阶段
  const output = executePhase(state.currentPhase, state);
  if (!output) {
    console.error('[AwarenessAgent] Phase execution failed');
    return;
  }
  
  // 检查是否结束
  const nextPhase = NEXT_PHASE[state.currentPhase];
  if (!nextPhase) {
    console.log(`[AwarenessAgent] Loop completed`);
    // 清理状态
    fs.unlinkSync(LOOP_STATE_FILE);
    return;
  }
  
  // 推进到下一阶段
  state.currentPhase = nextPhase;
  saveLoopState(state);
  console.log(`[AwarenessAgent] Advanced to phase ${nextPhase}`);
}

function continueLoop() {
  const state = loadLoopState();
  if (!state || !state.active) {
    console.log('[AwarenessAgent] No active loop to continue');
    return;
  }
  
  // 从当前阶段继续
  runLoop();
}

function stepToPhase(targetPhase) {
  const state = loadLoopState();
  if (!state || !state.active) {
    console.log('[AwarenessAgent] No active loop');
    return;
  }
  
  if (!PHASE_TO_MODEL[targetPhase]) {
    console.error(`[AwarenessAgent] Invalid phase: ${targetPhase}`);
    return;
  }
  
  console.log(`[AwarenessAgent] Skipping to phase ${targetPhase}`);
  state.currentPhase = targetPhase;
  saveLoopState(state);
  runLoop();
}

// ─────────────────────────────────────────
// 快速恢复通道
// ─────────────────────────────────────────
function quickResume() {
  const state = loadLoopState();
  if (!state || !state.active) {
    console.log('[AwarenessAgent] No active loop');
    return;
  }
  
  // 根据触发类型决定恢复点
  const triggerType = state.triggerType;
  
  if (triggerType === 'executionBlock') {
    // 执行卡住 → 从执行阶段恢复
    if (state.phaseOutputs?.execution?.执行结果?.卡住信息) {
      console.log('[AwarenessAgent] Quick resume: execution block detected, resuming at execution');
      stepToPhase(5);
    } else {
      console.log('[AwarenessAgent] Quick resume: no block info, continuing normally');
      continueLoop();
    }
  } else if (triggerType === 'demandChange') {
    // 需求变化 → 从承接阶段恢复
    console.log('[AwarenessAgent] Quick resume: demand changed, resuming at acceptance');
    stepToPhase(3);
  } else {
    // 默认继续当前阶段
    continueLoop();
  }
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, command, arg1] = process.argv;

if (command === 'run') {
  const loopId = arg1;
  const state = loadLoopState();
  if (!state && !loopId) {
    console.log('[AwarenessAgent] No loop state found');
    process.exit(1);
  }
  if (state) {
    runLoop();
  } else {
    console.log(`[AwarenessAgent] Would run loop ${loopId}`);
  }
} else if (command === 'continue') {
  continueLoop();
} else if (command === 'step') {
  const phase = parseInt(arg1);
  if (!phase) {
    console.error('Usage: node awareness-agent.js step <phaseNum>');
    process.exit(1);
  }
  stepToPhase(phase);
} else if (command === 'resume') {
  quickResume();
} else if (command === 'status') {
  const state = loadLoopState();
  console.log(JSON.stringify(state, null, 2));
} else if (command === 'test') {
  // 测试渲染
  const state = {
    active: true,
    loopId: 'test-001',
    currentPhase: 1,
    triggerType: 'userInput',
    objective: { context: '测试输入' },
    phaseOutputs: {}
  };
  const output = executePhase(1, state);
  console.log('Test output:', JSON.stringify(output, null, 2));
} else {
  console.log(`
Awareness Agent

Usage:
  node awareness-agent.js run [loopId]   Run one cycle of active loop
  node awareness-agent.js continue       Continue current loop
  node awareness-agent.js step <phase>  Jump to specific phase
  node awareness-agent.js resume        Quick resume (auto-detect recovery point)
  node awareness-agent.js status        Show current loop state
  node awareness-agent.js test          Test phase execution

Phase mapping:
  1: perception
  2: demand
  3: acceptance
  4: plan
  5: execution
  6: feedback
`);
}

module.exports = {
  executePhase,
  runLoop,
  continueLoop,
  stepToPhase,
  quickResume,
  renderPrompt,
  callPrompt,
  PHASE_TO_MODEL,
  NEXT_PHASE
};
