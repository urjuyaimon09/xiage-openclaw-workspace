#!/usr/bin/env node
/**
 * memory-manager.js - 记忆管理模块
 * 
 * 职责：
 * - 全类型记忆存储/读取/更新/遗忘
 * - 三层记忆读写规则执行
 * - 遗忘机制（30天衰减/内隐记忆固化）
 * 
 * 用法：
 *   node memory-manager.js read <type> [scene]
 *   node memory-manager.js write <type> <content>
 *   node memory-manager.js forget [dry-run]
 *   node memory-manager.js固化 <patternId>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const MEMORY_DIR = path.join(WORKSPACE, 'memory');
const HOT_DIR = path.join(MEMORY_DIR, 'hot');
const LONGTERM_DIR = path.join(MEMORY_DIR, 'longterm');
const IMPLICIT_CONFIG = path.join(WORKSPACE, 'config', 'implicit-memory.json');

const FORGET_THRESHOLD_DAYS = 30;
const FORGET_WEIGHT_THRESHOLD = 0.1;

// ─────────────────────────────────────────
// 三层记忆读写权限
// ─────────────────────────────────────────
const MODEL_READ_PERMISSIONS = {
  perception: ['perceptionLog', 'majorEvents'],
  demand: ['demandPool', 'goalState'],
  acceptance: ['capabilityBoundary', 'acceptanceHistory'],
  plan: ['wbsTemplates', 'milestoneHistory'],
  execution: ['executionState'],
  feedback: ['all']
};

const MODEL_WRITE_PERMISSIONS = {
  perception: [],
  demand: ['demandPool'],
  acceptance: [],
  plan: [],
  execution: ['executionState'],
  feedback: ['longterm', 'implicit', 'current']
};

// ─────────────────────────────────────────
// 短时工作记忆（内存缓存）
// ─────────────────────────────────────────
let shortTermCache = null;

function writeShortTerm(key, value) {
  shortTermCache = shortTermCache || {};
  shortTermCache[key] = {
    value,
    timestamp: Date.now()
  };
}

function readShortTerm(key) {
  if (!shortTermCache) return null;
  return shortTermCache[key]?.value || null;
}

function clearShortTerm() {
  shortTermCache = null;
}

// ─────────────────────────────────────────
// 长时显性记忆
// ─────────────────────────────────────────
function ensureLongtermDir() {
  if (!fs.existsSync(LONGTERM_DIR)) {
    fs.mkdirSync(LONGTERM_DIR, { recursive: true });
  }
}

function writeLongTerm(scene, content, metadata = {}) {
  ensureLongtermDir();
  const id = `lt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    scene,
    content,
    metadata,
    weight: 1.0,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    accessCount: 0
  };
  const filePath = path.join(LONGTERM_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  return id;
}

function readLongTerm(scene, limit = 10) {
  ensureLongtermDir();
  if (!fs.existsSync(LONGTERM_DIR)) return [];
  
  const files = fs.readdirSync(LONGTERM_DIR).filter(f => f.endsWith('.json'));
  const records = files.map(f => {
    const content = fs.readFileSync(path.join(LONGTERM_DIR, f), 'utf8');
    return JSON.parse(content);
  });
  
  // 按场景过滤 + 按权重/时间排序
  const filtered = records
    .filter(r => !scene || r.scene === scene)
    .sort((a, b) => b.weight - a.weight || new Date(b.lastAccessed) - new Date(a.lastAccessed));
  
  // 更新访问记录
  filtered.slice(0, limit).forEach(r => {
    r.accessCount++;
    r.lastAccessed = new Date().toISOString();
    fs.writeFileSync(path.join(LONGTERM_DIR, `${r.id}.json`), JSON.stringify(r, null, 2), 'utf8');
  });
  
  return filtered.slice(0, limit);
}

function retrieveLongTerm(query, limit = 5) {
  // 简单关键词检索
  // 未来：对接向量数据库做语义检索
  ensureLongtermDir();
  if (!fs.existsSync(LONGTERM_DIR)) return [];
  
  const files = fs.readdirSync(LONGTERM_DIR).filter(f => f.endsWith('.json'));
  const records = files.map(f => {
    const content = fs.readFileSync(path.join(LONGTERM_DIR, f), 'utf8');
    return JSON.parse(content);
  });
  
  const keywords = query.toLowerCase().split(/\s+/);
  const scored = records.map(r => {
    const text = (r.scene + ' ' + r.content).toLowerCase();
    const score = keywords.filter(k => text.includes(k)).length;
    return { ...r, searchScore: score };
  });
  
  return scored
    .filter(r => r.searchScore > 0)
    .sort((a, b) => b.searchScore - a.searchScore)
    .slice(0, limit);
}

// ─────────────────────────────────────────
// 内隐潜意识记忆
// ─────────────────────────────────────────
function loadImplicitMemory() {
  if (fs.existsSync(IMPLICIT_CONFIG)) {
    return JSON.parse(fs.readFileSync(IMPLICIT_CONFIG, 'utf8'));
  }
  return { behaviorPatterns: { autoExec: [], habitLoops: [] }, automationRules: { rules: [] } };
}

function writeImplicitMemory(data) {
  fs.writeFileSync(IMPLICIT_CONFIG, JSON.stringify(data, null, 2), 'utf8');
}

function solidifyPattern(patternId, executionCount) {
  const mem = loadImplicitMemory();
  const threshold = mem.forgetPolicy?.patternMinExecCount || 3;
  
  if (executionCount >= threshold) {
    if (!mem.behaviorPatterns.habitLoops.find(p => p.id === patternId)) {
      mem.behaviorPatterns.habitLoops.push({
        id: patternId,
        solidifiedAt: new Date().toISOString(),
        executionCount
      });
      writeImplicitMemory(mem);
      console.log(`[Memory] Pattern ${patternId} solidified (exec count: ${executionCount})`);
    }
  }
}

function removeImplicitPattern(patternId) {
  const mem = loadImplicitMemory();
  mem.behaviorPatterns.habitLoops = mem.behaviorPatterns.habitLoops.filter(p => p.id !== patternId);
  writeImplicitMemory(mem);
  console.log(`[Memory] Pattern ${patternId} removed from implicit memory`);
}

// ─────────────────────────────────────────
// 遗忘机制
// ─────────────────────────────────────────
function decayLongTerm(daysThreshold = FORGET_THRESHOLD_DAYS, weightThreshold = FORGET_WEIGHT_THRESHOLD) {
  ensureLongtermDir();
  if (!fs.existsSync(LONGTERM_DIR)) return { decayed: 0, removed: 0 };
  
  const files = fs.readdirSync(LONGTERM_DIR).filter(f => f.endsWith('.json'));
  let decayed = 0;
  let removed = 0;
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  files.forEach(f => {
    const filePath = path.join(LONGTERM_DIR, f);
    const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const daysSinceAccess = (now - new Date(record.lastAccessed).getTime()) / msPerDay;
    
    if (daysSinceAccess > daysThreshold) {
      // 衰减权重
      record.weight = Math.max(0, record.weight - 0.1);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
      decayed++;
      
      if (record.weight <= weightThreshold) {
        fs.unlinkSync(filePath);
        removed++;
      }
    }
  });
  
  return { decayed, removed };
}

function forgetImplicit(daysThreshold = 90) {
  const mem = loadImplicitMemory();
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  const before = mem.behaviorPatterns.habitLoops.length;
  mem.behaviorPatterns.habitLoops = mem.behaviorPatterns.habitLoops.filter(p => {
    const daysSinceSolidify = (now - new Date(p.solidifiedAt).getTime()) / msPerDay;
    return daysSinceSolidify <= daysThreshold;
  });
  
  const removed = before - mem.behaviorPatterns.habitLoops.length;
  if (removed > 0) {
    writeImplicitMemory(mem);
  }
  
  return { removed };
}

function runForgetMechanism(dryRun = false) {
  console.log('[Memory] Running forget mechanism...');
  const ltResult = dryRun ? { decayed: 0, removed: 0 } : decayLongTerm();
  const implicitResult = dryRun ? { removed: 0 } : forgetImplicit();
  console.log(`[Memory] Long-term decayed: ${ltResult.decayed}, removed: ${ltResult.removed}`);
  console.log(`[Memory] Implicit removed: ${implicitResult.removed}`);
  return { ...ltResult, ...implicitResult };
}

// ─────────────────────────────────────────
// 模型读写权限检查
// ─────────────────────────────────────────
function canRead(model, memoryType) {
  const allowed = MODEL_READ_PERMISSIONS[model] || [];
  return allowed.includes('all') || allowed.includes(memoryType);
}

function canWrite(model, memoryType) {
  const allowed = MODEL_WRITE_PERMISSIONS[model] || [];
  return allowed.includes('all') || allowed.includes(memoryType);
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, command, arg1, arg2] = process.argv;

if (command === 'read') {
  const [type, scene] = [arg1, arg2];
  if (!type) {
    console.error('Usage: node memory-manager.js read <type> [scene]');
    process.exit(1);
  }
  if (type === 'short') {
    console.log(JSON.stringify(readShortTerm(scene || 'default'), null, 2));
  } else if (type === 'long') {
    console.log(JSON.stringify(readLongTerm(scene, 10), null, 2));
  } else if (type === 'implicit') {
    console.log(JSON.stringify(loadImplicitMemory(), null, 2));
  } else {
    console.error('Unknown type. Use: short, long, implicit');
    process.exit(1);
  }
} else if (command === 'write') {
  const [type, ...contentParts] = [arg1, ...(arg2 || '').split(' ')];
  const content = contentParts.join(' ');
  if (!type || !content) {
    console.error('Usage: node memory-manager.js write <type> <content>');
    process.exit(1);
  }
  if (type === 'short') {
    writeShortTerm('default', content);
    console.log('Short-term memory written');
  } else if (type === 'long') {
    const id = writeLongTerm('general', content);
    console.log(`Long-term memory written: ${id}`);
  } else {
    console.error('Unknown type. Use: short, long');
    process.exit(1);
  }
} else if (command === 'clear') {
  clearShortTerm();
  console.log('Short-term memory cleared');
} else if (command === 'forget') {
  const dryRun = arg1 === 'dry-run';
  const result = runForgetMechanism(dryRun);
  console.log(JSON.stringify(result, null, 2));
} else if (command === 'solidify') {
  const patternId = arg1;
  const count = parseInt(arg2) || 3;
  if (!patternId) {
    console.error('Usage: node memory-manager.js solidify <patternId> [count]');
    process.exit(1);
  }
  solidifyPattern(patternId, count);
} else if (command === 'retrieve') {
  const query = arg1 || '';
  const results = retrieveLongTerm(query, 5);
  console.log(JSON.stringify(results, null, 2));
} else if (command === 'permissions') {
  console.log('Model Read Permissions:', JSON.stringify(MODEL_READ_PERMISSIONS, null, 2));
  console.log('Model Write Permissions:', JSON.stringify(MODEL_WRITE_PERMISSIONS, null, 2));
} else {
  console.log(`
Memory Manager

Usage:
  node memory-manager.js read <type> [scene]   Read memory (short/long/implicit)
  node memory-manager.js write <type> <content> Write memory (short/long)
  node memory-manager.js clear                  Clear short-term memory
  node memory-manager.js forget [dry-run]       Run forget mechanism
  node memory-manager.js solidify <id> [count]  Solidify pattern to implicit
  node memory-manager.js retrieve <query>      Search long-term memory
  node memory-manager.js permissions            Show model permissions
`);
}

module.exports = {
  readShortTerm,
  writeShortTerm,
  clearShortTerm,
  readLongTerm,
  writeLongTerm,
  retrieveLongTerm,
  loadImplicitMemory,
  writeImplicitMemory,
  solidifyPattern,
  runForgetMechanism,
  canRead,
  canWrite,
  MODEL_READ_PERMISSIONS,
  MODEL_WRITE_PERMISSIONS
};
