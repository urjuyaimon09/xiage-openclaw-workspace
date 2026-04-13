#!/usr/bin/env node
// Gateway Diagnose - reads check results, categorizes issues, outputs diagnoses
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const CSV_FILE = path.join(HEALTH_DIR, 'health.csv');
const STATE_FILE = path.join(HEALTH_DIR, 'state.json');

function getLatestChecks(n = 5) {
  try {
    const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
    if (lines.length <= 1) return [];
    const checks = [];
    for (let i = lines.length - 1; i >= 0 && checks.length < n; i--) {
      const cols = lines[i].split(',');
      if (cols[2] === 'check') checks.push(cols);
    }
    return checks;
  } catch { return []; }
}

function getState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; } }

// Get PM2 process uptime in seconds
function getPM2Uptime() {
  try {
    const out = execSync('cmd /c "pm2 jlist"', { encoding: 'utf8', timeout: 5000 });
    const list = JSON.parse(out);
    const proc = list.find(p => p.name === 'openclaw');
    if (proc && proc.pm2_env && proc.pm2_env.pm_uptime) {
      return (Date.now() - new Date(proc.pm2_env.pm_uptime).getTime()) / 1000;
    }
    return null;
  } catch { return null; }
}

// ─────────────────────────────────────────
// 系统文档漂移检测（动态计算，不用 state.json）
// ─────────────────────────────────────────

function getSystemDocBaselines() {
  const baseFile = path.join(HEALTH_DIR, 'system-baseline.json');
  try {
    if (fs.existsSync(baseFile)) {
      return JSON.parse(fs.readFileSync(baseFile, 'utf8'));
    }
  } catch {}
  return null;
}

function saveSystemBaseline(baseline) {
  const baseFile = path.join(HEALTH_DIR, 'system-baseline.json');
  fs.writeFileSync(baseFile, JSON.stringify(baseline, null, 2), 'utf8');
}

function computeSystemDocState() {
  const crypto = require('crypto');
  const baselines = getSystemDocBaselines();
  const results = [];

  // 1. openclaw.json hash
  const ocJson = 'C:\\Users\\Administrator\\.openclaw\\openclaw.json';
  if (fs.existsSync(ocJson)) {
    const content = fs.readFileSync(ocJson, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const baseline = baselines ? baselines.openclaw_json_hash : null;
    if (baseline && baseline !== hash) {
      results.push({ severity: 'critical', code: 'OPENCLAW_JSON_DRIFT', msg: 'openclaw.json has been modified', hint: 'Restore from latest .bak.* or review changes', drift: true });
    }
  }

  // 2. gateway.cmd hash
  const gwCmd = 'C:\\Users\\Administrator\\.openclaw\\gateway.cmd';
  if (fs.existsSync(gwCmd)) {
    const content = fs.readFileSync(gwCmd, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const baseline = baselines ? baselines.gateway_cmd_hash : null;
    if (baseline && baseline !== hash) {
      results.push({ severity: 'critical', code: 'GATEWAY_CMD_DRIFT', msg: 'gateway.cmd has been modified', hint: 'Restore from latest gateway.cmd.bak.*', drift: true });
    }
  }

  // 3. dump.pm2 hash
  const dumpPm2 = 'C:\\Users\\Administrator\\.pm2\\dump.pm2';
  if (fs.existsSync(dumpPm2)) {
    const content = fs.readFileSync(dumpPm2, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const baseline = baselines ? baselines.dump_pm2_hash : null;
    if (baseline && baseline !== hash) {
      results.push({ severity: 'critical', code: 'PM2_ENV_DRIFT', msg: 'dump.pm2 has been modified', hint: 'Restore from latest dump.pm2.bak.* or pm2 save', drift: true });
    }
  }

  // 4. openclaw npm version
  try {
    const out = execSync('cmd /c "npm list -g openclaw --depth=0"', { encoding: 'utf8', timeout: 10000 });
    const match = out.match(/openclaw@([\d.]+)/);
    if (match) {
      const version = match[1];
      const baseline = baselines ? baselines.openclaw_npm_version : null;
      if (baseline && baseline !== version) {
        results.push({ severity: 'warning', code: 'OPENCLAW_VERSION_DRIFT', msg: 'openclaw npm version changed: ' + baseline + ' -> ' + version, hint: 'Review if upgrade was intentional - manual rollback may be needed', drift: true });
      }
    }
  } catch {}

  // 5. node version
  const nodeVersion = process.version.slice(1);
  const nodeBaseline = baselines ? baselines.node_version : null;
  if (nodeBaseline && nodeBaseline !== nodeVersion) {
    results.push({ severity: 'warning', code: 'NODE_VERSION_DRIFT', msg: 'Node.js version changed: ' + nodeBaseline + ' -> ' + nodeVersion, hint: 'Review if upgrade was intentional - may affect gateway compatibility', drift: true });
  }

  // 6. new global npm packages (scan for unknowns)
  if (baselines && baselines.npm_global_packages) {
    try {
      const out = execSync('cmd /c "npm list -g --depth=0 --json"', { encoding: 'utf8', timeout: 10000 });
      const pkgData = JSON.parse(out);
      const currentPkgs = Object.keys(pkgData.dependencies || {});
      const baselinePkgs = baselines.npm_global_packages;
      const newPkgs = currentPkgs.filter(p => !baselinePkgs.includes(p));
      if (newPkgs.length > 0) {
        results.push({ severity: 'warning', code: 'NEW_GLOBAL_NPM', msg: 'New global npm packages: ' + newPkgs.join(', '), hint: 'Review if installation was intentional', drift: true });
      }
    } catch {}
  }

  return results;
}

// ─────────────────────────────────────────
// Deep analysis: scan PM2 logs to find root cause of RPC slow
// ─────────────────────────────────────────
function analyzeRPCRootCause() {
  try {
    const logFile = 'C:\\Users\\Administrator\\.pm2\\logs\\openclaw-out.log';
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').slice(-100);
    const causes = [];

    for (const line of lines) {
      if (/auth.*conflict|401.*auth|auth.*401|token.*invalid|OAuth.*error/.test(line)) {
        causes.push({ type: 'auth_conflict', weight: 3, msg: 'Auth conflict detected in logs', action: 'Child agent using main auth - isolate auth-profiles' });
      }
      if (/spawn.*agent|subagent|child.*process|sessions_spawn/.test(line)) {
        causes.push({ type: 'child_agent', weight: 2, msg: 'Sub-agent active', action: 'Monitor - restart may help if GC pressure' });
      }
      if (/heap|memory|GC|out of memory/.test(line)) {
        causes.push({ type: 'memory_gc', weight: 2, msg: 'Memory pressure / GC pause detected', action: 'PM2 restart recommended - frees memory' });
      }
      if (/timeout|latency|slow|upstream|downstream/.test(line)) {
        causes.push({ type: 'upstream_slow', weight: 1, msg: 'External API latency detected', action: 'Wait - upstream issue, restart won\'t help' });
      }
      if (/SIGTERM|exit|crash|uncaught|unhandledRejection/.test(line)) {
        causes.push({ type: 'crash_restart', weight: 3, msg: 'Recent crash/restart detected', action: 'PM2 restart recommended' });
      }
    }

    // Return highest weight cause
    if (causes.length === 0) return { cause: 'unknown', hint: 'No clear pattern - try pm2 restart' };
    causes.sort((a, b) => b.weight - a.weight);
    return { cause: causes[0].type, msg: causes[0].msg, hint: causes[0].action };
  } catch (e) {
    return { cause: 'unknown', hint: 'Could not read logs: ' + e.message };
  }
}

// Diagnose rules: return array of { severity, code, msg, hint }
function diagnose(state, checks) {
  const results = [];

  if (!state) {
    results.push({ severity: 'critical', code: 'UNKNOWN', msg: 'No state data', hint: 'Run health check first' });
    return results;
  }

  // Critical
  if (state.portStatus !== 'listening') {
    results.push({ severity: 'critical', code: 'PORT_DOWN', msg: 'Port 18789 not listening', hint: 'Kill stale process: Stop-Process -Id <pid> -Force; then pm2 restart openclaw' });
  }
  if (state.rpcMs > 500) {
    const uptime = getPM2Uptime();
    const deep = analyzeRPCRootCause();

    let hint;
    if (uptime !== null && uptime < 300) {
      hint = 'Gateway started ' + Math.round(uptime) + 's ago - slow startup is normal, monitor only';
    } else {
      hint = (deep.msg ? deep.msg + ' | ' : '') + deep.hint;
    }

    results.push({
      severity: 'critical',
      code: 'RPC_SLOW',
      msg: 'RPC latency >500ms (' + state.rpcMs + 'ms)' + (uptime !== null ? ', uptime ' + Math.round(uptime) + 's' : ''),
      hint: hint,
      detail: deep
    });
  }
  if (!state.configValid) {
    results.push({ severity: 'critical', code: 'CONFIG_INVALID', msg: 'Config file invalid', hint: 'Restore: git checkout HEAD -- .openclaw/openclaw.json' });
  }

  // Degraded
  if (state.logErrors > 0) {
    results.push({ severity: 'degraded', code: 'LOG_ERRORS', msg: state.logErrors + ' error(s) in recent logs', hint: 'pm2 logs openclaw --err --lines 50' });
  }
  if (state.bonjourIssue) {
    results.push({ severity: 'degraded', code: 'BONJOUR_STUCK', msg: 'Bonjour mDNS stuck - ~42s startup delay', hint: 'Add OPENCLAW_DISABLE_BONJOUR=1 to PM2 dump.pm2' });
  }
  if (state.rpcMs > 200 && state.rpcMs <= 500) {
    const uptime = getPM2Uptime();
    const deep = analyzeRPCRootCause();

    let hint;
    if (uptime !== null && uptime < 300) {
      hint = 'Gateway started ' + Math.round(uptime) + 's ago - slow startup is normal, monitor only';
    } else {
      hint = (deep.msg ? deep.msg + ' | ' : '') + deep.hint;
    }

    results.push({
      severity: 'degraded',
      code: 'RPC_MODERATE',
      msg: 'RPC moderate delay (' + state.rpcMs + 'ms)' + (uptime !== null ? ', uptime ' + Math.round(uptime) + 's' : ''),
      hint: hint,
      detail: deep
    });
  }

  // Restart surge
  if (checks.length >= 2) {
    const current = parseInt(checks[0][7]) || 0;
    const prev = parseInt(checks[1][7]) || 0;
    if (current > prev && current - prev >= 5) {
      results.push({ severity: 'critical', code: 'RESTART_SURGE', msg: 'Restart count surged +' + (current - prev), hint: 'pm2 logs openclaw --err --lines 50 - check crash reason' });
    }
  }

  // Memory high
  if (state.memoryMB > 1500) {
    results.push({ severity: 'degraded', code: 'MEM_HIGH', msg: 'Memory usage high: ' + state.memoryMB + 'MB', hint: 'pm2 restart openclaw to free memory' });
  }

  // Warnings (third tier)
  if (state.warnings && state.warnings.length > 0) {
    for (const w of state.warnings) {
      const [code, count] = w.split(':');
      if (code === 'feishu_400') {
        results.push({ severity: 'warning', code: 'FEISHU_400', msg: 'Feishu streaming 400 errors: ' + count + '次', hint: 'Check feishu msgtype/card format config in openclaw.json' });
      }
      if (code === 'skills_skip') {
        results.push({ severity: 'warning', code: 'SKILLS_SKIP', msg: 'Skills skipping: ' + count + '次', hint: 'Review skills paths in openclaw.json - path resolves outside root' });
      }
      if (code === 'model_timeout') {
        const uptime = getPM2Uptime();
        if (uptime !== null && uptime < 300) {
          results.push({ severity: 'warning', code: 'MODEL_TIMEOUT', msg: 'Model/API timeouts: ' + count + '次 (uptime ' + Math.round(uptime) + 's)', hint: 'Startup phase - monitor only' });
        } else {
          results.push({ severity: 'degraded', code: 'MODEL_TIMEOUT', msg: 'Model/API timeouts: ' + count + '次', hint: 'Upstream API issue - restart won\'t fix, monitor only' });
        }
      }
    }
  }

  // 系统文档漂移检测（动态计算）
  const sysResults = computeSystemDocState();
  results.push(...sysResults);

  return results;
}

const state = getState();
const checks = getLatestChecks(5);
const diagnoses = diagnose(state, checks);

console.log('=== Gateway Diagnose ===');
console.log('Time: ' + (state ? state.lastCheck : 'unknown'));
console.log('Status: ' + (state ? state.status : 'unknown'));
console.log('Incident: ' + (state ? state.incidentId : 'none'));
console.log('');

if (diagnoses.length === 0) {
  console.log('No issues detected. Gateway is healthy.');
} else {
  const bySeverity = { critical: [], degraded: [], warning: [] };
  diagnoses.forEach(d => bySeverity[d.severity].push(d));

  const icons = { critical: '🔴', degraded: '🟡', warning: '🟠' };
  const order = ['critical', 'degraded', 'warning'];
  let idx = 1;

  order.forEach(sev => {
    if (bySeverity[sev].length === 0) return;
    console.log(icons[sev] + ' ' + sev.toUpperCase() + ' (' + bySeverity[sev].length + '):');
    bySeverity[sev].forEach(d => {
      console.log(idx + '. ' + d.code + ': ' + d.msg);
      console.log('   Hint: ' + d.hint);
      idx++;
    });
    console.log('');
  });
}

// Write diagnose row to CSV
if (state && diagnoses.length > 0) {
  const diagStr = diagnoses.map(d => d.severity + ':' + d.code + ':' + d.msg).join(';');
  const diagCodes = diagnoses.map(d => d.code).join(';');
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
    state.warnings ? state.warnings.join(';') : '',
    diagStr,
    diagCodes,
    '',  // fixes
    ''   // result
  ].join(',');
  fs.appendFileSync(CSV_FILE, row + '\n', 'utf8');
  console.log('Diagnose record written.');
}

console.log('');
console.log('To fix: node gateway-fix.js');

// ─────────────────────────────────────────
// CLI: --save-baseline
// ─────────────────────────────────────────
if (process.argv.includes('--save-baseline')) {
  const crypto = require('crypto');
  const baseline = {
    saved_at: new Date().toISOString(),
    openclaw_json_hash: fs.existsSync('C:\\Users\\Administrator\\.openclaw\\openclaw.json')
      ? crypto.createHash('md5').update(fs.readFileSync('C:\\Users\\Administrator\\.openclaw\\openclaw.json', 'utf8')).digest('hex')
      : null,
    gateway_cmd_hash: fs.existsSync('C:\\Users\\Administrator\\.openclaw\\gateway.cmd')
      ? crypto.createHash('md5').update(fs.readFileSync('C:\\Users\\Administrator\\.openclaw\\gateway.cmd', 'utf8')).digest('hex')
      : null,
    dump_pm2_hash: fs.existsSync('C:\\Users\\Administrator\\.pm2\\dump.pm2')
      ? crypto.createHash('md5').update(fs.readFileSync('C:\\Users\\Administrator\\.pm2\\dump.pm2', 'utf8')).digest('hex')
      : null,
    openclaw_npm_version: (() => {
      try {
        const out = execSync('cmd /c "npm list -g openclaw --depth=0"', { encoding: 'utf8', timeout: 10000 });
        const m = out.match(/openclaw@([\d.]+)/);
        return m ? m[1] : null;
      } catch { return null; }
    })(),
    node_version: process.version.slice(1),
    npm_global_packages: (() => {
      try {
        const out = execSync('cmd /c "npm list -g --depth=0 --json"', { encoding: 'utf8', timeout: 10000 });
        return Object.keys(JSON.parse(out).dependencies || {});
      } catch { return []; }
    })()
  };
  saveSystemBaseline(baseline);
  console.log('[BASELINE] System doc baselines saved at ' + baseline.saved_at);
  console.log('  openclaw.json hash:  ' + baseline.openclaw_json_hash);
  console.log('  gateway.cmd hash:    ' + baseline.gateway_cmd_hash);
  console.log('  dump.pm2 hash:      ' + baseline.dump_pm2_hash);
  console.log('  openclaw npm:       ' + baseline.openclaw_npm_version);
  console.log('  node version:        ' + baseline.node_version);
  console.log('  npm global packages: ' + baseline.npm_global_packages.length + ' packages');
  process.exit(0);
}
