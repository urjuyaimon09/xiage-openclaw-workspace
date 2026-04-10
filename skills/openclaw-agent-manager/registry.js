/**
 * openclaw-agent-manager/registry.js
 * Agent 发现、注册、类型路由
 *
 * 发现 skills/openclaw-agent-manager/agents/ 下的所有 .json 定义文件
 * 提供 getAgent(name) / listAgents() / validateAgentConfig() 接口
 */

const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, 'agents');
const DEFAULT_TIMEOUT = 300; // 5 分钟

// 内置 agent 定义（与 JSON 文件合并）
const BUILTIN_AGENTS = {
  'general-purpose': {
    name: 'general-purpose',
    description: '全能型 Agent，可执行任意操作',
    tools: ['*'],
    model: 'inherit',
    runTimeoutSeconds: 600,
    cleanup: 'delete',
    sandbox: 'require',
    safety: { dangerLevel: 'high', allowedOperations: ['*'], restrictedOperations: [] }
  },
  'read-only-explore': {
    name: 'read-only-explore',
    description: '只读探索型，用于代码库搜索和分析',
    tools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
    model: 'inherit',
    runTimeoutSeconds: 300,
    cleanup: 'delete',
    sandbox: 'require',
    safety: { dangerLevel: 'low', allowedOperations: ['read', 'search'], restrictedOperations: ['Write', 'Edit', 'Delete', 'Move', 'Bash'] }
  },
  'planner': {
    name: 'planner',
    description: '规划型，用于架构设计和实施计划',
    tools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
    model: 'inherit',
    runTimeoutSeconds: 600,
    cleanup: 'delete',
    sandbox: 'require',
    safety: { dangerLevel: 'low', allowedOperations: ['read', 'search', 'plan'], restrictedOperations: ['Write', 'Edit', 'Delete', 'Bash'] }
  },
  'code-guide': {
    name: 'code-guide',
    description: '使用问答型，用于回答 OpenClaw 使用问题',
    tools: ['Read', 'Grep', 'WebSearch'],
    model: 'inherit',
    runTimeoutSeconds: 120,
    cleanup: 'delete',
    sandbox: 'require',
    safety: { dangerLevel: 'none', allowedOperations: ['read', 'search'], restrictedOperations: ['Write', 'Edit', 'Delete', 'Bash'] }
  }
};

let _registry = null;

/**
 * 扫描 agents/ 目录，加载所有 .json 文件
 */
function scanAgentsDir() {
  const agents = {};

  if (!fs.existsSync(AGENTS_DIR)) {
    return agents;
  }

  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
      const agent = JSON.parse(content);
      if (agent.name) {
        agents[agent.name] = normalizeAgent(agent);
      }
    } catch (e) {
      console.error(`[agent-registry] Failed to load ${file}: ${e.message}`);
    }
  }

  return agents;
}

/**
 * 规范化为完整 agent 对象
 */
function normalizeAgent(agent) {
  return {
    name: agent.name || 'unnamed',
    description: agent.description || '',
    tools: agent.tools || ['*'],
    model: agent.model || 'inherit',
    systemPrompt: agent.systemPrompt || null,
    runTimeoutSeconds: agent.runTimeoutSeconds || DEFAULT_TIMEOUT,
    cleanup: agent.cleanup || 'delete',
    sandbox: agent.sandbox || 'require',
    safety: agent.safety || { dangerLevel: 'unknown', allowedOperations: [], restrictedOperations: [] }
  };
}

/**
 * 加载完整 registry（JSON 覆盖内置）
 */
function loadRegistry() {
  if (_registry) return _registry;

  _registry = { ...BUILTIN_AGENTS };
  const extra = scanAgentsDir();

  // JSON 文件覆盖内置同名定义
  for (const [name, agent] of Object.entries(extra)) {
    if (_registry[name]) {
      _registry[name] = { ..._registry[name], ...agent };
    } else {
      _registry[name] = agent;
    }
  }

  return _registry;
}

/**
 * 获取指定名称的 agent 定义
 * @param {string} name
 * @returns {object|null}
 */
function getAgent(name) {
  const reg = loadRegistry();
  return reg[name] || null;
}

/**
 * 列出所有可用 agent
 * @returns {object[]}
 */
function listAgents() {
  const reg = loadRegistry();
  return Object.values(reg).map(a => ({
    name: a.name,
    description: a.description,
    dangerLevel: a.safety?.dangerLevel,
    toolsCount: a.tools?.length,
    timeout: a.runTimeoutSeconds
  }));
}

/**
 * 验证 agent 配置是否安全
 * @param {object} agent
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateAgentConfig(agent) {
  const errors = [];

  if (!agent.name) errors.push('agent.name is required');
  if (!agent.tools?.length) errors.push('agent.tools must have at least one entry');
  if (![null, 'inherit', 'minimax/MiniMax-M2.7'].includes(agent.model)) {
    errors.push(`agent.model must be 'inherit' or a valid model string`);
  }
  if (!['delete', 'keep'].includes(agent.cleanup)) {
    errors.push(`agent.cleanup must be 'delete' or 'keep'`);
  }
  if (!['require', 'bypass'].includes(agent.sandbox)) {
    errors.push(`agent.sandbox must be 'require' or 'bypass'`);
  }
  if (agent.cleanup === 'keep' && agent.safety?.dangerLevel === 'high') {
    errors.push(`HIGH dangerLevel agent cannot use cleanup='keep'`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 构建 sessions_spawn 的标准安全参数
 * @param {object} agent
 * @returns {object}
 */
function buildSpawnParams(agent) {
  return {
    mode: 'run',
    cleanup: agent.cleanup || 'delete',
    runTimeoutSeconds: agent.runTimeoutSeconds || DEFAULT_TIMEOUT,
    sandbox: agent.sandbox || 'require'
  };
}

module.exports = { getAgent, listAgents, validateAgentConfig, buildSpawnParams };
