#!/usr/bin/env node
/**
 * Cron调度器.js - Cron调度器
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
const 状态文件 = path.join(WORKSPACE, 'memory', 'hot', 'cron-scheduler-state.json');

// 感知频率配置
const 感知调度配置 = {
  高频繁: {
    名称: 'high-frequency',
    cron表达式: '0 * * * *',
    感知类型: '系统坚果状态',
    描述: '系统健康 + 坚果状态'
  },
  中频繁: {
    名称: 'medium-frequency',
    cron表达式: '0 9 * * *',
    感知类型: 'AI趋势行业动态',
    描述: 'AI趋势 + 行业动态'
  },
  低频繁: {
    名称: 'low-frequency',
    cron表达式: '0 10 * * 1',
    感知类型: '社会脉络长期风险',
    描述: '社会脉络 + 长期风险'
  }
};

// 紧急任务配置
const 紧急任务配置 = {
  系统危急: {
    名称: 'system-critical',
    优先级: 1,
    描述: '系统崩溃/数据泄露等生死事件'
  },
  紧急需求: {
    名称: 'urgent-demand',
    优先级: 2,
    描述: '坚果紧急需求'
  },
  执行卡住: {
    名称: 'execution-block',
    优先级: 3,
    描述: '执行卡住需要恢复'
  }
};

// ─────────────────────────────────────────
// 状态管理
// ─────────────────────────────────────────
function 加载状态() {
  if (fs.existsSync(状态文件)) {
    return JSON.parse(fs.readFileSync(状态文件, 'utf8'));
  }
  return {
    运行中: false,
    任务列表: {},
    紧急队列: [],
    当前频率: { 高频繁: true, 中频繁: true, 低频繁: true }
  };
}

function 保存状态(状态) {
  const 目录 = path.dirname(状态文件);
  if (!fs.existsSync(目录)) {
    fs.mkdirSync(目录, { recursive: true });
  }
  fs.writeFileSync(状态文件, JSON.stringify(状态, null, 2), 'utf8');
}

// ─────────────────────────────────────────
// Cron任务管理
// ─────────────────────────────────────────
const 任务集合 = {};
let 状态 = null;

function 启动Cron任务(键, 配置, 触发回调) {
  const 间隔毫秒 = cron表达式转毫秒(配置.cron表达式);
  
  const 任务 = setInterval(() => {
    console.log(`[Cron调度器] ${键} tick: ${配置.描述}`);
    触发回调(键, 配置);
  }, 间隔毫秒);
  
  任务集合[键] = { 间隔: 任务, 配置 };
  console.log(`[Cron调度器] 启动: ${键} (${配置.cron表达式} = ${间隔毫秒}ms) - ${配置.描述}`);
  return 任务;
}

function cron表达式转毫秒(cron表达式) {
  const parts = cron表达式.split(' ');
  if (parts.length !== 5) return 3600000;
  
  const [分钟, 小时, , , 周几] = parts;
  
  if (分钟 === '0' && 小时 === '*' && 周几 === '*') {
    return 60 * 60 * 1000;
  }
  
  if (分钟 === '0' && 小时 === '9') {
    return 24 * 60 * 60 * 1000;
  }
  
  if (分钟 === '0' && 小时 === '10' && 周几 === '1') {
    return 7 * 24 * 60 * 60 * 1000;
  }
  
  return 3600000;
}

function 停止Cron任务(键) {
  if (任务集合[键]) {
    clearInterval(任务集合[键].间隔);
    delete 任务集合[键];
    console.log(`[Cron调度器] 停止: ${键}`);
  }
}

function 启动全部任务() {
  状态 = 加载状态();
  状态.运行中 = true;
  保存状态(状态);
  
  if (状态.当前频率.高频繁) {
    启动Cron任务('高频繁', 感知调度配置.高频繁, 触发感知循环);
  }
  if (状态.当前频率.中频繁) {
    启动Cron任务('中频繁', 感知调度配置.中频繁, 触发感知循环);
  }
  if (状态.当前频率.低频繁) {
    启动Cron任务('低频繁', 感知调度配置.低频繁, 触发感知循环);
  }
}

function 停止全部任务() {
  Object.keys(任务集合).forEach(键 => 停止Cron任务(键));
  状态 = 加载状态();
  状态.运行中 = false;
  保存状态(状态);
}

// ─────────────────────────────────────────
// 触发意识循环
// ─────────────────────────────────────────
function 触发感知循环(频率键, 配置) {
  console.log(`[Cron调度器] 触发感知循环: ${配置.感知类型}`);
  
  // 1. 先采集状态
  const 状态采集器 = require('./状态采集器');
  const 指标 = 状态采集器.完整采集();
  console.log(`[Cron调度器] 状态采集: 上下文${(指标.上下文连续性*100).toFixed(0)}% 规则${(指标.规则稳定性*100).toFixed(0)}%`);
  
  // 2. 检查是否需要启动思维模式
  const 思维引擎 = require('./思维模式引擎');
  const 需要思考 = 思维引擎.判断是否需要思考(思维引擎.加载驱动器状态());
  
  if (需要思考) {
    console.log(`[Cron调度器] 驱动强度足够，启动思维模式`);
    // 启动思维模式（写入状态，由主会话下次空闲时执行）
    const 意识循环 = require('./consciousness-loop');
    意识循环.启动循环('定时感知', {
      感知类型: 配置.感知类型,
      频率: 频率键,
      时间戳: new Date().toISOString(),
      触发思维: true
    });
  } else {
    console.log(`[Cron调度器] 驱动强度不足，仅记录感知`);
    // 仅添加环境感知，不触发思维模式
    状态采集器.添加环境感知(`[${配置.感知类型}] 状态采集完成`);
  }
}

function 触发紧急循环(紧急类型, 数据) {
  const 配置 = 紧急任务配置[紧急类型];
  if (!配置) {
    console.error(`[Cron调度器] 未知紧急类型: ${紧急类型}`);
    return;
  }
  
  console.log(`[Cron调度器] 触发紧急循环: ${配置.名称}`);
  
  const 意识循环 = require('./consciousness-loop');
  let 触发类型 = '用户输入';
  if (紧急类型 === '执行卡住') {
    触发类型 = '执行卡住';
  }
  
  意识循环.启动循环(触发类型, {
    紧急类型,
    数据,
    优先级: 配置.优先级,
    时间戳: new Date().toISOString()
  });
}

// ─────────────────────────────────────────
// 频率控制
// ─────────────────────────────────────────
function 启用频率(频率键) {
  if (!感知调度配置[频率键]) {
    console.error(`[Cron调度器] 未知频率: ${频率键}`);
    return;
  }
  
  状态 = 加载状态();
  状态.当前频率[频率键] = true;
  保存状态(状态);
  
  if (!任务集合[频率键]) {
    启动Cron任务(频率键, 感知调度配置[频率键], 触发感知循环);
  }
  
  console.log(`[Cron调度器] 已启用: ${频率键}`);
}

function 禁用频率(频率键) {
  if (!感知调度配置[频率键]) {
    console.error(`[Cron调度器] 未知频率: ${频率键}`);
    return;
  }
  
  状态 = 加载状态();
  状态.当前频率[频率键] = false;
  保存状态(状态);
  
  停止Cron任务(频率键);
  
  console.log(`[Cron调度器] 已禁用: ${频率键}`);
}

function 修改频率(频率键, cron表达式) {
  状态 = 加载状态();
  
  if (感知调度配置[频率键]) {
    感知调度配置[频率键].cron表达式 = cron表达式;
  }
  
  停止Cron任务(频率键);
  if (状态.当前频率[频率键]) {
    启动Cron任务(频率键, 感知调度配置[频率键], 触发感知循环);
  }
  
  console.log(`[Cron调度器] 已修改频率 ${频率键}: ${cron表达式}`);
}

// ─────────────────────────────────────────
// 紧急任务队列
// ─────────────────────────────────────────
function 加入紧急队列(紧急类型, 数据) {
  const 配置 = 紧急任务配置[紧急类型];
  if (!配置) {
    console.error(`[Cron调度器] 未知紧急类型: ${紧急类型}`);
    return;
  }
  
  状态 = 加载状态();
  状态.紧急队列.push({
    类型: 紧急类型,
    数据,
    优先级: 配置.优先级,
    入队时间: new Date().toISOString()
  });
  
  状态.紧急队列.sort((a, b) => a.优先级 - b.优先级);
  保存状态(状态);
  
  console.log(`[Cron调度器] 紧急任务已入队: ${配置.名称}`);
  触发紧急循环(紧急类型, 数据);
}

function 处理紧急队列() {
  状态 = 加载状态();
  if (状态.紧急队列.length === 0) return;
  
  const 任务 = 状态.紧急队列.shift();
  保存状态(状态);
  
  触发紧急循环(任务.类型, 任务.数据);
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, 命令, 参数1, 参数2] = process.argv;

if (命令 === '启动') {
  启动全部任务();
} else if (命令 === '停止') {
  停止全部任务();
} else if (命令 === '状态') {
  状态 = 加载状态();
  console.log(JSON.stringify(状态, null, 2));
} else if (命令 === '启用') {
  启用频率(参数1);
} else if (命令 === '禁用') {
  禁用频率(参数1);
} else if (命令 === '修改') {
  if (!参数1 || !参数2) {
    console.error('用法: node Cron调度器.js 修改 <频率键> <cron表达式>');
    process.exit(1);
  }
  修改频率(参数1, 参数2);
} else if (命令 === '紧急') {
  if (!参数1) {
    console.error('用法: node Cron调度器.js 紧急 <类型> [数据]');
    console.error('类型:', Object.keys(紧急任务配置).join(', '));
    process.exit(1);
  }
  加入紧急队列(参数1, 参数2 || {});
} else if (命令 === '列表') {
  console.log('感知调度配置:');
  Object.entries(感知调度配置).forEach(([键, 配置]) => {
    console.log(`  ${键}: ${配置.cron表达式} - ${配置.描述}`);
  });
  console.log('\n紧急任务类型:');
  Object.entries(紧急任务配置).forEach(([键, 配置]) => {
    console.log(`  ${键}: P${配置.优先级} - ${配置.描述}`);
  });
} else {
  console.log(`
Cron调度器

用法:
  node Cron调度器.js 启动                启动所有Cron任务
  node Cron调度器.js 停止               停止所有Cron任务
  node Cron调度器.js 状态              显示当前状态
  node Cron调度器.js 启用 <频率>       启用频率 (高频繁/中频繁/低频繁)
  node Cron调度器.js 禁用 <频率>       禁用频率
  node Cron调度器.js 修改 <键> <表达式> 修改cron表达式
  node Cron调度器.js 紧急 <类型> [数据] 入队紧急任务
  node Cron调度器.js 列表              列出所有配置

频率键: 高频繁, 中频繁, 低频繁
紧急类型: 系统危急, 紧急需求, 执行卡住
`);
}

module.exports = {
  启动全部任务,
  停止全部任务,
  启用频率,
  禁用频率,
  修改频率,
  加入紧急队列,
  触发感知循环,
  触发紧急循环,
  感知调度配置,
  紧急任务配置
};
