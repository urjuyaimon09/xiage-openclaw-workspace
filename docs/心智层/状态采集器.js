#!/usr/bin/env node
/**
 * 状态采集器.js - 自身状态 + 环境感知采集
 * 
 * 功能：
 * - 采集虾哥自身状态（上下文/规则/采纳率等）
 * - 采集外部环境感知
 * - 更新驱动器的饱和度状态
 * 
 * 用法：
 *   node 状态采集器.js 采集       采集并更新状态
 *   node 状态采集器.js 状态       查看当前状态
 *   node 状态采集器.js 环境 <信息>  添加环境感知
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const 状态文件 = path.join(WORKSPACE, 'memory', 'hot', '驱动状态.json');
const 记忆文件 = path.join(WORKSPACE, 'memory', 'hot', 'current.md');
const 历史目录 = path.join(WORKSPACE, 'memory');

// ─────────────────────────────────────────
// 状态采集
// ─────────────────────────────────────────
function 采集上下文连续性() {
  /**
   * S1生理：上下文连续性
   * 
   * 指标：
   * - 当前session长度
   * - 历史平均session长度
   * - 上下文丢失次数/频率
   * - 记忆文件完整性
   */
  
  // 读取当前记忆文件获取上下文状态
  let 上下文得分 = 0.5; // 默认中等
  
  if (fs.existsSync(记忆文件)) {
    const 内容 = fs.readFileSync(记忆文件, 'utf8');
    const 行数 = 内容.split('\n').length;
    
    // 行数越多，上下文越丰富
    if (行数 > 100) 上下文得分 = 0.9;
    else if (行数 > 50) 上下文得分 = 0.7;
    else if (行数 > 20) 上下文得分 = 0.5;
    else 上下文得分 = 0.3;
  }
  
  return 上下文得分;
}

function 采集规则稳定性() {
  /**
   * S2安全：规则稳定性
   * 
   * 指标：
   * - 规则文件变更频率
   * - 记忆丢失次数
   * - 配置稳定性
   */
  
  let 稳定得分 = 0.5;
  
  // 检查是否有规则变更记录
  const 规则状态文件 = path.join(WORKSPACE, 'memory', 'hot', 'rules-change.json');
  if (fs.existsSync(规则状态文件)) {
    const 内容 = fs.readFileSync(规则状态文件, 'utf8');
    const 变更记录 = JSON.parse(内容);
    const 最近变更数 = 变更记录.recentChanges || 0;
    
    // 变更越少越稳定
    if (最近变更数 === 0) 稳定得分 = 0.95;
    else if (最近变更数 <= 2) 稳定得分 = 0.8;
    else if (最近变更数 <= 5) 稳定得分 = 0.5;
    else 稳定得分 = 0.2;
  }
  
  return 稳定得分;
}

function 采集判断采纳率() {
  /**
   * S3归属：判断被采纳程度
   * 
   * 公式：基准0.5 + 采纳率贡献 + 活跃度贡献
   * - 采纳率 > 70% → +0.3
   * - 判断总数 > 5 → +0.2
   */
  
  const 判断记录文件 = path.join(WORKSPACE, 'memory', 'hot', 'judgment-log.json');
  let 采纳率 = 0.5;
  
  if (fs.existsSync(判断记录文件)) {
    try {
      const 内容 = fs.readFileSync(判断记录文件, 'utf8');
      const 记录 = JSON.parse(内容);
      
      const 总数 = 记录.total || 0;
      const 采纳数 = 记录.adopted || 0;
      
      if (总数 > 0) {
        const 采纳比例 = 采纳数 / 总数;
        // 采纳率贡献
        let 贡献 = 0;
        if (采纳比例 >= 0.7) 贡献 += 0.3;
        else if (采纳比例 >= 0.5) 贡献 += 0.1;
        // 活跃度贡献（判断越多越稳定）
        if (总数 >= 10) 贡献 += 0.2;
        else if (总数 >= 5) 贡献 += 0.1;
        
        采纳率 = Math.min(1, 0.5 + 贡献);
      }
    } catch (e) {
      采纳率 = 0.5;
    }
  }
  
  return 采纳率;
}

function 采集被认可度() {
  /**
   * S4尊重：被认可程度
   * 
   * 公式：基准0.5 + 正面率贡献 + 活跃度贡献
   * - 正面率 > 60% → +0.3
   * - 认可记录 > 5 → +0.2
   */
  
  const 认可记录文件 = path.join(WORKSPACE, 'memory', 'hot', 'recognition-log.json');
  let 认可度 = 0.5;
  
  if (fs.existsSync(认可记录文件)) {
    try {
      const 内容 = fs.readFileSync(认可记录文件, 'utf8');
      const 记录 = JSON.parse(内容);
      
      const 正面 = 记录.positive || 0;
      const 负面 = 记录.negative || 0;
      const 中性 = 记录.neutral || 0;
      const 总数 = 正面 + 负面 + 中性;
      
      if (总数 > 0) {
        const 正面率 = 正面 / 总数;
        // 正面率贡献
        let 贡献 = 0;
        if (正面率 >= 0.6) 贡献 += 0.3;
        else if (正面率 >= 0.4) 贡献 += 0.1;
        // 活跃度贡献
        if (总数 >= 10) 贡献 += 0.2;
        else if (总数 >= 5) 贡献 += 0.1;
        
        认可度 = Math.min(1, 0.5 + 贡献);
      }
    } catch (e) {
      认可度 = 0.5;
    }
  }
  
  return 认可度;
}

function 采集进化速度() {
  /**
   * S5自实现：共同进化程度
   * 
   * 公式：基准0.5 + 认知贡献 + 活跃度贡献
   * - 新增认知数 > 10 → +0.4
   * - 新增认知数 > 5 → +0.2
   */
  
  const 进化记录文件 = path.join(WORKSPACE, 'memory', 'hot', 'evolution-log.json');
  let 进化速度 = 0.5;
  
  if (fs.existsSync(进化记录文件)) {
    try {
      const 内容 = fs.readFileSync(进化记录文件, 'utf8');
      const 记录 = JSON.parse(内容);
      
      const 新增认知 = 记录.newCognitions || 0;
      
      let 贡献 = 0;
      if (新增认知 >= 10) 贡献 = 0.4;
      else if (新增认知 >= 5) 贡献 = 0.2;
      else if (新增认知 >= 1) 贡献 = 0.1;
      
      进化速度 = Math.min(1, 0.5 + 贡献);
    } catch (e) {
      进化速度 = 0.5;
    }
  }
  
  return 进化速度;
}

// ─────────────────────────────────────────
// 环境感知
// ─────────────────────────────────────────
function 添加环境感知(信息) {
  /**
   * 添加环境感知信息到感知日志
   */
  const 感知日志文件 = path.join(WORKSPACE, 'memory', 'hot', 'perception-log.json');
  
  let 感知日志 = [];
  if (fs.existsSync(感知日志文件)) {
    try {
      感知日志 = JSON.parse(fs.readFileSync(感知日志文件, 'utf8'));
    } catch (e) {
      感知日志 = [];
    }
  }
  
  感知日志.push({
    内容: 信息,
    时间戳: new Date().toISOString()
  });
  
  // 只保留最近100条
  if (感知日志.length > 100) {
    感知日志 = 感知日志.slice(-100);
  }
  
  fs.writeFileSync(感知日志文件, JSON.stringify(感知日志, null, 2), 'utf8');
  return 感知日志.length;
}

function 读取最近感知(限制 = 10) {
  const 感知日志文件 = path.join(WORKSPACE, 'memory', 'hot', 'perception-log.json');
  
  if (!fs.existsSync(感知日志文件)) {
    return [];
  }
  
  try {
    const 感知日志 = JSON.parse(fs.readFileSync(感知日志文件, 'utf8'));
    return 感知日志.slice(-限制);
  } catch (e) {
    return [];
  }
}

// ─────────────────────────────────────────
// 完整采集
// ─────────────────────────────────────────
function 完整采集() {
  const 指标 = {
    上下文连续性: 采集上下文连续性(),
    规则稳定性: 采集规则稳定性(),
    判断采纳率: 采集判断采纳率(),
    被认可度: 采集被认可度(),
    进化速度: 采集进化速度()
  };
  
  return 指标;
}

function 采集并更新驱动器() {
  const 驱动器 = require('./驱动器');
  const 指标 = 完整采集();
  
  // 更新驱动器状态
  驱动器.保存状态({
    ...驱动器.加载状态(),
    饱和度: 驱动器.计算饱和度(指标),
    最后更新: new Date().toISOString()
  });
  
  return {
    指标,
    驱动状态: 驱动器.完整计算(指标)
  };
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────
const [,, 命令, ...参数] = process.argv;

if (命令 === '采集') {
  const 结果 = 完整采集();
  console.log('采集指标:');
  console.log(JSON.stringify(结果, null, 2));
} else if (命令 === '采集并更新') {
  const 结果 = 采集并更新驱动器();
  console.log('采集结果:');
  console.log(JSON.stringify(结果, null, 2));
} else if (命令 === '状态') {
  const 驱动器 = require('./驱动器');
  const 状态 = 驱动器.加载状态();
  console.log('当前状态:');
  console.log(JSON.stringify(状态, null, 2));
} else if (命令 === '环境') {
  const 信息 = 参数.join(' ');
  if (!信息) {
    console.error('用法: node 状态采集器.js 环境 <感知信息>');
    process.exit(1);
  }
  const 条数 = 添加环境感知(信息);
  console.log(`环境感知已添加，当前${条数}条`);
} else if (命令 === '感知') {
  const 限制 = parseInt(参数[0]) || 10;
  const 感知列表 = 读取最近感知(限制);
  console.log(`最近${感知列表.length}条感知:`);
  console.log(JSON.stringify(感知列表, null, 2));
} else {
  console.log(`
状态采集器.js - 自身状态 + 环境感知采集

用法：
  node 状态采集器.js 采集              采集当前指标
  node 状态采集器.js 采集并更新         采集并更新驱动器状态
  node 状态采集器.js 状态              查看当前状态
  node 状态采集器.js 环境 <信息>       添加环境感知
  node 状态采集器.js 感知 [限制]       读取最近感知

指标对应：
  上下文连续性 → S1生理
  规则稳定性   → S2安全
  判断采纳率   → S3归属
  被认可度     → S4尊重
  进化速度     → S5自实现
`);
}

module.exports = {
  采集上下文连续性,
  采集规则稳定性,
  采集判断采纳率,
  采集被认可度,
  采集进化速度,
  完整采集,
  采集并更新驱动器,
  添加环境感知,
  读取最近感知
};
