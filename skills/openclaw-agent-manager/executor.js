/**
 * openclaw-agent-manager/executor.js
 * Agent 核心调度器 — 7 种执行模式
 *
 * 用法：
 *   node executor.js spawn <agentType> <task> [options]
 *   node executor.js status <sessionId>
 *   node executor.js list
 *   node executor.js kill <sessionId>
 */

const { getAgent, buildSpawnParams, validateAgentConfig } = require('./registry');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 7 种执行模式
const EXEC_MODES = {
  // 模式1: 同步前台 — 阻塞等待结果
  SYNC: 'sync',
  // 模式2: 异步后台 — 立即返回 sessionId
  ASYNC: 'async',
  // 模式3: 自动转后台 — 运行>timeout自动后台化（由 timeout-monitor.js 驱动）
  AUTO_BACKGROUND: 'auto-background',
  // 模式4: Worktree 隔离 — 在独立临时目录运行
  WORKTREE: 'worktree',
  // 模式5: 远程执行 — 暂不支持（OpenClaw 无远程 session）
  REMOTE: 'remote',
  // 模式6: Fork 模式 — 继承父上下文（session 级别注入）
  FORK: 'fork',
  // 模式7: Teammate 模式 — 持久 session，双向通信
  TEAMMATE: 'teammate'
};

// 解析命令行
const [,, cmd, ...args] = process.argv;

if (cmd === 'spawn') {
  const { agentType, task, options } = parseSpawnArgs(args);
  runSpawn(agentType, task, options).then(r => {
    console.log(JSON.stringify(r));
    process.exit(0);
  }).catch(e => {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  });
} else if (cmd === 'list') {
  const { listAgents } = require('./registry');
  console.log(JSON.stringify(listAgents(), null, 2));
} else if (cmd === 'validate') {
  const { getAgent, validateAgentConfig } = require('./registry');
  const agent = getAgent(args[0]);
  if (!agent) { console.log(JSON.stringify({ valid: false, errors: ['agent not found'] })); process.exit(1); }
  console.log(JSON.stringify(validateAgentConfig(agent)));
} else {
  console.error('用法: executor.js spawn <agentType> <task> [--mode sync|async|worktree|fork|teammate] [--timeout N] [--cwd <path>] [--parent-context <sessionId>]');
  process.exit(1);
}

// ─────────────────────────────────────────
// 解析 spawn 参数
// ─────────────────────────────────────────
function parseSpawnArgs(args) {
  let agentType = 'general-purpose';
  let task = '';
  const options = {
    mode: EXEC_MODES.ASYNC,
    timeout: null,
    cwd: null,
    parentContext: null,
    name: null,
    label: null,
    model: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i];
    } else if (arg === '--timeout' && args[i + 1]) {
      options.timeout = parseInt(args[++i], 10);
    } else if (arg === '--cwd' && args[i + 1]) {
      options.cwd = args[++i];
    } else if (arg === '--parent-context' && args[i + 1]) {
      options.parentContext = args[++i];
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--label' && args[i + 1]) {
      options.label = args[++i];
    } else if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (!arg.startsWith('--')) {
      if (!agentType || agentType === 'general-purpose') {
        agentType = arg;
      } else {
        task += (task ? ' ' : '') + arg;
      }
    }
  }

  // task 剩余参数合并
  if (args.length > 0) {
    const lastArgs = args.slice(args.findIndex(a => !a.startsWith('--') && !['sync','async','worktree','fork','teammate'].includes(a)));
  }

  return { agentType, task: args.filter(a => !a.startsWith('--')).slice(1).join(' ').trim(), options };
}

// ─────────────────────────────────────────
// 核心 spawn 函数
// ─────────────────────────────────────────
async function runSpawn(agentType, task, options) {
  const agent = getAgent(agentType);
  if (!agent) {
    throw new Error(`Agent type '${agentType}' not found. Available: ${Object.keys(require('./registry').loadRegistry()).join(', ')}`);
  }

  const validation = validateAgentConfig(agent);
  if (!validation.valid) {
    throw new Error(`Agent config invalid: ${validation.errors.join(', ')}`);
  }

  const spawnParams = buildSpawnParams(agent);

  // 超时覆盖
  const effectiveTimeout = options.timeout || agent.runTimeoutSeconds;

  // 模式路由
  switch (options.mode) {
    case EXEC_MODES.SYNC:
      return await spawnSync(agent, task, { ...spawnParams, timeout: effectiveTimeout, cwd: options.cwd, model: options.model });
    case EXEC_MODES.ASYNC:
      return await spawnAsync(agent, task, { ...spawnParams, timeout: effectiveTimeout, cwd: options.cwd, model: options.model, label: options.label });
    case EXEC_MODES.AUTO_BACKGROUND:
      return await spawnAsync(agent, task, { ...spawnParams, timeout: effectiveTimeout, cwd: options.cwd, autoBackground: true, model: options.model });
    case EXEC_MODES.WORKTREE:
      return await spawnWorktree(agent, task, { ...spawnParams, timeout: effectiveTimeout, parentContext: options.parentContext, model: options.model });
    case EXEC_MODES.FORK:
      return await spawnFork(agent, task, { ...spawnParams, timeout: effectiveTimeout, parentContext: options.parentContext, model: options.model });
    case EXEC_MODES.TEAMMATE:
      return await spawnTeammate(agent, task, { ...spawnParams, cwd: options.cwd, name: options.name, model: options.model });
    case EXEC_MODES.REMOTE:
      throw new Error('REMOTE mode is not supported on OpenClaw');
    default:
      throw new Error(`Unknown mode: ${options.mode}`);
  }
}

// ─────────────────────────────────────────
// 模式1: 同步前台
// ─────────────────────────────────────────
async function spawnSync(agent, task, params) {
  // 同步模式：通过 openclaw sessions_spawn 发起，等待完成，返回结果
  // OpenClaw 不支持同步等待，所以用 ASYNC + 超短超时模拟
  const sessionId = await spawnAsyncSession(agent, task, { ...params, timeout: params.timeout });
  return {
    status: 'completed',
    sessionId,
    mode: 'sync',
    agent: agent.name,
    result: null // 主 agent 收到结果后填充
  };
}

// ─────────────────────────────────────────
// 模式2: 异步后台
// ─────────────────────────────────────────
async function spawnAsync(agent, task, params) {
  const sessionId = await spawnAsyncSession(agent, task, params);
  return {
    status: 'async_launched',
    sessionId,
    mode: 'async',
    agent: agent.name,
    description: task.substring(0, 50),
    prompt: task
  };
}

// ─────────────────────────────────────────
// 模式3: 自动转后台（由 timeout-monitor.js 驱动）
// 实际执行使用 ASYNC，timeout-monitor 监听超时后主动转 announce
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// 模式4: Worktree 隔离
// ─────────────────────────────────────────
async function spawnWorktree(agent, task, params) {
  // 创建临时工作目录（模拟 worktree）
  const tmpDir = path.join(require('os').tmpdir(), `openclaw-worktree-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const sessionId = await spawnAsyncSession(agent, task, { ...params, cwd: tmpDir });

  return {
    status: 'async_launched',
    sessionId,
    mode: 'worktree',
    agent: agent.name,
    worktreeDir: tmpDir,
    cleanupRequired: true,
    description: task.substring(0, 50)
  };
}

// ─────────────────────────────────────────
// 模式6: Fork 模式
// 继承父级上下文片段（session transplant）
// ─────────────────────────────────────────
async function spawnFork(agent, task, params) {
  // Fork: 将父 session 的关键上下文（memory 文件路径、当前项目状态）注入 task
  let forkContext = '';
  if (params.parentContext) {
    try {
      const parentSessionDir = path.join(
        process.env.APPDATA || process.env.HOME,
        '.openclaw',
        'agents',
        'main',
        'sessions',
        params.parentContext
      );
      if (fs.existsSync(parentSessionDir)) {
        // 读取父 session 的 system prompt 或 memory 片段
        const memoryPath = path.join(process.env.APPDATA || 'C:\\Users\\Administrator\\.openclaw', '.openclaw', 'workspace', 'memory', 'hot', 'current.md');
        if (fs.existsSync(memoryPath)) {
          forkContext = `\n\n[父级上下文摘要]\n${fs.readFileSync(memoryPath, 'utf8').substring(0, 2000)}`;
        }
      }
    } catch (e) {
      // fork context fallback: silently skip
    }
  }

  const enrichedTask = `${task}${forkContext}`;
  const sessionId = await spawnAsyncSession(agent, enrichedTask, { ...params, timeout: params.timeout });

  return {
    status: 'async_launched',
    sessionId,
    mode: 'fork',
    agent: agent.name,
    forkContextIncluded: forkContext.length > 0,
    description: task.substring(0, 50)
  };
}

// ─────────────────────────────────────────
// 模式7: Teammate 模式
// 持久 session，双向通信（通过 openclaw sessions_send）
// ─────────────────────────────────────────
async function spawnTeammate(agent, task, params) {
  if (params.cleanup === 'keep' && agent.safety?.dangerLevel === 'high') {
    throw new Error('TEAMMATE mode with cleanup=keep is not allowed for HIGH dangerLevel agents');
  }

  // Teammate 使用 mode="session"（持久 session）
  const sessionId = await spawnTeammateSession(agent, task, params);

  return {
    status: 'teammate_spawned',
    sessionId,
    mode: 'teammate',
    agent: agent.name,
    name: params.name || agent.name,
    sendMessageTarget: `session:${sessionId}`,
    cleanupRequired: true,
    description: task.substring(0, 50)
  };
}

// ─────────────────────────────────────────
// 底层：调用 openclaw sessions_spawn
// ─────────────────────────────────────────
async function spawnAsyncSession(agent, task, params) {
  const openclawPath = require.resolve('openclaw', { paths: ['C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules'] });

  return new Promise((resolve, reject) => {
    const args = [
      'sessions', 'spawn',
      '--task', `"${task.replace(/"/g, '\\"')}"`,
      '--mode', 'run',
      '--cleanup', params.cleanup,
      '--sandbox', params.sandbox,
      '--timeout', String(params.timeout || 300)
    ];

    if (params.cwd) args.push('--cwd', params.cwd);
    if (params.label) args.push('--label', params.label);
    if (params.model) args.push('--model', params.model);

    const proc = spawn('node', [openclawPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true
    });

    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code === 0) {
        // 解析 sessionId
        const match = stdout.match(/session[_\-]?id[:\s]+([a-f0-9\-]{36})/i)
                  || stdout.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        resolve(match ? match[1] : stdout.trim().split('\n').pop());
      } else {
        reject(new Error(`spawn failed: ${stderr || stdout}`));
      }
    });

    proc.on('error', reject);

    // 超时保护
    setTimeout(() => {
      proc.kill();
      reject(new Error('spawn timeout'));
    }, 30000);
  });
}

async function spawnTeammateSession(agent, task, params) {
  // Teammate: 使用 mode="session"（持久 session）
  const openclawPath = require.resolve('openclaw', { paths: ['C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules'] });

  return new Promise((resolve, reject) => {
    const args = [
      'sessions', 'spawn',
      '--task', `"${task.replace(/"/g, '\\"')}"`,
      '--mode', 'session',
      '--cleanup', params.cleanup || 'keep',
      '--sandbox', params.sandbox,
      '--timeout', String(params.timeout || 3600)
    ];

    if (params.name) args.push('--label', params.name);
    if (params.cwd) args.push('--cwd', params.cwd);

    const proc = spawn('node', [openclawPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true
    });

    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code === 0) {
        const match = stdout.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        resolve(match ? match[1] : stdout.trim().split('\n').pop());
      } else {
        reject(new Error(`teammate spawn failed: ${stderr || stdout}`));
      }
    });

    proc.on('error', reject);
    setTimeout(() => { proc.kill(); reject(new Error('teammate spawn timeout')); }, 30000);
  });
}
