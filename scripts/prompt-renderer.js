#!/usr/bin/env node
/**
 * Prompt渲染器.js - Prompt模板渲染器
 * 
 * 功能：模板 + 上下文 → 完整Prompt字符串
 * 模板位置：prompts/<模型>-prompt.md
 * 
 * 用法：
 *   node Prompt渲染器.js 渲染 <模型> <上下文JSON>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const 模板目录 = path.join(WORKSPACE, 'prompts');
const 内隐记忆文件 = path.join(WORKSPACE, 'config', 'implicit-memory.json');
const 循环状态文件 = path.join(WORKSPACE, 'memory', 'hot', 'loop-state.json');
const 热记忆文件 = path.join(WORKSPACE, 'memory', 'hot', 'current.md');

// ─────────────────────────────────────────
// 模型记忆读写权限（三层记忆按需加载）
// ─────────────────────────────────────────
const 模型读权限 = {
  感知: ['感知日志', '重大事件', '最近记忆'],
  需求: ['需求池', '目标状态', '最近记忆'],
  承接: ['能力边界', '承接历史', '最近记忆'],
  计划: ['计划模板', '里程碑历史', '长时记忆'],
  执行: ['执行状态', '内隐记忆'],
  反馈: ['全部']
};

function 可读记忆(模型, 记忆类型) {
  const 允许列表 = 模型读权限[模型] || [];
  return 允许列表.includes('全部') || 允许列表.includes(记忆类型);
}

// ─────────────────────────────────────────
// 记忆加载
// ─────────────────────────────────────────
function 加载内隐记忆() {
  if (fs.existsSync(内隐记忆文件)) {
    return JSON.parse(fs.readFileSync(内隐记忆文件, 'utf8'));
  }
  return null;
}

function 加载循环状态() {
  if (fs.existsSync(循环状态文件)) {
    return JSON.parse(fs.readFileSync(循环状态文件, 'utf8'));
  }
  return null;
}

function 加载最近记忆(限制 = 5) {
  if (!fs.existsSync(热记忆文件)) {
    return [];
  }
  const 内容 = fs.readFileSync(热记忆文件, 'utf8');
  const 行列表 = 内容.split('\n').filter(l => l.startsWith('- '));
  return 行列表.slice(-限制);
}

function 加载长时记忆(场景, 限制 = 3) {
  const 记忆目录 = path.join(WORKSPACE, 'memory');
  if (!fs.existsSync(记忆目录)) return [];
  
  const 记忆文件 = fs.readdirSync(记忆目录).filter(f => f.endsWith('.md'));
  const 最近 = 记忆文件.slice(-限制);
  return 最近.map(f => {
    const 内容 = fs.readFileSync(path.join(记忆目录, f), 'utf8');
    return { 文件: f, 预览: 内容.slice(0, 200) };
  });
}

// ─────────────────────────────────────────
// 模板渲染
// ─────────────────────────────────────────
function 加载模板(模型) {
  const 模板路径 = path.join(模板目录, `${模型}-prompt.md`);
  if (!fs.existsSync(模板路径)) {
    return null;
  }
  return fs.readFileSync(模板路径, 'utf8');
}

function 替换变量(模板, 上下文) {
  return 模板.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (匹配, 键) => {
    const 键列表 = 键.split('.');
    let 值 = 上下文;
    for (const k of 键列表) {
      值 = 值?.[k];
    }
    return 值 !== undefined ? String(值) : 匹配;
  });
}

function 渲染Prompt(模型, 上下文) {
  const 模板 = 加载模板(模型);
  if (!模板) {
    throw new Error(`模板不存在: ${模型}`);
  }
  
  // 按权限加载记忆
  const 内隐记忆 = 可读记忆(模型, '内隐记忆') ? 加载内隐记忆() : null;
  const 循环状态 = 加载循环状态();
  const 最近记忆 = 可读记忆(模型, '最近记忆') ? 加载最近记忆(上下文.最近记忆限制 || 5) : [];
  const 长时记忆 = 可读记忆(模型, '长时记忆') ? 加载长时记忆(上下文.场景, 上下文.长时记忆限制 || 3) : [];
  
  const 完整上下文 = {
    ...上下文,
    内隐记忆,
    循环状态,
    最近记忆,
    长时记忆,
    渲染时间: new Date().toISOString()
  };
  
  // 渲染
  let 结果 = 替换变量(模板, 完整上下文);
  
  // 处理条件区块：{{#if 条件}}...{{/if}}
  结果 = 结果.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (匹配, 键, 内容) => {
    const 键列表 = 键.split('.');
    let 值 = 完整上下文;
    for (const k of 键列表) {
      值 = 值?.[k];
    }
    return 值 ? 内容 : '';
  });
  
  return 结果;
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, 命令, 参数1, 参数2] = process.argv;

if (命令 === '渲染') {
  const 模型 = 参数1;
  const 上下文JSON = 参数2 || '{}';
  
  try {
    const 上下文 = JSON.parse(上下文JSON);
    const 结果 = 渲染Prompt(模型, 上下文);
    console.log(结果);
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
} else if (命令 === '列表') {
  if (!fs.existsSync(模板目录)) {
    console.log('无模板目录');
    return;
  }
  const 文件列表 = fs.readdirSync(模板目录).filter(f => f.endsWith('-prompt.md'));
  console.log('可用模板:');
  文件列表.forEach(f => console.log(`  - ${f.replace('-prompt.md', '')}`));
} else {
  console.log(`
Prompt渲染器

用法:
  node Prompt渲染器.js 渲染 <模型> <上下文JSON>
  node Prompt渲染器.js 列表

示例:
  node Prompt渲染器.js 渲染 感知 '{"原始数据": "用户输入"}'
  node Prompt渲染器.js 列表
`);
}

module.exports = { 渲染Prompt, 加载模板, 模型读权限, 可读记忆 };
