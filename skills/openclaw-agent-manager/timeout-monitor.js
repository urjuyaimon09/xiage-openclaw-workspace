/**
 * openclaw-agent-manager/timeout-monitor.js
 * 120s 超时自动后台化监控器
 *
 * 监控正在运行的子 agent session，
 * 如果运行超过指定时间未完成，自动触发后台化通知。
 *
 * 驱动方式：作为 cron job 或定时检查循环运行
 *
 * 用法：
 *   node timeout-monitor.js check <sessionId> <thresholdMs>
 *   node timeout-monitor.js watch <intervalMs>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// OpenClaw session 目录
const SESSIONS_DIR = path.join(
  process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
  '.openclaw',
  'agents',
  'main',
  'sessions'
);

const [, , cmd, ...args] = process.argv;

if (cmd === 'check') {
  const sessionId = args[0];
  const thresholdMs = parseInt(args[1] || '120000', 10);
  checkAndMarkTimeout(sessionId, thresholdMs).then(r => {
    console.log(JSON.stringify(r));
    process.exit(0);
  }).catch(e => {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  });
} else if (cmd === 'watch') {
  const intervalMs = parseInt(args[0] || '30000', 10);
  startWatcher(intervalMs);
} else {
  console.error('用法: timeout-monitor.js check <sessionId> <thresholdMs> | watch <intervalMs>');
  process.exit(1);
}

/**
 * 检查指定 session 是否超时
 * @param {string} sessionId
 * @param {number} thresholdMs
 * @returns {{sessionId, timedOut: boolean, elapsedMs: number, status: string}}
 */
async function checkAndMarkTimeout(sessionId, thresholdMs) {
  const sessionPath = findSessionPath(sessionId);
  if (!sessionPath) {
    return { sessionId, timedOut: false, status: 'not_found' };
  }

  const stats = fs.statSync(sessionPath);
  const elapsedMs = Date.now() - stats.mtimeMs;
  const timedOut = elapsedMs > thresholdMs;

  return {
    sessionId,
    timedOut,
    elapsedMs: Math.round(elapsedMs),
    thresholdMs,
    status: timedOut ? 'timed_out' : 'running',
    sessionPath: sessionPath.replace(process.env.APPDATA || '', 'APPDATA')
  };
}

/**
 * 查找 session 对应的目录
 */
function findSessionPath(sessionId) {
  if (!fs.existsSync(SESSIONS_DIR)) return null;

  const entries = fs.readdirSync(SESSIONS_DIR);
  const found = entries.find(e => e.startsWith(sessionId) || e === sessionId);
  if (!found) return null;

  const fullPath = path.join(SESSIONS_DIR, found);
  const stat = fs.statSync(fullPath);
  return stat.isDirectory() ? fullPath : null;
}

/**
 * 启动定时监控循环
 * 检查所有活跃 session，对超时的 session 触发后台化
 */
function startWatcher(intervalMs) {
  console.log(`[timeout-monitor] Watching every ${intervalMs}ms`);
  console.log(`[timeout-monitor] Sessions dir: ${SESSIONS_DIR}`);

  setInterval(() => {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) return;

      const entries = fs.readdirSync(SESSIONS_DIR).filter(e => {
        try {
          const stat = fs.statSync(path.join(SESSIONS_DIR, e));
          return stat.isDirectory() && (Date.now() - stat.mtimeMs) < 86400000; // 24h 内活跃
        } catch { return false; }
      });

      let timedOutCount = 0;
      for (const entry of entries) {
        const fullPath = path.join(SESSIONS_DIR, entry);
        const elapsed = Date.now() - fs.statSync(fullPath).mtimeMs;

        // 默认 120s 超时（auto-background 阈值）
        if (elapsed > 120000) {
          timedOutCount++;
          console.log(`[timeout-monitor] TIMED OUT: ${entry} (${Math.round(elapsed / 1000)}s)`);
        }
      }

      if (timedOutCount > 0) {
        console.log(`[timeout-monitor] ${timedOutCount} session(s) timed out`);
      }
    } catch (e) {
      console.error(`[timeout-monitor] Error: ${e.message}`);
    }
  }, intervalMs);
}

module.exports = { checkAndMarkTimeout };
