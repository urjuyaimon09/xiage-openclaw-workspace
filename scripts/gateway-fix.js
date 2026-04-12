#!/usr/bin/env node
// Gateway Fix - preplan-based fix with success count for auto-escalation
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const CSV_FILE = path.join(HEALTH_DIR, 'health.csv');
const STATE_FILE = path.join(HEALTH_DIR, 'state.json');
const FIX_LOG = path.join(HEALTH_DIR, 'fix-log.json');

// Init fix-log
if (!fs.existsSync(FIX_LOG)) {
  fs.writeFileSync(FIX_LOG, JSON.stringify({}, null, 2), 'utf8');
}

const PREPLANS = {
  BONJOUR_STUCK: [
    {
      id: 'A',
      desc: 'Add OPENCLAW_DISABLE_BONJOUR=1 to dump.pm2',
      successRate: 'high',
      exec: () => {
        const dumpPath = 'C:\\Users\\Administrator\\.pm2\\dump.pm2';
        let content = fs.readFileSync(dumpPath, 'utf8');
        if (content.includes('OPENCLAW_DISABLE_BONJOUR')) {
          return { ok: true, msg: 'Already set, no change needed', skipped: false };
        }
        if (content.includes('OPENCLAW_FEISHU_HTTP_TIMEOUT_MS')) {
          content = content.replace(
            /("OPENCLAW_FEISHU_HTTP_TIMEOUT_MS":\s*"[^"]+")/,
            '$1,\n        "OPENCLAW_DISABLE_BONJOUR": "1"'
          );
        } else {
          content = content.replace(/"env"\s*:\s*\{/, '{"env": {"OPENCLAW_DISABLE_BONJOUR": "1",');
        }
        fs.writeFileSync(dumpPath, content, 'utf8');
        return { ok: true, msg: 'OPENCLAW_DISABLE_BONJOUR=1 written to dump.pm2', skipped: false };
      }
    },
    {
      id: 'B',
      desc: 'Ignore - acceptable if Bonjour is not actively blocking',
      successRate: 'medium',
      exec: () => ({ ok: true, msg: 'Ignored by user', skipped: true })
    }
  ],

  PORT_DOWN: [
    {
      id: 'A',
      desc: 'Kill stale process + PM2 restart',
      successRate: 'high',
      exec: () => {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (state.portPID) {
          try { execSync('powershell -Command "Stop-Process -Id ' + state.portPID + ' -Force"', { timeout: 5000 }); } catch {}
        }
        try { execSync('cmd /c "pm2 restart openclaw"', { timeout: 10000 }); }
        catch (e) { return { ok: false, msg: 'PM2 restart failed: ' + e.message, skipped: false }; }
        return { ok: true, msg: 'Killed PID ' + state.portPID + ' and restarted PM2', skipped: false };
      }
    }
  ],

  CONFIG_INVALID: [
    {
      id: 'A',
      desc: 'Restore from .json.bak',
      successRate: 'high',
      exec: () => {
        const bak = 'C:\\Users\\Administrator\\.openclaw\\openclaw.json.bak';
        if (!fs.existsSync(bak)) return { ok: false, msg: 'No backup found', skipped: false };
        fs.copyFileSync(bak, 'C:\\Users\\Administrator\\.openclaw\\openclaw.json');
        return { ok: true, msg: 'Restored from backup', skipped: false };
      }
    }
  ],

  RPC_SLOW: [
    {
      id: 'A',
      desc: 'PM2 restart (clears RPC state)',
      successRate: 'medium',
      exec: () => {
        try { execSync('cmd /c "pm2 restart openclaw"', { timeout: 10000 }); }
        catch (e) { return { ok: false, msg: 'Restart failed: ' + e.message, skipped: false }; }
        return { ok: true, msg: 'PM2 restart triggered', skipped: false };
      }
    },
    {
      id: 'B',
      desc: 'No action - monitor only',
      successRate: 'low',
      exec: () => ({ ok: true, msg: 'No action taken', skipped: true })
    }
  ],

  RESTART_SURGE: [
    {
      id: 'A',
      desc: 'Extract PM2 error logs to file',
      successRate: 'high',
      exec: () => {
        try {
          execSync('cmd /c "pm2 logs openclaw --err --lines 30 > C:\\Users\\Administrator\\.openclaw\\logs\\restart-surge.log 2>&1"', { timeout: 10000 });
          return { ok: true, msg: 'Logs saved to logs\\restart-surge.log', skipped: false };
        } catch (e) { return { ok: false, msg: 'Failed: ' + e.message, skipped: false }; }
      }
    }
  ],

  LOG_ERRORS: [
    {
      id: 'A',
      desc: 'No auto-fix - manual review required',
      successRate: 'low',
      exec: () => ({ ok: true, msg: 'Manual review required', skipped: true })
    }
  ],

  MEM_HIGH: [
    {
      id: 'A',
      desc: 'PM2 restart to free memory',
      successRate: 'high',
      exec: () => {
        try { execSync('cmd /c "pm2 restart openclaw"', { timeout: 10000 }); }
        catch (e) { return { ok: false, msg: 'Restart failed: ' + e.message, skipped: false }; }
        return { ok: true, msg: 'PM2 restart triggered', skipped: false };
      }
    }
  ]
};

function loadFixLog() { try { return JSON.parse(fs.readFileSync(FIX_LOG, 'utf8')); } catch { return {}; } }
function saveFixLog(log) { fs.writeFileSync(FIX_LOG, JSON.stringify(log, null, 2), 'utf8'); }

function recordResult(problemCode, planId, ok) {
  const log = loadFixLog();
  const key = problemCode + ':' + planId;
  if (!log[key]) log[key] = { successes: 0, failures: 0, auto: false };
  if (ok) log[key].successes++;
  else log[key].failures++;
  if (log[key].successes >= 2 && log[key].failures === 0) log[key].auto = true;
  if (log[key].failures > 0) { log[key].auto = false; log[key].successes = 0; }
  saveFixLog(log);
  return log[key];
}

function isAuto(problemCode, planId) {
  return !!((loadFixLog()[problemCode + ':' + planId] || {}).auto);
}

function getLatestDiagnose() {
  try {
    const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = lines[i].split(',');
      if (cols[2] === 'diagnose') return cols;
    }
    return null;
  } catch { return null; }
}

function parseDiagnoses(diagnoseRow) {
  const diagCol = diagnoseRow[12] || '';
  if (!diagCol) return [];
  return diagCol.split(';').filter(Boolean).map(d => {
    const [code, ...msgParts] = d.split(':');
    return { code: code.trim(), msg: msgParts.join(':').trim() };
  });
}

function getState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; } }

function writeFixRow(state, diag, plan, result) {
  const row = [
    new Date().toISOString(),
    state.incidentId,
    'fix',
    state.status,
    state.rpcMs,
    state.memoryMB,
    state.portPID,
    state.restartCount,
    state.configValid,
    state.logErrors,
    state.bonjourIssue,
    diag.code + ':' + diag.msg,
    plan.id + ':' + plan.desc,
    plan.id + ':' + plan.desc,
    result.ok ? (result.skipped ? 'skipped' : 'applied') : 'failed'
  ].join(',');
  fs.appendFileSync(CSV_FILE, row + '\n', 'utf8');
}

const state = getState();
const latestDiag = getLatestDiagnose();
const fixLog = loadFixLog();

console.log('=== Gateway Fix ===');
console.log('Time: ' + new Date().toISOString());
console.log('Incident: ' + (state ? state.incidentId : 'unknown'));
console.log('');

if (!latestDiag) {
  console.log('No diagnose found. Run gateway-diagnose.js first.');
  process.exit(0);
}

const diagnoses = parseDiagnoses(latestDiag);
if (diagnoses.length === 0) {
  console.log('No issues to fix. Gateway appears healthy.');
  process.exit(0);
}

// Build choices with preplans
const choices = diagnoses.map(diag => {
  const preplans = PREPLANS[diag.code] || [];
  const bestPlan = preplans.find(p => isAuto(diag.code, p.id)) || preplans[0] || null;
  return { diag, preplans, bestPlan };
});

// Auto-apply all [AUTO] plans
const autoItems = choices.filter(c => c.bestPlan && isAuto(c.diag.code, c.bestPlan.id));

if (autoItems.length > 0) {
  console.log('[AUTO] fixes ready (' + autoItems.length + '):');
  autoItems.forEach(({ diag, bestPlan }, i) => {
    const logEntry = fixLog[diag.code + ':' + bestPlan.id] || {};
    console.log((i + 1) + '. ' + diag.code + ' --> [' + bestPlan.id + '] ' + bestPlan.desc + ' (success:' + logEntry.successes + ', [AUTO])');
  });
  console.log('');
  console.log('=== Auto-applying ===');
  autoItems.forEach(({ diag, bestPlan }) => {
    console.log('[' + diag.code + '] ' + bestPlan.desc + '...');
    const result = bestPlan.exec();
    console.log('  --> ' + (result.ok ? 'OK' : 'FAILED') + ': ' + result.msg);
    writeFixRow(state, diag, bestPlan, result);
    recordResult(diag.code, bestPlan.id, result.ok);
  });
  console.log('Done. Run gateway-health.js to verify.');
  process.exit(0);
}

// No auto plans - show manual options
console.log('No [AUTO] plans. Manual options:');
console.log('');
choices.forEach(({ diag, preplans, bestPlan }, i) => {
  console.log((i + 1) + '. ' + diag.code + ': ' + diag.msg);
  preplans.forEach(p => {
    const logEntry = fixLog[diag.code + ':' + p.id] || {};
    const tag = p.id === bestPlan.id ? ' (recommended)' : '';
    const autoTag = isAuto(diag.code, p.id) ? ' [AUTO]' : '';
    console.log('   [' + p.id + '] ' + p.desc + ' (ok:' + logEntry.successes + ', fail:' + logEntry.failures + ')' + autoTag + tag);
  });
  console.log('');
});
console.log('Run with --apply to execute recommended plans.');
console.log('');
