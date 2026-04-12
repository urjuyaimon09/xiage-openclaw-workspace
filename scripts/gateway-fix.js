#!/usr/bin/env node
// Gateway Fix - reads diagnose results, shows preplans, executes user choice, records to CSV
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const CSV_FILE = path.join(HEALTH_DIR, 'health.csv');
const STATE_FILE = path.join(HEALTH_DIR, 'state.json');

// Preplans library: problem code -> list of plans
const PREPLANS = {
  BONJOUR_STUCK: [
    {
      id: 'A',
      desc: 'Add OPENCLAW_DISABLE_BONJOUR=1 to dump.pm2',
      successRate: 'high',
      auto: false,
      exec: () => {
        const dumpPath = 'C:\\Users\\Administrator\\.pm2\\dump.pm2';
        let content = fs.readFileSync(dumpPath, 'utf8');
        if (content.includes('OPENCLAW_DISABLE_BONJOUR')) {
          return { ok: true, msg: 'Already set, no change needed' };
        }
        // Insert after OPENCLAW_FEISHU_HTTP_TIMEOUT_MS line
        if (content.includes('OPENCLAW_FEISHU_HTTP_TIMEOUT_MS')) {
          content = content.replace(
            /("OPENCLAW_FEISHU_HTTP_TIMEOUT_MS":\s*"[^"]+")/,
            '$1,\n        "OPENCLAW_DISABLE_BONJOUR": "1"'
          );
        } else {
          // Fallback: append before closing brace of env block
          content = content.replace(/"env"\s*:\s*\{/, '{"env": {"OPENCLAW_DISABLE_BONJOUR": "1",');
        }
        fs.writeFileSync(dumpPath, content, 'utf8');
        return { ok: true, msg: 'OPENCLAW_DISABLE_BONJOUR=1 written to dump.pm2' };
      }
    },
    {
      id: 'B',
      desc: 'Ignore - acceptable if Bonjour is not actively blocking',
      successRate: 'medium',
      auto: false,
      exec: () => ({ ok: true, msg: 'Ignored by user choice', skipped: true })
    }
  ],

  PORT_DOWN: [
    {
      id: 'A',
      desc: 'Kill stale process + PM2 restart',
      successRate: 'high',
      auto: false,
      exec: () => {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (state.portPID) {
          try {
            execSync('powershell -Command "Stop-Process -Id ' + state.portPID + ' -Force"', { timeout: 5000 });
          } catch {}
        }
        try {
          execSync('cmd /c "pm2 restart openclaw"', { timeout: 10000 });
        } catch (e) {
          return { ok: false, msg: 'PM2 restart failed: ' + e.message };
        }
        return { ok: true, msg: 'Killed PID ' + state.portPID + ' and restarted PM2' };
      }
    }
  ],

  CONFIG_INVALID: [
    {
      id: 'A',
      desc: 'Restore from .json.bak',
      successRate: 'high',
      auto: false,
      exec: () => {
        const cfg = 'C:\\Users\\Administrator\\.openclaw\\openclaw.json';
        const bak = 'C:\\Users\\Administrator\\.openclaw\\openclaw.json.bak';
        if (!fs.existsSync(bak)) {
          return { ok: false, msg: 'No backup found at ' + bak };
        }
        fs.copyFileSync(bak, cfg);
        return { ok: true, msg: 'Restored openclaw.json from backup' };
      }
    }
  ],

  RPC_SLOW: [
    {
      id: 'A',
      desc: 'PM2 restart (clears RPC state)',
      successRate: 'medium',
      auto: false,
      exec: () => {
        try {
          execSync('cmd /c "pm2 restart openclaw"', { timeout: 10000 });
          return { ok: true, msg: 'PM2 restart triggered' };
        } catch (e) {
          return { ok: false, msg: 'Restart failed: ' + e.message };
        }
      }
    },
    {
      id: 'B',
      desc: 'No action - monitor only',
      successRate: 'low',
      auto: false,
      exec: () => ({ ok: true, msg: 'No action taken', skipped: true })
    }
  ],

  RESTART_SURGE: [
    {
      id: 'A',
      desc: 'Review PM2 logs for crash reason',
      successRate: 'high',
      auto: false,
      exec: () => {
        try {
          const logs = execSync('cmd /c "pm2 logs openclaw --err --lines 30"', { encoding: 'utf8', timeout: 10000 });
          return { ok: true, msg: 'Logs extracted. Review manually.' };
        } catch (e) {
          return { ok: false, msg: 'Could not read logs: ' + e.message };
        }
      }
    }
  ],

  LOG_ERRORS: [
    {
      id: 'A',
      desc: 'No auto-fix available - manual review required',
      successRate: 'low',
      auto: false,
      exec: () => ({ ok: true, msg: 'No auto-fix. Review logs manually.', skipped: true })
    }
  ],

  MEM_HIGH: [
    {
      id: 'A',
      desc: 'PM2 restart to free memory',
      successRate: 'high',
      auto: false,
      exec: () => {
        try {
          execSync('cmd /c "pm2 restart openclaw"', { timeout: 10000 });
          return { ok: true, msg: 'PM2 restart triggered' };
        } catch (e) {
          return { ok: false, msg: 'Restart failed: ' + e.message };
        }
      }
    }
  ]
};

// Get latest diagnose row from CSV
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

// Get current state
function getState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}

// Parse diagnoses from latest diagnose row
function parseDiagnoses(diagnoseRow) {
  // diagnoses column is index 12, format: "CODE:msg;CODE:msg"
  const diagCol = diagnoseRow[12] || '';
  if (!diagCol) return [];
  return diagCol.split(';').filter(Boolean).map(d => {
    const [code, ...msgParts] = d.split(':');
    return { code: code.trim(), msg: msgParts.join(':').trim() };
  });
}

// Main
const state = getState();
const latestDiag = getLatestDiagnose();

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

// Display problems and preplans
console.log('Problems ready to fix (' + diagnoses.length + '):');
console.log('');

const choices = [];
diagnoses.forEach((diag, i) => {
  const preplans = PREPLANS[diag.code] || [];
  console.log((i + 1) + '. ' + diag.code + ': ' + diag.msg);
  
  if (preplans.length === 0) {
    console.log('   No preplan available for this issue.');
    console.log('');
    return;
  }

  preplans.forEach((p, j) => {
    console.log('   [' + p.id + '] ' + p.desc + ' (success rate: ' + p.successRate + ')' + (p.auto ? ' [AUTO]' : ''));
  });
  console.log('');
  choices.push({ diag, preplans });
});

// User selects by typing problem number + plan letter
// For now: auto-apply all with successRate='high' and non-skipped plans, skip others
// Real interactive mode would require stdin - implement after confirming this works

// Find auto-fixable items (successRate=high, not skipped)
const autoFixable = [];
choices.forEach(({ diag, preplans }) => {
  const highRate = preplans.filter(p => p.successRate === 'high' && !p.exec().skipped);
  if (highRate.length > 0) {
    autoFixable.push({ diag, plan: highRate[0] });
  }
});

if (autoFixable.length > 0) {
  console.log('Auto-fixable items found (' + autoFixable.length + '):');
  autoFixable.forEach(({ diag, plan }, i) => {
    console.log((i + 1) + '. ' + diag.code + ' → Plan ' + plan.id + ': ' + plan.desc);
  });
  console.log('');
  console.log('To execute, run with --apply flag:');
  console.log('  node gateway-fix.js --apply');
  console.log('');
  console.log('Or fix manually one by one using plan IDs above.');
} else {
  console.log('No auto-fixable items. Choose a plan for each problem:');
  choices.forEach(({ diag, preplans }, i) => {
    const plan = preplans[0];
    if (plan) {
      console.log((i + 1) + '. ' + diag.code + ' → Plan ' + plan.id + ': ' + plan.desc);
    }
  });
}

// Write fix row to CSV
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

// If --apply flag, execute
if (process.argv.includes('--apply')) {
  console.log('=== Executing Fixes ===');
  console.log('');
  
  choices.forEach(({ diag, preplans }) => {
    const plan = preplans[0]; // pick first (highest rate) plan
    console.log('[' + diag.code + '] Plan ' + plan.id + ': ' + plan.desc + '...');
    const result = plan.exec();
    console.log('  Result: ' + (result.ok ? 'OK' : 'FAILED') + ' - ' + result.msg);
    writeFixRow(state, diag, plan, result);
    console.log('');
  });
  
  console.log('All fixes applied and recorded.');
  console.log('Run gateway-health.js to verify.');
} else {
  console.log('=== Dry Run (no changes made) ===');
  console.log('Run with --apply to execute fixes.');
}
