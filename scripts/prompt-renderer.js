#!/usr/bin/env node
/**
 * prompt-renderer.js - Prompt模板渲染器
 * 
 * 功能：模板 + 上下文 → 完整Prompt字符串
 * 模板位置：prompts/<model>-prompt.md
 * 
 * 用法：
 *   node prompt-renderer.js render <model> <contextJSON>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const PROMPTS_DIR = path.join(WORKSPACE, 'prompts');
const IMPLICIT_MEMORY_FILE = path.join(WORKSPACE, 'config', 'implicit-memory.json');
const LOOP_STATE_FILE = path.join(WORKSPACE, 'memory', 'hot', 'loop-state.json');
const MEMORY_HOT_FILE = path.join(WORKSPACE, 'memory', 'hot', 'current.md');

// ─────────────────────────────────────────
// 记忆加载
// ─────────────────────────────────────────
function loadImplicitMemory() {
  if (fs.existsSync(IMPLICIT_MEMORY_FILE)) {
    return JSON.parse(fs.readFileSync(IMPLICIT_MEMORY_FILE, 'utf8'));
  }
  return null;
}

function loadLoopState() {
  if (fs.existsSync(LOOP_STATE_FILE)) {
    return JSON.parse(fs.readFileSync(LOOP_STATE_FILE, 'utf8'));
  }
  return null;
}

function loadRecentMemory(limit = 5) {
  // 加载记忆快照（轻量化，仅取关键信息）
  if (!fs.existsSync(MEMORY_HOT_FILE)) {
    return [];
  }
  const content = fs.readFileSync(MEMORY_HOT_FILE, 'utf8');
  // 提取关键结论（简化处理）
  const lines = content.split('\n').filter(l => l.startsWith('- '));
  return lines.slice(-limit);
}

function loadLongTermMemory(scene, limit = 3) {
  // 按场景检索长时记忆（未来对接向量数据库）
  // 当前版本：扫描memory目录，返回相关条目
  const memoryDir = path.join(WORKSPACE, 'memory');
  if (!fs.existsSync(memoryDir)) return [];
  
  // 简化：返回最近的记忆文件摘要
  const memFiles = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
  const recent = memFiles.slice(-limit);
  return recent.map(f => {
    const content = fs.readFileSync(path.join(memoryDir, f), 'utf8');
    return { file: f, preview: content.slice(0, 200) };
  });
}

// ─────────────────────────────────────────
// 模板渲染
// ─────────────────────────────────────────
function loadTemplate(model) {
  const templatePath = path.join(PROMPTS_DIR, `${model}-prompt.md`);
  if (!fs.existsSync(templatePath)) {
    return null;
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function interpolate(template, context) {
  // 简单变量替换：{{variable}} → context.value
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
    const keys = key.split('.');
    let value = context;
    for (const k of keys) {
      value = value?.[k];
    }
    return value !== undefined ? String(value) : match;
  });
}

function renderPrompt(model, context) {
  const template = loadTemplate(model);
  if (!template) {
    throw new Error(`Template not found: ${model}`);
  }
  
  // 构建渲染上下文
  const implicitMemory = loadImplicitMemory();
  const loopState = loadLoopState();
  const recentMemory = loadRecentMemory(context.recentMemoryLimit || 5);
  const longTermMemory = loadLongTermMemory(context.scene, context.longTermMemoryLimit || 3);
  
  const fullContext = {
    ...context,
    implicitMemory,
    loopState,
    recentMemory,
    longTermMemory,
    renderTime: new Date().toISOString()
  };
  
  // 渲染
  let rendered = interpolate(template, fullContext);
  
  // 处理条件区块：{{#if condition}}...{{/if}}
  rendered = rendered.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    const keys = key.split('.');
    let value = fullContext;
    for (const k of keys) {
      value = value?.[k];
    }
    return value ? content : '';
  });
  
  return rendered;
}

// ─────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────
const [,, command, arg1, arg2] = process.argv;

if (command === 'render') {
  const model = arg1;
  const contextJSON = arg2 || '{}';
  
  try {
    const context = JSON.parse(contextJSON);
    const rendered = renderPrompt(model, context);
    console.log(rendered);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
} else if (command === 'list') {
  // 列出所有可用模板
  if (!fs.existsSync(PROMPTS_DIR)) {
    console.log('No prompts directory found');
    return;
  }
  const files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('-prompt.md'));
  console.log('Available templates:');
  files.forEach(f => console.log(`  - ${f.replace('-prompt.md', '')}`));
} else {
  console.log(`
Prompt Renderer

Usage:
  node prompt-renderer.js render <model> <contextJSON>
  node prompt-renderer.js list

Examples:
  node prompt-renderer.js render perception '{"rawData": "用户输入"}'
  node prompt-renderer.js list
`);
}

module.exports = { renderPrompt, loadTemplate };
