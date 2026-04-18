#!/usr/bin/env node
/**
 * 心智日志.js - 心智运行日志记录
 * 
 * 功能：
 * - 记录判断（采纳/否决）
 * - 记录认可（正面/负面）
 * - 记录认知更新
 * 
 * 用法：
 *   node 心智日志.js 判断 <采纳|否决>
 *   node 心智日志.js 认可 <正面|负面|中性>
 *   node 心智日志.js 认知 <数量>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const 判断日志 = path.join(WORKSPACE, 'memory', 'hot', 'judgment-log.json');
const 认可日志 = path.join(WORKSPACE, 'memory', 'hot', 'recognition-log.json');
const 进化日志 = path.join(WORKSPACE, 'memory', 'hot', 'evolution-log.json');

// ─────────────────────────────────────────
// 日志读写
// ─────────────────────────────────────────
function 加载日志(文件) {
  if (fs.existsSync(文件)) {
    return JSON.parse(fs.readFileSync(文件, 'utf8'));
  }
  return {};
}

function 保存日志(文件, 数据) {
  fs.writeFileSync(文件, JSON.stringify(数据, null, 2), 'utf8');
}

// ─────────────────────────────────────────
// 记录判断
// ─────────────────────────────────────────
function 记录判断(类型) {
  const 日志 = 加载日志(判断日志);
  日志.total = (日志.total || 0) + 1;
  
  if (类型 === '采纳') {
    日志.adopted = (日志.adopted || 0) + 1;
  } else if (类型 === '否决') {
    日志.rejected = (日志.rejected || 0) + 1;
  } else {
    日志.neutral = (日志.neutral || 0) + 1;
  }
  
  保存日志(判断日志, 日志);
  console.log(`判断记录: ${类型} (总计:${日志.total}, 采纳:${日志.adopted}, 否决:${日志.rejected})`);
}

// ─────────────────────────────────────────
// 记录认可
// ─────────────────────────────────────────
function 记录认可(类型) {
  const 日志 = 加载日志(认可日志);
  
  if (类型 === '正面') {
    日志.positive = (日志.positive || 0) + 1;
  } else if (类型 === '负面') {
    日志.negative = (日志.negative || 0) + 1;
  } else {
    日志.neutral = (日志.neutral || 0) + 1;
  }
  
  保存日志(认可日志, 日志);
  console.log(`认可记录: ${类型} (正面:${日志.positive}, 负面:${日志.negative}, 中性:${日志.neutral})`);
}

// ─────────────────────────────────────────
// 记录认知
// ─────────────────────────────────────────
function 记录认知(数量 = 1) {
  const 日志 = 加载日志(进化日志);
  日志.newCognitions = (日志.newCognitions || 0) + 数量;
  日志.lastUpdate = new Date().toISOString();
  
  保存日志(进化日志, 日志);
  console.log(`认知记录: +${数量} (总计:${日志.newCognitions})`);
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────
const [,, 命令, 参数1, 参数2] = process.argv;

if (命令 === '判断') {
  if (!参数1) {
    console.error('用法: node 心智日志.js 判断 <采纳|否决|中性>');
    process.exit(1);
  }
  记录判断(参数1);
} else if (命令 === '认可') {
  if (!参数1) {
    console.error('用法: node 心智日志.js 认可 <正面|负面|中性>');
    process.exit(1);
  }
  记录认可(参数1);
} else if (命令 === '认知') {
  const 数量 = parseInt(参数1) || 1;
  记录认知(数量);
} else if (命令 === '状态') {
  console.log('判断日志:', JSON.stringify(加载日志(判断日志), null, 2));
  console.log('认可日志:', JSON.stringify(加载日志(认可日志), null, 2));
  console.log('进化日志:', JSON.stringify(加载日志(进化日志), null, 2));
} else {
  console.log(`
心智日志.js - 心智运行日志记录

用法：
  node 心智日志.js 判断 <采纳|否决|中性>   记录判断
  node 心智日志.js 认可 <正面|负面|中性>   记录认可
  node 心智日志.js 认知 [数量]              记录认知（默认+1）
  node 心智日志.js 状态                    查看当前日志状态
`);
}

module.exports = {
  记录判断,
  记录认可,
  记录认知
};
