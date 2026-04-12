#!/usr/bin/env node
// Gateway Diagnose - reads check results, outputs diagnoses, writes CSV row
const fs = require('fs');
const path = require('path');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const CSV_FILE = path.join(HEALTH_DIR, 'health.csv');
const STATE_FILE = path.join(HEALTH_DIR, 'state.json');

// Read last N check rows from CSV
function getLastCheckRows(n = 10) {
  try {
    const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
    if (lines.length <= 1) return [];
    const dataLines = lines.slice(1); // skip header
    const checks = [];
    for (let i = dataLines.length - 1; i >= 0 && checks.length < n; i--) {
      const cols = dataLines[i].split(',');
      if (cols[2] === 'check') checks.push(cols); // type = check
    }
    return checks;
  } catch { return []; }
}

// Read latest state
function getState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}

// Run diagnosis based on check data
function diagnose(checks, state) {
  const results = [];

  if (!state) {
    results.push({ code: 'UNKNOWN', msg: 'No state data available', severity: 'critical' });
    return results;
  }

  // Port not listening
  if (state.portStatus !== 'listening') {
    results.push({
      code: 'PORT_DOWN',
      msg: 'Port 18789 not listening - Gateway not running',
      severity: 'critical',
      hint: 'Kill stale process: Stop-Process -Id <pid> -Force; then pm2 restart openclaw'
    });
  }

  // RPC severe delay
  if (state.rpcMs > 500) {
    results.push({
      code: 'RPC_SLOW',
      msg: 'RPC latency >500ms (' + state.rpcMs + 'ms) - possible network or overload issue',
      severity: 'critical',
      hint: 'Check network; check gateway load; consider pm2 restart'
    });
  }

  // Config invalid
  if (!state.configValid) {
    results.push({
      code: 'CONFIG_INVALID',
      msg: 'Config file invalid or unreadable',
      severity: 'critical',
      hint: 'Restore from backup: git checkout HEAD -- .openclaw/openclaw.json'
    });
  }

  // Log errors
  if (state.logErrors > 0) {
    results.push({
      code: 'LOG_ERRORS',
      msg: state.logErrors + ' error(s) in recent logs (ECONNREFUSED/unhandledRejection/SIGTERM)',
      severity: 'degraded',
      hint: 'Review pm2 logs: pm2 logs openclaw --err --lines 50'
    });
  }

  // Bonjour stuck
  if (state.bonjourIssue) {
    results.push({
      code: 'BONJOUR_STUCK',
      msg: 'Bonjour mDNS advertising stuck - causes ~42s startup delay',
      severity: 'degraded',
      hint: 'Fix: add OPENCLAW_DISABLE_BONJOUR=1 to PM2 dump.pm2 env block'
    });
  }

  // Restart count surge detection
  if (checks.length >= 2) {
    const current = parseInt(checks[0][7]) || 0; // restartCount column
    const prev = parseInt(checks[1][7]) || 0;
    if (current > prev && current - prev >= 5) {
      results.push({
        code: 'RESTART_SURGE',
        msg: 'PM2 restart count surged by ' + (current - prev) + ' (was ' + prev + ', now ' + current + ')',
        severity: 'critical',
        hint: 'Check pm2 logs for crash reason; check for memory leak or OOM'
      });
    }
  }

  // Memory high
  if (state.memoryMB > 1500) {
    results.push({
      code: 'MEM_HIGH',
      msg: 'Memory usage high: ' + state.memoryMB + 'MB',
      severity: 'degraded',
      hint: 'Consider pm2 restart openclaw to free memory'
    });
  }

  return results;
}

// Main
const state = getState();
const checks = getLastCheckRows(5);
const diagnoses = diagnose(checks, state);

// Output to console
console.log('=== Gateway Diagnose ===');
console.log('Time: ' + (state ? state.lastCheck : 'unknown'));
console.log('Status: ' + (state ? state.status : 'unknown'));
console.log('Incident: ' + (state ? state.incidentId : 'none'));
console.log('');

if (diagnoses.length === 0) {
  console.log('No issues detected. Gateway appears healthy.');
} else {
  console.log('Issues found (' + diagnoses.length + '):');
  diagnoses.forEach((d, i) => {
    const sev = { critical: '🔴', degraded: '🟡' }[d.severity] || '⚪';
    console.log((i + 1) + '. ' + sev + ' ' + d.code + ': ' + d.msg);
    console.log('   Hint: ' + d.hint);
  });
}

// Write diagnose row to CSV
if (state && diagnoses.length > 0) {
  const row = [
    new Date().toISOString(),
    state.incidentId,
    'diagnose',
    state.status,
    state.rpcMs,
    state.memoryMB,
    state.portPID,
    state.restartCount,
    state.configValid,
    state.logErrors,
    state.bonjourIssue,
    diagnoses.map(d => d.code + ':' + d.msg).join('; '),
    diagnoses.map(d => d.code).join(';'),
    '', // fixes column (empty for diagnose)
    ''  // result column (empty for diagnose)
  ].join(',');

  fs.appendFileSync(CSV_FILE, row + '\n', 'utf8');
  console.log('');
  console.log('Diagnose record written to health.csv');
}

console.log('');
console.log('To fix: node gateway-fix.js');
