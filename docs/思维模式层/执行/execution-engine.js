/**
 * execution-engine.js v1.0.0
 * 执行引擎 - 对接 TASK_EXECUTION_MODEL
 *
 * 功能：
 * - 步骤执行追踪
 * - 进度监控
 * - 异常处理
 * - 完成判定
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = process.cwd();
const PROJECTS_DIR = path.join(__dirname, '项目档案');

// ============================================================
// 执行状态
// ============================================================

const EXEC_STATES = {
  PENDING: 'pending',       // 待执行
  RUNNING: 'running',       // 执行中
  PAUSED: 'paused',        // 暂停
  COMPLETED: 'completed',   // 完成
  FAILED: 'failed',        // 失败
  CANCELLED: 'cancelled'   // 取消
};

// ============================================================
// 步骤状态
// ============================================================

const STEP_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

// ============================================================
// 步骤执行器
// ============================================================

function executeStep(step, context = {}) {
  const startTime = Date.now();
  let result = { success: false, output: '', error: '', duration: 0 };

  try {
    // 根据 step.type 执行不同操作
    switch (step.type) {
      case 'exec':
        // 执行 shell 命令
        result.output = execSync(step.command, {
          encoding: 'utf8',
          timeout: step.timeout || 30000,
          cwd: step.cwd || WORKSPACE
        });
        result.success = true;
        break;

      case 'write':
        // 写入文件
        const dir = path.dirname(step.path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(step.path, step.content, 'utf8');
        result.output = `文件已写入: ${step.path}`;
        result.success = true;
        break;

      case 'read':
        // 读取文件
        if (fs.existsSync(step.path)) {
          result.output = fs.readFileSync(step.path, 'utf8');
          result.success = true;
        } else {
          result.error = `文件不存在: ${step.path}`;
        }
        break;

      case 'copy':
        // 复制文件/目录
        if (step.recursive) {
          copyDirectorySync(step.from, step.to);
        } else {
          fs.copyFileSync(step.from, step.to);
        }
        result.output = `已复制: ${step.from} -> ${step.to}`;
        result.success = true;
        break;

      case 'delete':
        // 删除文件（使用 trash 逻辑）
        if (fs.existsSync(step.path)) {
          fs.unlinkSync(step.path);
          result.output = `已删除: ${step.path}`;
          result.success = true;
        } else {
          result.output = `文件不存在，跳过: ${step.path}`;
          result.success = true;
        }
        break;

      case 'http':
        // HTTP 请求（简化版，使用 PowerShell）
        const httpCmd = `powershell -Command "Invoke-WebRequest -Uri '${step.url}' -Method ${step.method || 'GET'} -UseBasicParsing | Select-Object -ExpandProperty Content"`;
        result.output = execSync(httpCmd, { encoding: 'utf8', timeout: step.timeout || 30000 });
        result.success = true;
        break;

      case 'ai':
        // AI 任务（标记为需要人工触发）
        result.output = '[需要 AI 处理] ' + step.prompt;
        result.success = true;
        result.requiresAI = true;
        break;

      case 'human':
        // 人工任务（标记为需要人工处理）
        result.output = '[需要人工处理] ' + step.description;
        result.success = true;
        result.requiresHuman = true;
        break;

      default:
        result.error = `未知步骤类型: ${step.type}`;
    }
  } catch (e) {
    result.error = e.message;
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ============================================================
// 复制目录
// ============================================================

function copyDirectorySync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ============================================================
// 状态读写
// ============================================================

function createExecutionId() {
  return 'E' + Date.now();
}

function saveExecution(execution) {
  const dir = path.join(PROJECTS_DIR, execution.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'execution-state.json');
  fs.writeFileSync(filePath, JSON.stringify(execution, null, 2), 'utf8');
  return filePath;
}

function loadExecution(id) {
  const filePath = path.join(PROJECTS_DIR, id, 'execution-state.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listExecutions() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => fs.existsSync(path.join(PROJECTS_DIR, f, 'execution-state.json')))
    .map(f => loadExecution(f));
}

// ============================================================
// 主流程
// ============================================================

function createExecution(taskName, steps = []) {
  const id = createExecutionId();
  const execution = {
    id,
    taskName,
    state: EXEC_STATES.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: steps.map((s, idx) => ({
      id: `S${(idx + 1).toString().padStart(3, '0')}`,
      name: s.name || s.type,
      type: s.type,
      status: STEP_STATES.PENDING,
      ...s
    })),
    currentStep: 0,
    completionRate: 0,
    results: []
  };

  const filePath = saveExecution(execution);
  return { execution, filePath };
}

function runExecution(id, options = {}) {
  const execution = loadExecution(id);
  if (!execution) return null;
  if (execution.state === EXEC_STATES.COMPLETED) {
    return { error: '执行已完成，不能重复运行', execution };
  }

  execution.state = EXEC_STATES.RUNNING;
  execution.startedAt = new Date().toISOString();
  saveExecution(execution);

  let stepIndex = execution.currentStep;
  for (let i = stepIndex; i < execution.steps.length; i++) {
    const step = execution.steps[i];
    if (options.skipToStep && step.id !== options.skipToStep) continue;

    execution.steps[i].status = STEP_STATES.RUNNING;
    saveExecution(execution);

    const result = executeStep(step, { execution, context: options.context });

    execution.steps[i].status = result.success ? STEP_STATES.DONE : STEP_STATES.FAILED;
    execution.steps[i].result = result;
    execution.currentStep = i + 1;

    if (!result.success && !options.continueOnError) {
      execution.state = EXEC_STATES.FAILED;
      execution.failedAt = new Date().toISOString();
      saveExecution(execution);
      return { error: result.error, execution, failedStep: step };
    }

    saveExecution(execution);
  }

  const allDone = execution.steps.every(s => s.status === STEP_STATES.DONE || s.status === STEP_STATES.SKIPPED);
  if (allDone) {
    execution.state = EXEC_STATES.COMPLETED;
    execution.completedAt = new Date().toISOString();
    execution.completionRate = 100;
  }

  execution.completionRate = Math.round(
    execution.steps.filter(s => s.status === STEP_STATES.DONE).length / execution.steps.length * 100
  );
  saveExecution(execution);

  return { execution };
}

// ============================================================
// CLI 入口
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

if (command === 'create') {
  const taskName = args.slice(1).join(' ') || '未命名任务';
  const result = createExecution(taskName);
  console.log(JSON.stringify(result, null, 2));
} else if (command === 'run' && args[1]) {
  console.log(JSON.stringify(runExecution(args[1], { continueOnError: args.includes('--continue') }), null, 2));
} else if (command === 'list') {
  console.log(JSON.stringify(listExecutions(), null, 2));
} else if (command === 'show' && args[1]) {
  console.log(JSON.stringify(loadExecution(args[1]), null, 2));
} else if (command === 'step' && args[1] && args[2]) {
  // 添加步骤: node execution-engine.js step <execId> <stepJson>
  const execution = loadExecution(args[1]);
  if (execution) {
    const step = JSON.parse(args.slice(2).join(' '));
    execution.steps.push({ id: `S${(execution.steps.length + 1).toString().padStart(3, '0')}`, status: STEP_STATES.PENDING, ...step });
    saveExecution(execution);
    console.log(JSON.stringify(execution, null, 2));
  }
} else {
  console.log(`execution-engine.js v1.0.0
用法:
  node execution-engine.js create <任务名>          创建执行任务
  node execution-engine.js run <execId> [--continue] 运行执行任务
  node execution-engine.js list                     列出所有执行
  node execution-engine.js show <execId>             查看执行详情
  node execution-engine.js step <execId> <stepJson>  添加步骤`);
}

module.exports = { createExecution, runExecution, executeStep, EXEC_STATES, STEP_STATES };
