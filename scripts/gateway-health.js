#!/usr/bin/env node
// Gateway Health Check - CSV output with incident_id
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const CSV_FILE = path.join(HEALTH_DIR, 'health.csv');
const STATE_FILE = path.join(HEALTH_DIR, 'state.json');

// CSV header
const CSV_HEADER = 'time,incident_id,type,status,rpcMs,memoryMB,portPID,restartCount,configValid,logErrors,bonjourIssue,issues';

// Init CSV
if (!fs.existsSync(CSV_FILE)) {
  fs.writeFileSync(CSV_FILE, CSV_HEADER + '\n', 'utf8');
}

// Get last incident_id from CSV
function getLastIncidentId() {
  try {
    const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
    if (lines.length <= 1) return null;
    const last = lines[lines.length - 1].split(',');
    return last[1] || null; // incident_id is column 1
  } catch { return null; }
}

// Generate new incident_id
function genIncidentId(lastId) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  if (!lastId) return 'INC-' + today + '-001';
  const [, datePart, seqPart] = lastId.match(/^(INC-\d{8})-(\d+)$/) || [];
  if (datePart !== 'INC-' + today) return 'INC-' + today + '-001';
  return 'INC-' + today + '-' + String(parseInt(seqPart) + 1).padStart(3, '0');
}

// Diagnosis
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

// 5. Logs (recent errors only)
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
      if (/ECONNREFUSED|unhandledRejection|SIGTERM/.test(line)) { result.logErrors++; break; }
    }
  }
}
if (result.logErrors > 0) result.issues.push('Log errors found');

// 6. Bonjour (recent only)
try {
  const logs = execSync('pm2 logs --nostream --lines 30 --raw', { encoding: 'utf8', timeout: 5000 });
  const recent = logs.split('\n').slice(0, 15).join('\n');
  if (/stuck announcing.*\d{6,}ms/.test(recent)) {
    result.bonjourIssue = true; result.issues.push('Bonjour delay');
  }
} catch {}

// Status
if (result.portStatus !== 'listening') result.status = 'critical';
else if (result.rpcMs > 500 || result.logErrors > 5) result.status = 'critical';
else if (result.rpcMs > 200 || result.logErrors > 0 || result.bonjourIssue) result.status = 'degraded';
else result.status = 'healthy';

// Determine incident_id
const lastId = getLastIncidentId();
const prevStatus = (() => {
  try {
    const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
    if (lines.length <= 1) return null;
    const last = lines[lines.length - 1].split(',');
    return last[2] || null; // status is column 2
  } catch { return null; }
})();

// If status changed to unhealthy, generate new incident_id; otherwise reuse last one
const incidentId = (result.status !== 'healthy' && prevStatus === 'healthy') || !lastId
  ? genIncidentId(lastId)
  : (result.status !== 'healthy' ? lastId : (lastId || genIncidentId(null)));

const issuesStr = result.issues.join('; ');

// Append CSV row
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
  issuesStr
].join(',');

fs.appendFileSync(CSV_FILE, csvRow + '\n', 'utf8');

// Update state.json
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
  issues: result.issues
};
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

// Clean old rows (>7 days) from CSV (keep header)
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
const iss = result.issues.length ? ' | Issues: ' + result.issues.join(', ') : '';
console.log(e + ' ' + result.status.toUpperCase() + ' | RPC: ' + result.rpcMs + 'ms | Mem: ' + result.memoryMB + 'MB | Restarts: ' + result.restartCount + ' | INC: ' + incidentId + iss);
