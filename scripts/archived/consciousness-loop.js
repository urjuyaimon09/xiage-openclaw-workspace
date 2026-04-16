#!/usr/bin/env node
/**
 * 意识循环.js - 意识循环总控脚本
 * 
 * 功能：状态机管理 + 循环路由
 * 状态存储：memory/hot/loop-state.json
 * 
 * 用法：
 *   node 意识循环.js 触发 <类型> <数据>     触发新循环
 *   node 意识循环.js 状态                   查看当前状态
 *   node 意识循环.js 下一                   推进到下一阶段
 *   node 意识循环.js 跳转 <阶段>           跳转到指定阶段
 *   node 意识循环.js 恢复                   从断点恢复
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const 循环状态文件 = path.join(WORKSPACE, 'memory', 'hot', 'loop-state.json');
const 内隐记忆文件 = path.join(WORKSPACE, 'config', 'implicit-memory.json');

// 意识循环阶段
const 阶段 = {
  感知: 1,
  需求: 2,
  承接: 3,
  计划: 4,
  执行: 5,
  反馈: 6
};

const 阶段名称 = {
  1: '感知',
  2: '需求',
  3: '承接',
  4: '计划',
  5: '执行',
  6: '反馈'
};

// 触发类型 → 起始阶段
const 触发起始阶段 = {
  用户输入: 1,
  定时感知: 1,
  执行卡住: 5,
  需求变化: 2
};

// ─────────────────────────────────────────
// 状态读写
// ─────────────────────────────────────────
function 加载状态() {
  if (fs.existsSync(循环状态文件)) {
    return JSON.parse(fs.readFileSync(循环状态文件, 'utf8'));
  }
  return {
    运行中: false,
    当前阶段: 0,
    触发类型: null,
    目标: null,
    阶段输出: {},
    循环ID: null,
    开始时间: null
  };
}

function 保存状态(状态) {
  const 目录 = path.dirname(循环状态文件);
  if (!fs.existsSync(目录)) {
    fs.mkdirSync(目录, { recursive: true });
  }
  fs.writeFileSync(循环状态文件, JSON.stringify(状态, null, 2), 'utf8');
}

function 清理状态() {
  if (fs.existsSync(循环状态文件)) {
    fs.unlinkSync(循环状态文件);
  }
}

// ─────────────────────────────────────────
// 循环控制
// ─────────────────────────────────────────
function 启动循环(触发类型, 目标数据) {
  const 起始阶段 = 触发起始阶段[触发类型] || 1;
  const 状态 = {
    运行中: true,
    当前阶段: 起始阶段,
    触发类型,
    目标: 目标数据,
    阶段输出: {},
    循环ID: 生成循环ID(),
    开始时间: new Date().toISOString()
  };
  保存状态(状态);
  console.log(`[循环 ${状态.循环ID}] 启动: 触发=${触发类型}, 起始阶段=${阶段名称[起始阶段]}`);
  return 状态;
}

function 推进阶段() {
  const 状态 = 加载状态();
  if (!状态.运行中) {
    console.log('[循环] 无运行中的循环');
    return null;
  }
  
  const 下一阶段 = 状态.当前阶段 + 1;
  if (下一阶段 > 6) {
    console.log(`[循环 ${状态.循环ID}] 完成`);
    清理状态();
    return { 完成: true };
  }
  
  状态.当前阶段 = 下一阶段;
  保存状态(状态);
  console.log(`[循环 ${状态.循环ID}] 推进到阶段 ${下一阶段}: ${阶段名称[下一阶段]}`);
  return 状态;
}

function 保存阶段输出(阶段编号, 输出) {
  const 状态 = 加载状态();
  状态.阶段输出[阶段名称[阶段编号]] = 输出;
  保存状态(状态);
}

function 获取阶段输出(阶段编号) {
  const 状态 = 加载状态();
  return 状态.阶段输出[阶段名称[阶段编号]] || null;
}

// ─────────────────────────────────────────
// 快速恢复通道（断点跳转）
// ─────────────────────────────────────────
function 跳转阶段(目标阶段) {
  const 状态 = 加载状态();
  if (!状态.运行中) {
    console.log('[循环] 无运行中的循环');
    return null;
  }
  
  if (目标阶段 < 1 || 目标阶段 > 6) {
    console.log(`[循环] 无效阶段: ${目标阶段}`);
    return null;
  }
  
  console.log(`[循环 ${状态.循环ID}] 跳转到阶段 ${目标阶段}: ${阶段名称[目标阶段]}`);
  状态.当前阶段 = 目标阶段;
  保存状态(状态);
  return 状态;
}

function 自动恢复() {
  const 状态 = 加载状态();
  if (!状态.运行中) {
    console.log('[循环] 无运行中的循环');
    return null;
  }
  
  const 触发类型 = 状态.触发类型;
  let 目标阶段;
  
  if (触发类型 === '执行卡住') {
    const 执行输出 = 状态.阶段输出['执行'];
    if (执行输出?.执行结果?.卡住信息) {
      目标阶段 = 5;
      console.log(`[循环 ${状态.循环ID}] 自动恢复: 检测到执行卡住，从执行阶段继续`);
    } else {
      目标阶段 = 5;
      console.log(`[循环 ${状态.循环ID}] 自动恢复: 无卡住信息，从执行阶段开始`);
    }
  } else if (触发类型 === '需求变化') {
    目标阶段 = 3;
    console.log(`[循环 ${状态.循环ID}] 自动恢复: 需求变化，从承接阶段继续`);
  } else {
    目标阶段 = 状态.当前阶段;
    console.log(`[循环 ${状态.循环ID}] 自动恢复: 继续当前阶段 ${目标阶段}`);
  }
  
  状态.当前阶段 = 目标阶段;
  保存状态(状态);
  return 状态;
}

// ─────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────
function 生成循环ID() {
  const now = new Date();
  return `loop-${now.toISOString().slice(0, 13).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
}

function 加载内隐记忆() {
  if (fs.existsSync(内隐记忆文件)) {
    return JSON.parse(fs.readFileSync(内隐记忆文件, 'utf8'));
  }
  return null;
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, 命令, 参数1, 参数2] = process.argv;

if (命令 === '触发') {
  const 触发类型 = 参数1;
  const 目标数据 = 参数2 || '{}';
  try {
    const obj = JSON.parse(目标数据);
    启动循环(触发类型, obj);
  } catch (e) {
    console.error('无效的目标JSON:', e.message);
    process.exit(1);
  }
} else if (命令 === '状态') {
  const 状态 = 加载状态();
  console.log(JSON.stringify(状态, null, 2));
} else if (命令 === '下一') {
  const 结果 = 推进阶段();
  if (结果 && 结果.完成) {
    console.log('循环完成');
  }
} else if (命令 === '保存') {
  const [阶段编号, 输出] = [参数1, 参数2];
  if (!阶段编号 || !输出) {
    console.error('用法: node 意识循环.js 保存 <阶段> <输出JSON>');
    process.exit(1);
  }
  try {
    const 解析 = JSON.parse(输出);
    保存阶段输出(parseInt(阶段编号), 解析);
    console.log(`阶段 ${阶段编号} 输出已保存`);
  } catch (e) {
    console.error('无效的输出JSON:', e.message);
    process.exit(1);
  }
} else if (命令 === '获取') {
  const 阶段编号 = parseInt(参数1);
  if (!阶段编号) {
    console.error('用法: node 意识循环.js 获取 <阶段编号>');
    process.exit(1);
  }
  const 输出 = 获取阶段输出(阶段编号);
  console.log(JSON.stringify(输出, null, 2));
} else if (命令 === '跳转') {
  const 阶段编号 = parseInt(参数1);
  if (!阶段编号) {
    console.error('用法: node 意识循环.js 跳转 <阶段编号>');
    process.exit(1);
  }
  跳转阶段(阶段编号);
} else if (命令 === '恢复') {
  自动恢复();
} else if (命令 === '清理') {
  清理状态();
  console.log('循环状态已清理');
} else if (命令 === '内隐记忆') {
  const 记忆 = 加载内隐记忆();
  console.log(JSON.stringify(记忆, null, 2));
} else {
  console.log(`
意识循环控制器

用法:
  node 意识循环.js 触发 <类型> <目标JSON>   启动新循环
  node 意识循环.js 状态                      显示当前状态
  node 意识循环.js 下一                     推进到下一阶段
  node 意识循环.js 跳转 <阶段>             跳转到指定阶段
  node 意识循环.js 恢复                     自动恢复（断点续执）
  node 意识循环.js 保存 <阶段> <输出JSON> 保存阶段输出
  node 意识循环.js 获取 <阶段编号>          获取阶段输出
  node 意识循环.js 清理                    清理循环状态
  node 意识循环.js 内隐记忆                 加载内隐记忆

触发类型:
  用户输入    - 用户输入 → 从感知开始(1)
  定时感知   - Cron触发 → 从感知开始(1)
  执行卡住   - 执行卡住 → 从执行恢复(5)
  需求变化   - 需求变化 → 从承接开始(3)

阶段:
  1: 感知
  2: 需求
  3: 承接
  4: 计划
  5: 执行
  6: 反馈
`);
}

module.exports = {
  启动循环,
  推进阶段,
  保存阶段输出,
  获取阶段输出,
  跳转阶段,
  自动恢复,
  加载状态,
  阶段,
  阶段名称
};
