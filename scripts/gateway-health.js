#!/usr/bin/env node
// Gateway Health Check - CSV output with incident_id + warnings (third tier)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const CSV_FILE = path.join(HEALTH_DIR, 'health.csv');
const STATE_FILE = path.join(HEALTH_DIR, 'state.json');

const CSV_HEADER = 'time,incident_id,type,status,rpcMs,memoryMB,portPID,restartCount,configValid,logErrors,bonjourIssue,warnings';

if (!fs.existsSync(CSV_FILE)) {
  fs.writeFileSync(CSV_FILE, CSV_HEADER + '\n', 'utf8');
}

function getLastIncidentId() {
  try {
    const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
    if (lines.length <= 1) return null;
    const last = lines[lines.length - 1].split(',');
    return last[1] || null;
  } catch { return null; }
}

function genIncidentId(lastId) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  if (!lastId) return 'INC-' + today + '-001';
  const [, datePart, seqPart] = lastId.match(/^(INC-\d{8})-(\d+)$/) || [];
  if (datePart !== 'INC-' + today) return 'INC-' + today + '-001';
  return 'INC-' + today + '-' + String(parseInt(seqPart) + 1).padStart(3, '0');
}

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
  warnings: [],
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

// 3. RPC
try {
  const sw = Date.now();
  const net = require('net');
  const sock = new net.Socket();
  sock.connect(18789, '127.0.0.1', () => { sock.destroy(); });
  sock.on('error', () => { sock.destroy(); });
  result.rpcMs = Date.now() - sw;
} catch { result.issues.push('RPC failed'); }

// 4. Config
try {
  const cfgPath = 'C:\\Users\\Administrator\\.openclaw\\openclaw.json';
  if (fs.existsSync(cfgPath)) { JSON.parse(fs.readFileSync(cfgPath, 'utf8')); result.configValid = true; }
} catch {}

// Helper: parse timestamps in PM2 log lines (may have prefix like "0|openclaw  | ")
function parseLogTimestamp(line) {
  const m = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  return new Date(m[1] + ':00+08:00');
}

// Helper: scan a log file for patterns within time window
function scanLog(fp, patterns) {
  const content = fs.readFileSync(fp, 'utf8');
  const lines = content.split('\n');
  const counts = {};
  const oneHourAgo = Date.now() - 3600000;
  for (const line of lines) {
    const ts = parseLogTimestamp(line);
    if (ts && ts.getTime() < oneHourAgo) continue;
    for (const [key, pat] of Object.entries(patterns)) {
      if (pat.test(line)) { counts[key] = (counts[key] || 0) + 1; }
    }
  }
  return counts;
}

const logRoots = [
  'C:\\Users\\Administrator\\.pm2\\logs',
  path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'openclaw', 'logs')
];

// 5. Critical log errors
const errorPatterns = {
  errors: /ECONNREFUSED|unhandledRejection|SIGTERM/
};
const warningPatterns = {
  feishu_400: /Create card request failed with HTTP 400|streaming start failed.*400/,
  skills_skip: /Skipping skill path that resolves outside/,

};

for (const lp of logRoots) {
  if (!fs.existsSync(lp)) continue;
  for (const f of fs.readdirSync(lp)) {
    if (!f.endsWith('.log')) continue;
    const fp = path.join(lp, f);
    const counts = scanLog(fp, { ...errorPatterns, ...warningPatterns });
    if (counts.errors) result.logErrors += counts.errors;
    if (counts.feishu_400) result.warnings.push('feishu_400:' + counts.feishu_400);
    if (counts.skills_skip) result.warnings.push('skills_skip:' + counts.skills_skip);
  }
}
if (result.logErrors > 0) result.issues.push('Log errors found');

// 6. Bonjour (recent only from pm2 logs)
try {
  const logs = execSync('pm2 logs --nostream --lines 30 --raw', { encoding: 'utf8', timeout: 5000 });
  const recentLines = logs.split('\n').slice(0, 15).join('\n');
  if (/stuck announcing.*\d{6,}ms/.test(recentLines)) {
    result.bonjourIssue = true; result.issues.push('Bonjour delay');
  }
} catch {}

// Status
if (result.portStatus !== 'listening') result.status = 'critical';
else if (result.rpcMs > 500 || result.logErrors > 5) result.status = 'critical';
else if (result.rpcMs > 200 || result.logErrors > 0 || result.bonjourIssue) result.status = 'degraded';
else result.status = 'healthy';

// Incident_id
const lastId = getLastIncidentId();
let prevStatus = null;
try {
  const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
  if (lines.length > 1) prevStatus = lines[lines.length - 1].split(',')[2] || null;
} catch {}

const incidentId = (result.status !== 'healthy' && prevStatus === 'healthy') || !lastId
  ? genIncidentId(lastId)
  : (result.status !== 'healthy' ? lastId : (lastId || genIncidentId(null)));

const warningsStr = result.warnings.join(';');
const issuesStr = result.issues.join(';');

const csvRow = [
  result.timestamp,
  incidentId,
  'check',
  result.status,
  result.rpcMs,
  result.memoryMB,
  result.portPID,
  result.restartCount,
  result.configValid,
  result.logErrors,
  result.bonjourIssue,
  warningsStr
].join(',');

fs.appendFileSync(CSV_FILE, csvRow + '\n', 'utf8');

const state = {
  lastCheck: result.timestamp,
  incidentId: incidentId,
  status: result.status,
  rpcMs: result.rpcMs,
  memoryMB: result.memoryMB,
  portPID: result.portPID,
  portStatus: result.portStatus,
  restartCount: result.restartCount,
  configValid: result.configValid,
  logErrors: result.logErrors,
  bonjourIssue: result.bonjourIssue,
  warnings: result.warnings,
  issues: result.issues
};
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

// 7-day clean
try {
  const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
  const header = lines[0];
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const validLines = lines.filter((line, i) => {
    if (i === 0) return true;
    const ts = line.split(',')[0];
    return new Date(ts).getTime() > sevenDaysAgo;
  });
  fs.writeFileSync(CSV_FILE, validLines.join('\n') + '\n', 'utf8');
} catch {}

// Output
const emoji = { healthy: [206, 157, 162], degraded: [206, 157, 177], critical: [226, 148, 141], unknown: [226, 154, 170] };
const e = String.fromCodePoint(...emoji[result.status]);
const warnStr = result.warnings.length ? ' | Warnings: ' + result.warnings.join(', ') : '';
const iss = result.issues.length ? ' | Issues: ' + result.issues.join(', ') : '';
console.log(e + ' ' + result.status.toUpperCase() + ' | RPC: ' + result.rpcMs + 'ms | Mem: ' + result.memoryMB + 'MB | Restarts: ' + result.restartCount + ' | INC: ' + incidentId + warnStr + iss);
