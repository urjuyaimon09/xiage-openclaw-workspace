/**
 * openclaw-agent-manager/lifecycle.js
 * Agent 生命周期管理 — 四种输出状态
 *
 * 四种输出状态：
 *   completed  — 同步/异步执行成功完成
 *   failed     — 执行失败（错误退出）
 *   timed_out  — 执行超时被终止
 *   cancelled  — 被主动取消
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// OpenClaw sessions 目录
const SESSIONS_DIR = path.join(
  process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
  '.openclaw',
  'agents',
  'main',
  'sessions'
);

// OpenClaw 路径
const OPENCLAW_PATH = require.resolve('openclaw', {
  paths: ['C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules']
});

/**
 * 获取 session 的生命周期状态
 * @param {string} sessionId
 * @returns {{status: string, details: object}}
 */
async function getLifecycleStatus(sessionId) {
  const sessionPath = findSessionPath(sessionId);
  if (!sessionPath) {
    return { status: 'unknown', details: { reason: 'session not found' } };
  }

  const metaPath = path.join(sessionPath, 'meta.json');
  const transcriptPath = findLatestTranscript(sessionPath);

  let meta = {};
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }

  const stats = fs.statSync(sessionPath);
  const ageMs = Date.now() - stats.mtimeMs;

  // 判断状态
  let status = 'running';
  if (meta.exitCode !== undefined && meta.exitCode !== null) {
    status = meta.exitCode === 0 ? 'completed' : 'failed';
  } else if (ageMs > 300000) { // 5min 无响应视为超时
    status = 'timed_out';
  }

  return {
    status,
    sessionId,
    ageMs: Math.round(ageMs),
    exitCode: meta.exitCode || null,
    transcriptPath: transcriptPath ? path.basename(transcriptPath) : null,
    lastActivity: new Date(stats.mtime).toISOString()
  };
}

/**
 * 终止指定 session
 * @param {string} sessionId
 */
async function killSession(sessionId) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [
      OPENCLAW_PATH,
      'sessions', 'kill', sessionId
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true
    });

    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code === 0) {
        resolve({ status: 'cancelled', sessionId, output: stdout.trim() });
      } else {
        reject(new Error(`kill failed: ${stderr || stdout}`));
      }
    });

    proc.on('error', reject);
    setTimeout(() => { proc.kill(); reject(new Error('kill timeout')); }, 10000);
  });
}

/**
 * 收集 session 的输出结果
 * @param {string} sessionId
 */
async function collectResult(sessionId) {
  const status = await getLifecycleStatus(sessionId);
  const sessionPath = findSessionPath(sessionId);

  if (!sessionPath) {
    return { ...status, result: null };
  }

  const transcriptPath = findLatestTranscript(sessionPath);
  let result = null;

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
    // 取最后一条 assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const msg = JSON.parse(lines[i]);
        if (msg.role === 'assistant' && msg.content) {
          result = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          break;
        }
      } catch {}
    }
  }

  return { ...status, result };
}

/**
 * 找到最新的 transcript 文件
 */
function findLatestTranscript(sessionPath) {
  if (!fs.existsSync(sessionPath)) return null;

  const files = fs.readdirSync(sessionPath)
    .filter(f => f.startsWith('transcript-') && f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(sessionPath, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? path.join(sessionPath, files[0].name) : null;
}

/**
 * 找到 session 对应的目录
 */
function findSessionPath(sessionId) {
  if (!fs.existsSync(SESSIONS_DIR)) return null;
  const entries = fs.readdirSync(SESSIONS_DIR);
  const found = entries.find(e => e.startsWith(sessionId) || e.includes(sessionId));
  return found ? path.join(SESSIONS_DIR, found) : null;
}

/**
 * 清理所有 zombie sessions
 * @param {string[]} excludeIds
 */
async function cleanupZombies(excludeIds = []) {
  if (!fs.existsSync(SESSIONS_DIR)) return { cleaned: 0 };

  const entries = fs.readdirSync(SESSIONS_DIR).filter(e => {
    try {
      const stat = fs.statSync(path.join(SESSIONS_DIR, e));
      return stat.isDirectory();
    } catch { return false; }
  });

  let cleaned = 0;
  const excludeSet = new Set(excludeIds);

  for (const entry of entries) {
    if (excludeSet.has(entry)) continue;
    const sessionId = entry.split('.')[0].split('-')[0];
    if (excludeSet.has(sessionId)) continue;

    const status = await getLifecycleStatus(sessionId);
    if (status.status === 'completed' || status.status === 'failed' || status.status === 'timed_out') {
      try {
        await killSession(sessionId);
        cleaned++;
      } catch {}
    }
  }

  return { cleaned };
}

module.exports = { getLifecycleStatus, killSession, collectResult, cleanupZombies };
