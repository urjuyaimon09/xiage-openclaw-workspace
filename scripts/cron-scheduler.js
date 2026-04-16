#!/usr/bin/env node
/**
 * cron-scheduler.js - Cron调度器
 * 
 * 职责：
 * - 感知数据分类调度（高频繁/中频繁/低频繁）
 * - 紧急任务插队
 * - 循环频率切换
 * 
 * 感知分类：
 * - 高频繁感（小时级）：坚果状态、系统健康
 * - 中频繁感（日级）：AI趋势、行业动态
 * - 低频繁感（周级）：社会脉络、长期风险
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKSPACE = path.join(__dirname, '..');
const STATE_FILE = path.join(WORKSPACE, 'memory', 'hot', 'cron-scheduler-state.json');

// 感知频率配置
const PERCEPTION_CRON_CONFIG = {
  high: { // 小时级 - 系统/坚果状态
    name: 'high-frequency',
    cronExpr: '0 * * * *', // 每小时
    perceptionType: 'system坚果Status',
    description: '系统健康 + 坚果状态'
  },
  medium: { // 日级 - AI趋势/行业动态
    name: 'medium-frequency',
    cronExpr: '0 9 * * *', // 每天早上9点
    perceptionType: 'aiTrendIndustry',
    description: 'AI趋势 + 行业动态'
  },
  low: { // 周级 - 社会脉络/长期风险
    name: 'low-frequency',
    cronExpr: '0 10 * * 1', // 每周一早上10点
    perceptionType: 'socialContext',
    description: '社会脉络 + 长期风险'
  }
};

// 紧急任务配置
const EMERGENCY_TASKS = {
  systemCritical: {
    name: 'system-critical',
    priority: 1,
    description: '系统崩溃/数据泄露等生死事件'
  },
  urgentDemand: {
    name: 'urgent-demand',
    priority: 2,
    description: '坚果紧急需求'
  },
  executionBlock: {
    name: 'execution-block',
    priority: 3,
    description: '执行卡住需要恢复'
  }
};

// ─────────────────────────────────────────
// 状态管理
// ─────────────────────────────────────────
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return {
    active: false,
    jobs: {},
    emergencyQueue: [],
    currentRates: { high: true, medium: true, low: true }
  };
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ─────────────────────────────────────────
// Cron任务管理
// ─────────────────────────────────────────
const jobs = {};
let state = null;

function startCronJob(key, config, onTick) {
  // 将cron表达式转换为毫秒间隔
  const intervalMs = cronExprToMs(config.cronExpr);
  
  const job = setInterval(() => {
    console.log(`[CronScheduler] ${key} tick: ${config.description}`);
    onTick(key, config);
  }, intervalMs);
  
  jobs[key] = { interval: job, config };
  console.log(`[CronScheduler] Started: ${key} (${config.cronExpr} = ${intervalMs}ms) - ${config.description}`);
  return job;
}

function cronExprToMs(cronExpr) {
  // 简化版：将常见cron表达式转为毫秒
  // 格式：分 时 日 月 周
  const parts = cronExpr.split(' ');
  if (parts.length !== 5) return 3600000; // 默认1小时
  
  const [minute, hour, , , dayOfWeek] = parts;
  
  // 每小时：0 * * * *
  if (minute === '0' && hour === '*' && dayOfWeek === '*') {
    return 60 * 60 * 1000; // 1小时
  }
  
  // 每天早上9点：0 9 * * *
  if (minute === '0' && hour === '9') {
    return 24 * 60 * 60 * 1000; // 24小时
  }
  
  // 每周一早上10点：0 10 * * 1
  if (minute === '0' && hour === '10' && dayOfWeek === '1') {
    return 7 * 24 * 60 * 60 * 1000; // 7天
  }
  
  return 3600000; // 默认1小时
}

function stopCronJob(key) {
  if (jobs[key]) {
    clearInterval(jobs[key].interval);
    delete jobs[key];
    console.log(`[CronScheduler] Stopped: ${key}`);
  }
}

function startAllJobs() {
  state = loadState();
  state.active = true;
  saveState(state);
  
  // 启动高频任务
  if (state.currentRates.high) {
    startCronJob('high', PERCEPTION_CRON_CONFIG.high, triggerPerceptionLoop);
  }
  
  // 启动中频任务
  if (state.currentRates.medium) {
    startCronJob('medium', PERCEPTION_CRON_CONFIG.medium, triggerPerceptionLoop);
  }
  
  // 启动低频任务
  if (state.currentRates.low) {
    startCronJob('low', PERCEPTION_CRON_CONFIG.low, triggerPerceptionLoop);
  }
}

function stopAllJobs() {
  Object.keys(jobs).forEach(key => stopCronJob(key));
  state = loadState();
  state.active = false;
  saveState(state);
}

// ─────────────────────────────────────────
// 触发意识循环
// ─────────────────────────────────────────
function triggerPerceptionLoop(frequencyKey, config) {
  console.log(`[CronScheduler] Triggering perception loop: ${config.perceptionType}`);
  
  const consciousnessLoop = require('./consciousness-loop');
  consciousnessLoop.startLoop('cronPerception', {
    perceptionType: config.perceptionType,
    frequency: frequencyKey,
    timestamp: new Date().toISOString()
  });
  
  // 触发后立即推进到下一个阶段
  // 实际推进由 awareness-agent 处理
}

function triggerEmergencyLoop(emergencyType, data) {
  const config = EMERGENCY_TASKS[emergencyType];
  if (!config) {
    console.error(`[CronScheduler] Unknown emergency type: ${emergencyType}`);
    return;
  }
  
  console.log(`[CronScheduler] Triggering emergency loop: ${config.name}`);
  
  const consciousnessLoop = require('./consciousness-loop');
  
  // 根据紧急类型决定从哪个阶段开始
  let triggerType = 'userInput';
  if (emergencyType === 'executionBlock') {
    triggerType = 'executionBlock';
  }
  
  consciousnessLoop.startLoop(triggerType, {
    emergencyType,
    data,
    priority: config.priority,
    timestamp: new Date().toISOString()
  });
}

// ─────────────────────────────────────────
// 频率控制
// ─────────────────────────────────────────
function enableFrequency(frequencyKey) {
  if (!PERCEPTION_CRON_CONFIG[frequencyKey]) {
    console.error(`[CronScheduler] Unknown frequency: ${frequencyKey}`);
    return;
  }
  
  state = loadState();
  state.currentRates[frequencyKey] = true;
  saveState(state);
  
  if (!jobs[frequencyKey]) {
    startCronJob(frequencyKey, PERCEPTION_CRON_CONFIG[frequencyKey], triggerPerceptionLoop);
  }
  
  console.log(`[CronScheduler] Enabled: ${frequencyKey}`);
}

function disableFrequency(frequencyKey) {
  if (!PERCEPTION_CRON_CONFIG[frequencyKey]) {
    console.error(`[CronScheduler] Unknown frequency: ${frequencyKey}`);
    return;
  }
  
  state = loadState();
  state.currentRates[frequencyKey] = false;
  saveState(state);
  
  stopCronJob(frequencyKey);
  
  console.log(`[CronScheduler] Disabled: ${frequencyKey}`);
}

function changeFrequency(frequencyKey, cronExpr) {
  state = loadState();
  
  // 更新配置
  if (PERCEPTION_CRON_CONFIG[frequencyKey]) {
    PERCEPTION_CRON_CONFIG[frequencyKey].cronExpr = cronExpr;
  }
  
  // 重启任务
  stopCronJob(frequencyKey);
  if (state.currentRates[frequencyKey]) {
    startCronJob(frequencyKey, PERCEPTION_CRON_CONFIG[frequencyKey], triggerPerceptionLoop);
  }
  
  console.log(`[CronScheduler] Changed frequency ${frequencyKey}: ${cronExpr}`);
}

// ─────────────────────────────────────────
// 紧急任务队列
// ─────────────────────────────────────────
function enqueueEmergency(emergencyType, data) {
  const config = EMERGENCY_TASKS[emergencyType];
  if (!config) {
    console.error(`[CronScheduler] Unknown emergency type: ${emergencyType}`);
    return;
  }
  
  state = loadState();
  state.emergencyQueue.push({
    type: emergencyType,
    data,
    priority: config.priority,
    enqueuedAt: new Date().toISOString()
  });
  
  // 按优先级排序
  state.emergencyQueue.sort((a, b) => a.priority - b.priority);
  saveState(state);
  
  console.log(`[CronScheduler] Emergency enqueued: ${config.name}`);
  triggerEmergencyLoop(emergencyType, data);
}

function processEmergencyQueue() {
  state = loadState();
  if (state.emergencyQueue.length === 0) return;
  
  const task = state.emergencyQueue.shift();
  saveState(state);
  
  triggerEmergencyLoop(task.type, task.data);
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, command, arg1, arg2] = process.argv;

if (command === 'start') {
  startAllJobs();
} else if (command === 'stop') {
  stopAllJobs();
} else if (command === 'status') {
  state = loadState();
  console.log(JSON.stringify(state, null, 2));
} else if (command === 'enable') {
  enableFrequency(arg1);
} else if (command === 'disable') {
  disableFrequency(arg1);
} else if (command === 'change') {
  if (!arg1 || !arg2) {
    console.error('Usage: node cron-scheduler.js change <frequencyKey> <cronExpr>');
    process.exit(1);
  }
  changeFrequency(arg1, arg2);
} else if (command === 'emergency') {
  if (!arg1) {
    console.error('Usage: node cron-scheduler.js emergency <type> [data]');
    console.error('Types:', Object.keys(EMERGENCY_TASKS).join(', '));
    process.exit(1);
  }
  enqueueEmergency(arg1, arg2 || {});
} else if (command === 'list') {
  console.log('Perception Cron Config:');
  Object.entries(PERCEPTION_CRON_CONFIG).forEach(([key, config]) => {
    console.log(`  ${key}: ${config.cronExpr} - ${config.description}`);
  });
  console.log('\nEmergency Types:');
  Object.entries(EMERGENCY_TASKS).forEach(([key, config]) => {
    console.log(`  ${key}: P${config.priority} - ${config.description}`);
  });
} else {
  console.log(`
Cron Scheduler

Usage:
  node cron-scheduler.js start                   Start all cron jobs
  node cron-scheduler.js stop                    Stop all cron jobs
  node cron-scheduler.js status                 Show current state
  node cron-scheduler.js enable <frequency>     Enable frequency (high/medium/low)
  node cron-scheduler.js disable <frequency>     Disable frequency
  node cron-scheduler.js change <key> <expr>    Change cron expression
  node cron-scheduler.js emergency <type> [data] Enqueue emergency task
  node cron-scheduler.js list                   List all configs
`);
}

module.exports = {
  startAllJobs,
  stopAllJobs,
  enableFrequency,
  disableFrequency,
  changeFrequency,
  enqueueEmergency,
  triggerPerceptionLoop,
  triggerEmergencyLoop,
  PERCEPTION_CRON_CONFIG,
  EMERGENCY_TASKS
};
