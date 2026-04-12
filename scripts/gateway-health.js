#!/usr/bin/env node
// Gateway Health Check
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const STATE_FILE = path.join(HEALTH_DIR, 'health-state.json');
const EVENTS_FILE = path.join(HEALTH_DIR, 'health-events.json');
const DAILY_FILE = path.join(HEALTH_DIR, 'health-daily.json');

if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events: [] }), 'utf8');
if (!fs.existsSync(DAILY_FILE)) fs.writeFileSync(DAILY_FILE, JSON.stringify({ daily: [] }), 'utf8');

let prevState = null;
if (fs.existsSync(STATE_FILE)) { try { prevState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {} }

const result = {
  timestamp: new Date().toISOString(),
  rpcMs: null,
  memoryMB: null,
  portStatus: null,
  portPID: null,
  restartCount: null,
  configValid: false,
  logErrors: 0,
  bonjourIssue: false,
  status: 'unknown',
  issues: []
};

// 1. PM2
try {
  const pj = JSON.parse(execSync('cmd /c pm2 jlist', { encoding: 'utf8', timeout: 5000 }));
  const openclaw = pj.find(x => x.name === 'openclaw');
  if (openclaw) {
    result.memoryMB = Math.round(openclaw.monit.memory / 1048576 * 10) / 10;
    result.restartCount = openclaw.pm2_env.restart_time;
  }
} catch (e) { result.issues.push('PM2 query failed'); }

// 2. Port
try {
  const out = execSync('netstat -ano | findstr :18789.*LISTENING', { encoding: 'utf8', timeout: 5000 });
  const m = out.match(/LISTENING\s+(\d+)/);
  if (m) { result.portPID = parseInt(m[1]); result.portStatus = 'listening'; }
} catch {}
if (!result.portStatus) { result.portStatus = 'not_listening'; result.issues.push('Port 18789 not listening'); }

// 3. RPC - use stopwatch to time TCP connect, bypassing PowerShell startup overhead
try {
  const swStart = Date.now();
  const net = require('net');
  const sock = new net.Socket();
  sock.connect(18789, '127.0.0.1', () => {
    sock.destroy();
  });
  sock.on('error', () => { sock.destroy(); });
  result.rpcMs = Date.now() - swStart;
} catch (e) {
  result.issues.push('RPC failed');
}

// 4. Config
try {
  const cfgPath = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'openclaw', 'openclaw.json');
  if (fs.existsSync(cfgPath)) { JSON.parse(fs.readFileSync(cfgPath, 'utf8')); result.configValid = true; }
} catch {}

// 5. Logs - only count recent errors (last 1h), exclude benign startup UNAVAILABLE
const logRoots = [
  path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'openclaw', 'logs'),
  'C:\\Users\\Administrator\\.pm2\\logs'
];
const oneHourAgo = Date.now() - 3600000;
for (const lp of logRoots) {
  if (!fs.existsSync(lp)) continue;
  for (const f of fs.readdirSync(lp)) {
    if (!f.endsWith('.log')) continue;
    const fp = path.join(lp, f);
    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
      if (!tsMatch) continue;
      const logTime = new Date(tsMatch[1] + ':00+08:00');
      if (isNaN(logTime.getTime())) continue;
      if (logTime.getTime() < oneHourAgo) continue;
      // Only count real errors
      if (/ECONNREFUSED|unhandledRejection|SIGTERM/.test(line)) { result.logErrors++; break; }
    }
  }
}
if (result.logErrors > 0) result.issues.push('Log errors found');

// 6. Bonjour - only check recent PM2 log entries (last 50 lines, current gateway)
try {
  const logs = execSync('pm2 logs --nostream --lines 50 --raw', { encoding: 'utf8', timeout: 5000 });
  const lines = logs.split('\n').slice(0, 30); // only recent entries
  const recentLogs = lines.join('\n');
  if (/stuck announcing.*\d{6,}ms/.test(recentLogs)) {
    result.bonjourIssue = true; result.issues.push('Bonjour delay');
  }
} catch {}

// Status
if (result.portStatus !== 'listening') result.status = 'critical';
else if (result.rpcMs > 500 || result.logErrors > 5) result.status = 'critical';
else if (result.rpcMs > 200 || result.logErrors > 0 || result.bonjourIssue) result.status = 'degraded';
else result.status = 'healthy';

// Write state
fs.writeFileSync(STATE_FILE, JSON.stringify({
  lastCheck: result.timestamp,
  status: result.status,
  rpcMs: result.rpcMs,
  memoryMB: result.memoryMB,
  portPID: result.portPID,
  restartCount: result.restartCount,
  configValid: result.configValid,
  logErrors: result.logErrors,
  issues: result.issues
}, null, 2), 'utf8');

// Write event (status change only)
const changed = !prevState || prevState.status !== result.status;
if (changed) {
  let events = [];
  try { events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8')).events; } catch {}
  events = events.filter(e => new Date(e.time).getTime() > Date.now() - 7 * 86400000);
  events.push({
    time: result.timestamp,
    from: prevState ? prevState.status : 'none',
    to: result.status,
    rpcMs: result.rpcMs,
    issue: result.issues.length ? result.issues.join(', ') : null
  });
  fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events }, null, 2), 'utf8');
}

// Write daily
const today = new Date().toISOString().slice(0, 10);
let dailyList = [];
try { dailyList = JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8')).daily; } catch {}
let te = dailyList.find(d => d.date === today);
if (te) {
  te.rpcAvg = Math.round((te.rpcAvg * te.count + result.rpcMs) / (te.count + 1) * 10) / 10;
  te.memAvg = Math.round((te.memAvg * te.count + result.memoryMB) / (te.count + 1) * 10) / 10;
  te.count++;
  if (result.status !== 'healthy') te.issueCount++;
  if (result.status === 'critical') te.criticalCount++;
  if (result.restartCount > te.maxRestartCount) te.maxRestartCount = result.restartCount;
} else {
  dailyList = dailyList.filter(d => new Date(d.date).getTime() > Date.now() - 7 * 86400000);
  dailyList.push({
    date: today,
    rpcAvg: result.rpcMs,
    memAvg: result.memoryMB,
    count: 1,
    issueCount: result.status !== 'healthy' ? 1 : 0,
    criticalCount: result.status === 'critical' ? 1 : 0,
    maxRestartCount: result.restartCount
  });
}
fs.writeFileSync(DAILY_FILE, JSON.stringify({ daily: dailyList }, null, 2), 'utf8');

// Output
const emoji = { healthy: [206, 157, 162], degraded: [206, 157, 177], critical: [226, 148, 141], unknown: [226, 154, 170] };
const e = String.fromCodePoint(...emoji[result.status]);
const iss = result.issues.length ? ' | Issues: ' + result.issues.join(', ') : '';
console.log(e + ' ' + result.status.toUpperCase() + ' | RPC: ' + result.rpcMs + 'ms | Mem: ' + result.memoryMB + 'MB | Restarts: ' + result.restartCount + iss);
