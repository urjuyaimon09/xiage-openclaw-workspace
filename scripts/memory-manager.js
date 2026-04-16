#!/usr/bin/env node
/**
 * 记忆模块.js - 记忆管理模块
 * 
 * 职责：
 * - 全类型记忆存储/读取/更新/遗忘
 * - 三层记忆读写规则执行
 * - 遗忘机制（30天衰减/内隐记忆固化）
 * 
 * 用法：
 *   node 记忆模块.js 读 <类型> [场景]
 *   node 记忆模块.js 写 <类型> <内容>
 *   node 记忆模块.js 遗忘 [dry-run]
 *   node 记忆模块.js 固化 <模式ID>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const 记忆目录 = path.join(WORKSPACE, 'memory');
const 热记忆目录 = path.join(记忆目录, 'hot');
const 长时记忆目录 = path.join(记忆目录, 'longterm');
const 内隐配置 = path.join(WORKSPACE, 'config', 'implicit-memory.json');

const 遗忘天数阈值 = 30;
const 遗忘权重阈值 = 0.1;

// ─────────────────────────────────────────
// 三层记忆读写权限
// ─────────────────────────────────────────
const 模型读权限 = {
  感知: ['感知日志', '重大事件'],
  需求: ['需求池', '目标状态'],
  承接: ['能力边界', '承接历史'],
  计划: ['计划模板', '里程碑历史'],
  执行: ['执行状态'],
  反馈: ['全部']
};

const 模型写权限 = {
  感知: [],
  需求: ['需求池'],
  承接: [],
  计划: [],
  执行: ['执行状态'],
  反馈: ['长时记忆', '内隐记忆', '当前状态']
};

// ─────────────────────────────────────────
// 短时工作记忆（内存缓存）
// ─────────────────────────────────────────
let 短时缓存 = null;

function 写短时(键, 值) {
  短时缓存 = 短时缓存 || {};
  短时缓存[键] = {
    值,
    时间戳: Date.now()
  };
}

function 读短时(键) {
  if (!短时缓存) return null;
  return 短时缓存[键]?.值 || null;
}

function 清空短时() {
  短时缓存 = null;
}

// ─────────────────────────────────────────
// 长时显性记忆
// ─────────────────────────────────────────
function 确保长时目录() {
  if (!fs.existsSync(长时记忆目录)) {
    fs.mkdirSync(长时记忆目录, { recursive: true });
  }
}

function 写长时(场景, 内容, 元数据 = {}) {
  确保长时目录();
  const id = `lt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const 记录 = {
    id,
    场景,
    内容,
    元数据,
    权重: 1.0,
    创建时间: new Date().toISOString(),
    最后访问: new Date().toISOString(),
    访问次数: 0
  };
  const 文件路径 = path.join(长时记忆目录, `${id}.json`);
  fs.writeFileSync(文件路径, JSON.stringify(记录, null, 2), 'utf8');
  return id;
}

function 读长时(场景, 限制 = 10) {
  确保长时目录();
  if (!fs.existsSync(长时记忆目录)) return [];
  
  const 文件列表 = fs.readdirSync(长时记忆目录).filter(f => f.endsWith('.json'));
  const 记录列表 = 文件列表.map(f => {
    const 内容 = fs.readFileSync(path.join(长时记忆目录, f), 'utf8');
    return JSON.parse(内容);
  });
  
  // 按场景过滤 + 按权重/时间排序
  const 过滤 = 记录列表
    .filter(r => !场景 || r.场景 === 场景)
    .sort((a, b) => b.权重 - a.权重 || new Date(b.最后访问) - new Date(a.最后访问));
  
  // 更新访问记录
  过滤.slice(0, 限制).forEach(r => {
    r.访问次数++;
    r.最后访问 = new Date().toISOString();
    fs.writeFileSync(path.join(长时记忆目录, `${r.id}.json`), JSON.stringify(r, null, 2), 'utf8');
  });
  
  return 过滤.slice(0, 限制);
}

function 检索长时(查询, 限制 = 5) {
  确保长时目录();
  if (!fs.existsSync(长时记忆目录)) return [];
  
  const 文件列表 = fs.readdirSync(长时记忆目录).filter(f => f.endsWith('.json'));
  const 记录列表 = 文件列表.map(f => {
    const 内容 = fs.readFileSync(path.join(长时记忆目录, f), 'utf8');
    return JSON.parse(内容);
  });
  
  const 关键词 = 查询.toLowerCase().split(/\s+/);
  const 评分列表 = 记录列表.map(r => {
    const 文本 = (r.场景 + ' ' + r.内容).toLowerCase();
    const 得分 = 关键词.filter(k => 文本.includes(k)).length;
    return { ...r, 检索得分: 得分 };
  });
  
  return 评分列表
    .filter(r => r.检索得分 > 0)
    .sort((a, b) => b.检索得分 - a.检索得分)
    .slice(0, 限制);
}

// ─────────────────────────────────────────
// 内隐潜意识记忆
// ─────────────────────────────────────────
function 加载内隐记忆() {
  if (fs.existsSync(内隐配置)) {
    return JSON.parse(fs.readFileSync(内隐配置, 'utf8'));
  }
  return { 行为模式: { 自动执行: [], 习惯循环: [] }, 自动化规则: { 规则: [] } };
}

function 写内隐记忆(数据) {
  fs.writeFileSync(内隐配置, JSON.stringify(数据, null, 2), 'utf8');
}

function 固化模式(模式ID, 执行次数) {
  const 记忆 = 加载内隐记忆();
  const 阈值 = 记忆.遗忘策略?.模式最小执行次数 || 3;
  
  if (执行次数 >= 阈值) {
    if (!记忆.行为模式.习惯循环.find(p => p.id === 模式ID)) {
      记忆.行为模式.习惯循环.push({
        id: 模式ID,
        固化时间: new Date().toISOString(),
        执行次数
      });
      写内隐记忆(记忆);
      console.log(`[记忆] 模式 ${模式ID} 已固化（执行次数: ${执行次数}）`);
    }
  }
}

function 移除内隐模式(模式ID) {
  const 记忆 = 加载内隐记忆();
  记忆.行为模式.习惯循环 = 记忆.行为模式.习惯循环.filter(p => p.id !== 模式ID);
  写内隐记忆(记忆);
  console.log(`[记忆] 模式 ${模式ID} 已从内隐记忆移除`);
}

// ─────────────────────────────────────────
// 遗忘机制
// ─────────────────────────────────────────
function 衰减长时(天数阈值 = 遗忘天数阈值, 权重阈值 = 遗忘权重阈值) {
  确保长时目录();
  if (!fs.existsSync(长时记忆目录)) return { 衰减: 0, 移除: 0 };
  
  const 文件列表 = fs.readdirSync(长时记忆目录).filter(f => f.endsWith('.json'));
  let 衰减数 = 0;
  let 移除数 = 0;
  const 现在 = Date.now();
  const 每天毫秒 = 24 * 60 * 60 * 1000;
  
  文件列表.forEach(f => {
    const 文件路径 = path.join(长时记忆目录, f);
    const 记录 = JSON.parse(fs.readFileSync(文件路径, 'utf8'));
    
    const 自上次访问天数 = (现在 - new Date(记录.最后访问).getTime()) / 每天毫秒;
    
    if (自上次访问天数 > 天数阈值) {
      记录.权重 = Math.max(0, 记录.权重 - 0.1);
      fs.writeFileSync(文件路径, JSON.stringify(记录, null, 2), 'utf8');
      衰减数++;
      
      if (记录.权重 <= 权重阈值) {
        fs.unlinkSync(文件路径);
        移除数++;
      }
    }
  });
  
  return { 衰减: 衰减数, 移除: 移除数 };
}

function 遗忘内隐(天数阈值 = 90) {
  const 记忆 = 加载内隐记忆();
  const 现在 = Date.now();
  const 每天毫秒 = 24 * 60 * 60 * 1000;
  
  const 操作前 = 记忆.行为模式.习惯循环.length;
  记忆.行为模式.习惯循环 = 记忆.行为模式.习惯循环.filter(p => {
    const 自固化天数 = (现在 - new Date(p.固化时间).getTime()) / 每天毫秒;
    return 自固化天数 <= 天数阈值;
  });
  
  const 移除数 = 操作前 - 记忆.行为模式.习惯循环.length;
  if (移除数 > 0) {
    写内隐记忆(记忆);
  }
  
  return { 移除: 移除数 };
}

function 运行遗忘机制(干运行 = false) {
  console.log('[记忆] 运行遗忘机制...');
  const 长时结果 = 干运行 ? { 衰减: 0, 移除: 0 } : 衰减长时();
  const 内隐结果 = 干运行 ? { 移除: 0 } : 遗忘内隐();
  console.log(`[记忆] 长时记忆衰减: ${长时结果.衰减}, 移除: ${长时结果.移除}`);
  console.log(`[记忆] 内隐记忆移除: ${内隐结果.移除}`);
  return { ...长时结果, ...内隐结果 };
}

// ─────────────────────────────────────────
// 模型读写权限检查
// ─────────────────────────────────────────
function 可读(模型, 记忆类型) {
  const 允许列表 = 模型读权限[模型] || [];
  return 允许列表.includes('全部') || 允许列表.includes(记忆类型);
}

function 可写(模型, 记忆类型) {
  const 允许列表 = 模型写权限[模型] || [];
  return 允许列表.includes('全部') || 允许列表.includes(记忆类型);
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, 命令, 参数1, 参数2] = process.argv;

if (命令 === '读') {
  const [类型, 场景] = [参数1, 参数2];
  if (!类型) {
    console.error('用法: node 记忆模块.js 读 <类型> [场景]');
    process.exit(1);
  }
  if (类型 === '短时') {
    console.log(JSON.stringify(读短时(场景 || '默认'), null, 2));
  } else if (类型 === '长时') {
    console.log(JSON.stringify(读长时(场景, 10), null, 2));
  } else if (类型 === '内隐') {
    console.log(JSON.stringify(加载内隐记忆(), null, 2));
  } else {
    console.error('未知类型。可用: 短时, 长时, 内隐');
    process.exit(1);
  }
} else if (命令 === '写') {
  const [类型, ...内容列表] = [参数1, ...(参数2 || '').split(' ')];
  const 内容 = 内容列表.join(' ');
  if (!类型 || !内容) {
    console.error('用法: node 记忆模块.js 写 <类型> <内容>');
    process.exit(1);
  }
  if (类型 === '短时') {
    写短时('默认', 内容);
    console.log('短时记忆已写');
  } else if (类型 === '长时') {
    const id = 写长时('通用', 内容);
    console.log(`长时记忆已写: ${id}`);
  } else {
    console.error('未知类型。可用: 短时, 长时');
    process.exit(1);
  }
} else if (命令 === '清空') {
  清空短时();
  console.log('短时记忆已清空');
} else if (命令 === '遗忘') {
  const 干运行 = 参数1 === 'dry-run';
  const 结果 = 运行遗忘机制(干运行);
  console.log(JSON.stringify(结果, null, 2));
} else if (命令 === '固化') {
  const 模式ID = 参数1;
  const 次数 = parseInt(参数2) || 3;
  if (!模式ID) {
    console.error('用法: node 记忆模块.js 固化 <模式ID> [次数]');
    process.exit(1);
  }
  固化模式(模式ID, 次数);
} else if (命令 === '检索') {
  const 查询 = 参数1 || '';
  const 结果 = 检索长时(查询, 5);
  console.log(JSON.stringify(结果, null, 2));
} else if (命令 === '权限') {
  console.log('模型读权限:', JSON.stringify(模型读权限, null, 2));
  console.log('模型写权限:', JSON.stringify(模型写权限, null, 2));
} else {
  console.log(`
记忆模块 - 三层记忆管理系统

用法:
  node 记忆模块.js 读 <类型> [场景]         读记忆 (短时/长时/内隐)
  node 记忆模块.js 写 <类型> <内容>         写记忆 (短时/长时)
  node 记忆模块.js 清空                       清空短时记忆
  node 记忆模块.js 遗忘 [dry-run]           运行遗忘机制
  node 记忆模块.js 固化 <ID> [次数]        固化模式到内隐记忆
  node 记忆模块.js 检索 <查询>              检索长时记忆
  node 记忆模块.js 权限                     显示模型权限配置
`);
}

module.exports = {
  读短时,
  写短时,
  清空短时,
  读长时,
  写长时,
  检索长时,
  加载内隐记忆,
  写内隐记忆,
  固化模式,
  运行遗忘机制,
  可读,
  可写,
  模型读权限,
  模型写权限
};
