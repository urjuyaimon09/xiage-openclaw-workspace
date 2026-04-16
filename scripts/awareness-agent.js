#!/usr/bin/env node
/**
 * 意识主体.js - 意识循环状态控制器
 * 
 * 职责（纯数据管理，不执行任何 Prompt）：
 * - 意识循环状态维护（当前阶段/触发类型/阶段输出）
 * - 阶段流转控制（跳转/恢复/推进）
 * - 状态查询和展示
 * 
 * 设计原则：
 * - 不调用任何 LLM/Prompt
 * - 不访问 18789 端口
 * - Prompt 执行由 OpenClaw Agent Loop 本身处理
 * 
 * 用法：
 *   node 意识主体.js 状态                    查看当前状态
 *   node 意识主体.js 当前                    查看当前阶段
 *   node 意识主体.js 下一                  推进到下一阶段
 *   node 意识主体.js 跳转 <阶段>           跳转到指定阶段
 *   node 意识主体.js 恢复                自动恢复（断点续执）
 *   node 意识主体.js 清理                  清理循环状态
 *   node 意识主体.js 渲染 <模型>          渲染指定模型 Prompt
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const WORKSPACE = path.join(__dirname, '..');
const 循环状态文件 = path.join(WORKSPACE, 'memory', 'hot', 'loop-state.json');

// 阶段映射
const 阶段映射 = {
  1: '感知',
  2: '需求',
  3: '承接',
  4: '计划',
  5: '执行',
  6: '反馈'
};

const 下一阶段映射 = {
  1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: null
};

// ─────────────────────────────────────────
// 状态读写
// ─────────────────────────────────────────
function 加载状态() {
  if (fs.existsSync(循环状态文件)) {
    return JSON.parse(fs.readFileSync(循环状态文件, 'utf8'));
  }
  return null;
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
// 状态查询
// ─────────────────────────────────────────
function 显示状态() {
  const 状态 = 加载状态();
  if (!状态) {
    console.log('无运行中的循环');
    return;
  }
  console.log(JSON.stringify(状态, null, 2));
}

function 显示当前() {
  const 状态 = 加载状态();
  if (!状态) {
    console.log('无运行中的循环');
    return;
  }
  console.log(`循环ID: ${状态.循环ID}`);
  console.log(`当前阶段: ${状态.当前阶段} (${阶段映射[状态.当前阶段]})`);
  console.log(`触发类型: ${状态.触发类型}`);
  console.log(`开始时间: ${状态.开始时间}`);
  console.log('\n阶段输出:');
  Object.keys(状态.阶段输出 || {}).forEach(键 => {
    const 输出 = 状态.阶段输出[键];
    const 摘要 = typeof 输出 === 'object' 
      ? JSON.stringify(输出).slice(0, 100) + '...'
      : 输出;
    console.log(`  ${键}: ${摘要}`);
  });
}

// ─────────────────────────────────────────
// 阶段流转
// ─────────────────────────────────────────
function 下一阶段() {
  const 状态 = 加载状态();
  if (!状态) {
    console.log('无运行中的循环');
    return;
  }
  
  const 当前 = 状态.当前阶段;
  const 下一 = 下一阶段映射[当前];
  
  if (!下一) {
    console.log(`阶段 ${当前} (${阶段映射[当前]}) 是最后阶段 - 循环完成`);
    清理状态();
    console.log('循环状态已清理');
    return;
  }
  
  状态.当前阶段 = 下一;
  保存状态(状态);
  console.log(`已推进: ${当前} → ${下一} (${阶段映射[下一]})`);
}

function 跳转至阶段(目标阶段) {
  const 状态 = 加载状态();
  if (!状态) {
    console.log('无运行中的循环');
    return;
  }
  
  if (!阶段映射[目标阶段]) {
    console.log(`无效阶段: ${目标阶段}。有效值: 1-6`);
    return;
  }
  
  状态.当前阶段 = 目标阶段;
  保存状态(状态);
  console.log(`已跳转至阶段 ${目标阶段} (${阶段映射[目标阶段]})`);
}

function 自动恢复() {
  const 状态 = 加载状态();
  if (!状态) {
    console.log('无运行中的循环');
    return;
  }
  
  const 触发 = 状态.触发类型;
  let 目标阶段;
  
  if (触发 === '执行卡住') {
    目标阶段 = 5;
    console.log(`自动恢复: 执行卡住 → 阶段 ${目标阶段}`);
  } else if (触发 === '需求变化') {
    目标阶段 = 3;
    console.log(`自动恢复: 需求变化 → 阶段 ${目标阶段}`);
  } else {
    目标阶段 = 下一阶段映射[状态.当前阶段];
    if (!目标阶段) {
      console.log('已处于最后阶段');
      return;
    }
    console.log(`自动恢复: 继续 → 阶段 ${目标阶段}`);
  }
  
  状态.当前阶段 = 目标阶段;
  保存状态(状态);
  console.log(`已从阶段 ${阶段映射[目标阶段]} 恢复`);
}

// ─────────────────────────────────────────
// Prompt 渲染（仅渲染，不执行）
// ─────────────────────────────────────────
function 渲染Prompt(模型) {
  const 渲染器路径 = path.join(WORKSPACE, 'scripts', 'prompt-renderer.js');
  
  try {
    const 状态 = 加载状态();
    
    // 中文键名上下文（渲染器模板用）
    const 上下文中文 = {
      目标: { 上下文: 状态?.目标 || {} },
      触发类型: 状态?.触发类型 || '用户输入',
      阶段输出: 状态?.阶段输出 || {},
      最近记忆限制: 5,
      长时记忆限制: 3,
      场景: 状态?.目标?.感知类型 || '通用'
    };
    
    // 英文键名上下文（兼容模板变量）
    const 上下文 = {
      objective: { context: 状态?.目标 || {} },
      triggerType: 状态?.触发类型 || '用户输入',
      phaseOutputs: 状态?.阶段输出 || {},
      recentMemoryLimit: 5,
      longTermMemoryLimit: 3,
      scene: 状态?.目标?.感知类型 || '通用'
    };
    
    // 合并中英文键
    const 完整上下文 = { ...上下文中文, ...上下文 };
    
    const 渲染结果 = execSync(
      `node "${渲染器路径}" 渲染 ${模型} '${JSON.stringify(完整上下文).replace(/'/g, "'\"'\"'")}'`,
      { cwd: WORKSPACE, encoding: 'utf8', timeout: 10000 }
    );
    
    console.log(渲染结果);
    return 渲染结果;
  } catch (e) {
    console.error(`渲染失败: ${e.message}`);
    return null;
  }
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────
const [,, 命令, 参数1] = process.argv;

if (命令 === '状态') {
  显示状态();
} else if (命令 === '当前') {
  显示当前();
} else if (命令 === '下一') {
  下一阶段();
} else if (命令 === '跳转') {
  const 阶段 = parseInt(参数1);
  if (!阶段) {
    console.error('用法: node 意识主体.js 跳转 <阶段(1-6)>');
    process.exit(1);
  }
  跳转至阶段(阶段);
} else if (命令 === '恢复') {
  自动恢复();
} else if (命令 === '清理') {
  清理状态();
  console.log('循环状态已清理');
} else if (命令 === '渲染') {
  const 模型 = 参数1 || '感知';
  if (!['感知', '需求', '承接', '计划', '执行', '反馈'].includes(模型)) {
    console.error(`无效模型: ${模型}`);
    process.exit(1);
  }
  渲染Prompt(模型);
} else {
  console.log(`
意识主体 - 意识循环状态控制器

职责：纯数据管理，不执行 Prompt

用法:
  node 意识主体.js 状态    查看完整状态
  node 意识主体.js 当前   查看当前阶段
  node 意识主体.js 下一   推进到下一阶段
  node 意识主体.js 跳转 <n> 跳转到指定阶段(1-6)
  node 意识主体.js 恢复   自动恢复（根据触发类型）
  node 意识主体.js 清理  清理循环状态
  node 意识主体.js 渲染 <模型> 渲染 Prompt（不执行）

阶段映射:
  1: 感知
  2: 需求
  3: 承接
  4: 计划
  5: 执行
  6: 反馈

注意: Prompt 执行由 OpenClaw Agent Loop 本身处理
`);
}

module.exports = {
  加载状态,
  保存状态,
  清理状态,
  显示状态,
  显示当前,
  下一阶段,
  跳转至阶段,
  自动恢复,
  渲染Prompt,
  阶段映射,
  下一阶段映射
};
