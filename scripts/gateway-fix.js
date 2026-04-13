#!/usr/bin/env node
// Gateway Fix - preplan-based fix with success count auto-escalation
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEALTH_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\health';
const CSV_FILE = path.join(HEALTH_DIR, 'health.csv');
const STATE_FILE = path.join(HEALTH_DIR, 'state.json');
const FIX_LOG = path.join(HEALTH_DIR, 'fix-log.json');

if (!fs.existsSync(FIX_LOG)) {
  fs.writeFileSync(FIX_LOG, JSON.stringify({}, null, 2), 'utf8');
}

const PREPLANS = {
  // CRITICAL / DEGRADED
  PORT_DOWN: [
    {
      id: 'A', desc: 'Monitor only - PM2专门负责restart',
      exec: () => {
        console.log('[PORT_DOWN] Port down detected - PM2 handles restart. Monitor only.');
        return { ok: true, msg: 'Monitor: PM2 handles restart', skipped: true };
      }
    }
  ],
  CONFIG_INVALID: [
    {
      id: 'A', desc: 'Restore from latest .json.bak.* backup',
      exec: () => {
        const dir = 'C:\\Users\\Administrator\\.openclaw';
        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith('openclaw.json.bak.') && !f.endsWith('.bak'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length === 0) {
          // fallback to plain .bak
          const bak = path.join(dir, 'openclaw.json.bak');
          if (!fs.existsSync(bak)) return { ok: false, msg: 'No backup found' };
          fs.copyFileSync(bak, path.join(dir, 'openclaw.json'));
          return { ok: true, msg: 'Restored from openclaw.json.bak (no timestamped backup)', skipped: false };
        }
        const latest = path.join(dir, files[0].name);
        fs.copyFileSync(latest, path.join(dir, 'openclaw.json'));
        return { ok: true, msg: 'Restored from ' + files[0].name, skipped: false };
      }
    }
  ],
  RPC_SLOW: [
    { id: 'A', desc: 'Monitor - PM2 handles restart',
      exec: () => { return { ok: true, msg: 'Monitor: PM2 handles restart', skipped: true }; } }
  ],
  RPC_MODERATE: [
    { id: 'A', desc: 'Monitor - no action',
      exec: () => { return { ok: true, msg: 'Monitor', skipped: true }; } }
  ],
  LOG_ERRORS: [
    { id: 'A', desc: 'Extract error logs for manual review',
      exec: () => {
        try {
          execSync('cmd /c "pm2 logs openclaw --err --lines 50 > C:\\Users\\Administrator\\.openclaw\\logs\\errors.log 2>&1"', { timeout: 10000 });
          return { ok: true, msg: 'Saved to logs\\errors.log', skipped: false };
        } catch (e) { return { ok: false, msg: e.message }; }
      }
    }
  ],
  BONJOUR_STUCK: [
    {
      id: 'A', desc: 'Add OPENCLAW_DISABLE_BONJOUR=1 to dump.pm2',
      exec: () => {
        const dump = 'C:\\Users\\Administrator\\.pm2\\dump.pm2';
        let c = fs.readFileSync(dump, 'utf8');
        if (c.includes('OPENCLAW_DISABLE_BONJOUR')) return { ok: true, msg: 'Already set', skipped: true };
        if (c.includes('OPENCLAW_FEISHU_HTTP_TIMEOUT_MS')) {
          c = c.replace(/("OPENCLAW_FEISHU_HTTP_TIMEOUT_MS":\s*"[^"]+")/, '$1,\n        "OPENCLAW_DISABLE_BONJOUR": "1"');
        } else {
          c = c.replace(/"env"\s*:\s*\{/, '{"env": {"OPENCLAW_DISABLE_BONJOUR": "1",');
        }
        fs.writeFileSync(dump, c, 'utf8');
        return { ok: true, msg: 'Written to dump.pm2', skipped: false };
      }
    },
    { id: 'B', desc: 'Ignore (if Bonjour not actively used)',
      exec: () => { return { ok: true, msg: 'Ignored', skipped: true }; } }
  ],
  RESTART_SURGE: [
    { id: 'A', desc: 'Extract error logs for crash analysis',
      exec: () => {
        try { execSync('cmd /c "pm2 logs openclaw --err --lines 50 > C:\\Users\\Administrator\\.openclaw\\logs\\restart-surge.log 2>&1"', { timeout: 10000 }); }
        catch (e) { return { ok: false, msg: e.message }; }
        return { ok: true, msg: 'Saved to logs\\restart-surge.log', skipped: false };
      }
    }
  ],
  MEM_HIGH: [
    { id: 'A', desc: 'Monitor - PM2 handles restart',
      exec: () => { return { ok: true, msg: 'Monitor: PM2 handles restart', skipped: true }; } }
  ],

  // WARNINGS
  FEISHU_400: [
    {
      id: 'A', desc: 'Check cardkit permissions (手动: 飞书开放平台 → 添加权限)',
      exec: () => {
        console.log('--- Feishu card 400 fix ---');
        console.log('Step 1: 打开 https://open.feishu.cn/app');
        console.log('Step 2: 应用 → 权限管理 → 添加权限');
        console.log('Step 3: 开通以下权限:');
        console.log('  - cardkit:card:read (获取卡片信息)');
        console.log('  - cardkit:card:write (创建与更新卡片)');
        console.log('  - cardkit:template:read (获取卡片模板信息)');
        console.log('Step 4: 保存后 gateway 会自动刷新 token');
        console.log('Step 5: 如未生效: pm2 restart openclaw');
        console.log('--------------------------');
        return { ok: true, msg: 'Manual fix: add cardkit permissions in Feishu open platform', skipped: false };
      }
    }
  ],
  SKILLS_SKIP: [
    {
      id: 'A', desc: 'Run fix-skill-paths.js to fix known bad ~/ paths in 3 skills',
      exec: () => {
        try {
          const result = execSync('node "C:\\Users\\Administrator\\.openclaw\\workspace\\scripts\\fix-skill-paths.js"', { timeout: 15000, encoding: 'utf8' });
          console.log(result);
          return { ok: true, msg: 'fix-skill-paths.js executed', skipped: false };
        } catch (e) {
          return { ok: false, msg: e.message };
        }
      }
    },
    {
      id: 'B', desc: 'Ignore (SKILLS_SKIP: blanket path replacement too risky)',
      exec: () => {
        return { ok: true, msg: 'Ignored: blanket replace ~/ in SKILL.md too risky - manual per-skill fix needed', skipped: true };
      }
    },
    {
      id: 'B', desc: 'Disable specific problem skill (rename SKILL.md to .bak)',
      exec: () => {
        return { ok: true, msg: 'Manual: find problem skill and rename its SKILL.md to .bak to disable', skipped: true };
      }
    }
  ],

  // MODEL TIMEOUT / UPSTREAM SLOW
  MODEL_TIMEOUT: [
    {
      id: 'A', desc: 'Monitor only (upstream API issue - restart won\'t fix)',
      exec: () => {
        console.log('--- Model/Upstream Timeout ---');
        console.log('This is an upstream API issue, not a Gateway problem.');
        console.log('Restart will not help. Monitor only.');
        console.log('If sustained, check:');
        console.log('  1. API quota/rate limit');
        console.log('  2. Network connectivity to AI provider');
        console.log('  3. API key validity');
        console.log('----------------------------');
        return { ok: true, msg: 'Upstream issue - monitor only', skipped: true };
      }
    }
  ],

  // SYSTEM DOCUMENT DRIFT FIXES
  // ─────────────────────────────────────────
  OPENCLAW_JSON_DRIFT: [
    {
      id: 'A', desc: 'Restore from latest openclaw.json.bak.* (不调PM2 restart)',
      exec: () => {
        const dir = 'C:\\Users\\Administrator\\.openclaw';
        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith('openclaw.json.bak.') && !f.endsWith('.bak'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length === 0) return { ok: false, msg: 'No backup found for openclaw.json' };
        const latest = path.join(dir, files[0].name);
        fs.copyFileSync(latest, path.join(dir, 'openclaw.json'));
        console.log('[OPENCLAW_JSON_DRIFT] Restored from: ' + files[0].name);
        return { ok: true, msg: 'Restored from ' + files[0].name + ' - PM2 will auto-restart', skipped: false };
      }
    }
  ],
  GATEWAY_CMD_DRIFT: [
    {
      id: 'A', desc: 'Restore from latest gateway.cmd.bak.* (不调PM2 restart)',
      exec: () => {
        const dir = 'C:\\Users\\Administrator\\.openclaw';
        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith('gateway.cmd.bak.') && !f.endsWith('.bak'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length === 0) return { ok: false, msg: 'No backup found for gateway.cmd' };
        const latest = path.join(dir, files[0].name);
        fs.copyFileSync(latest, path.join(dir, 'gateway.cmd'));
        console.log('[GATEWAY_CMD_DRIFT] Restored from: ' + files[0].name);
        return { ok: true, msg: 'Restored from ' + files[0].name + ' - PM2 will auto-restart', skipped: false };
      }
    }
  ],
  PM2_ENV_DRIFT: [
    {
      id: 'A', desc: 'Restore from latest dump.pm2.bak.* (不调PM2 restart)',
      exec: () => {
        const dir = 'C:\\Users\\Administrator\\.pm2';
        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith('dump.pm2.bak.') && !f.endsWith('.bak'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length === 0) return { ok: false, msg: 'No backup found for dump.pm2' };
        const latest = path.join(dir, files[0].name);
        fs.copyFileSync(latest, path.join(dir, 'dump.pm2'));
        console.log('[PM2_ENV_DRIFT] Restored from: ' + files[0].name);
        return { ok: true, msg: 'Restored from ' + files[0].name + ' - PM2 will auto-restart', skipped: false };
      }
    }
  ],
  OPENCLAW_VERSION_DRIFT: [
    {
      id: 'A', desc: 'Monitor only - 需坚果确认是否回滚版本',
      exec: () => {
        console.log('[OPENCLAW_VERSION_DRIFT] 版本漂移 - 需人工确认');
        return { ok: true, msg: 'Monitor only - 需坚果确认是否回滚', skipped: true };
      }
    }
  ],
  NODE_VERSION_DRIFT: [
    {
      id: 'A', desc: 'Monitor only - 需坚果确认是否回滚Node版本',
      exec: () => {
        console.log('[NODE_VERSION_DRIFT] Node版本漂移 - 需人工确认');
        return { ok: true, msg: 'Monitor only - 需坚果确认是否回滚', skipped: true };
      }
    }
  ],
  NEW_GLOBAL_NPM: [
    {
      id: 'A', desc: 'Monitor only - 记录新增包，等待坚果审查',
      exec: () => {
        console.log('[NEW_GLOBAL_NPM] 检测到新的全局npm包 - 需坚果审查');
        return { ok: true, msg: 'Monitor only - 记录新增包', skipped: true };
      }
    }
  ]
};

function loadLog() { try { return JSON.parse(fs.readFileSync(FIX_LOG, 'utf8')); } catch { return {}; } }
function saveLog(log) { fs.writeFileSync(FIX_LOG, JSON.stringify(log, null, 2), 'utf8'); }

function record(key, ok) {
  const log = loadLog();
  if (!log[key]) log[key] = { successes: 0, failures: 0, auto: false };
  if (ok) log[key].successes++;
  else log[key].failures++;
  if (log[key].successes >= 2 && log[key].failures === 0) log[key].auto = true;
  if (log[key].failures > 0) { log[key].auto = false; log[key].successes = 0; }
  saveLog(log);
  return log[key];
}

function isAuto(key) { return !!((loadLog()[key] || {}).auto); }

function getLatestDiagnose() {
  try {
    const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
    for (let i = lines.length - 1; i >= 1; i--) {
      if (lines[i].split(',')[2] === 'diagnose') return lines[i].split(',');
    }
    return null;
  } catch { return null; }
}

function getState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; } }

function writeFixRow(state, code, plan, result) {
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
    state.warnings ? state.warnings.join(';') : '',
    code,
    plan.id + ':' + plan.desc,
    result.ok ? (result.skipped ? 'skipped' : 'applied') : 'failed'
  ].join(',');
  fs.appendFileSync(CSV_FILE, row + '\n', 'utf8');
}

const state = getState();
const diagRow = getLatestDiagnose();
const fixLog = loadLog();

console.log('=== Gateway Fix ===');
console.log('Time: ' + new Date().toISOString());
console.log('Incident: ' + (state ? state.incidentId : 'none'));
console.log('');

if (!diagRow) {
  console.log('No diagnose found. Run gateway-diagnose.js first.');
  process.exit(0);
}

// Parse diagnoses from column 13 (diagStr)
const diagStr = diagRow[12] || '';
if (!diagStr) {
  console.log('No issues to fix.');
  process.exit(0);
}

const items = diagStr.split(';').filter(Boolean).map(d => {
  const [sev, code, ...msgParts] = d.split(':');
  return { severity: sev.trim(), code: code.trim(), msg: msgParts.join(':').trim() };
});

if (items.length === 0) {
  console.log('No issues to fix.');
  process.exit(0);
}

// Build choices
const choices = items.map(item => {
  const plans = PREPLANS[item.code] || [];
  const autoPlan = plans.find(p => isAuto(item.code + ':' + p.id));
  const bestPlan = autoPlan || plans[0] || null;
  return { ...item, plans, bestPlan, autoPlan: !!(autoPlan) };
});

// Auto-apply [AUTO] items first
const autoItems = choices.filter(c => c.autoPlan && c.bestPlan);
if (autoItems.length > 0) {
  console.log('[AUTO] fixes (' + autoItems.length + '):');
  autoItems.forEach(c => {
    const log = loadLog()[c.code + ':' + c.bestPlan.id] || {};
    console.log('  ' + c.severity + ' ' + c.code + ' --> [' + c.bestPlan.id + '] ' + c.bestPlan.desc + ' (ok:' + log.successes + ') [AUTO]');
  });
  console.log('');
  console.log('=== Applying [AUTO] ===');
  autoItems.forEach(c => {
    console.log('[' + c.code + '] ' + c.bestPlan.desc + '...');
    const result = c.bestPlan.exec();
    console.log('  --> ' + (result.ok ? 'OK' : 'FAILED') + ': ' + result.msg);
    writeFixRow(state, c.code, c.bestPlan, result);
    record(c.code + ':' + c.bestPlan.id, result.ok);
  });
  console.log('Done. Run gateway-health.js to verify.');
  process.exit(0);
}

// No auto - show all
console.log('Issues (' + items.length + ') - no [AUTO] plans yet:');
console.log('');
choices.forEach((c, i) => {
  const icons = { critical: '🔴', degraded: '🟡', warning: '🟠' };
  console.log((i + 1) + '. ' + (icons[c.severity] || '⚪') + ' ' + c.severity.toUpperCase() + ' ' + c.code + ': ' + c.msg);
  c.plans.forEach(p => {
    const log = loadLog()[c.code + ':' + p.id] || {};
    const autoTag = isAuto(c.code + ':' + p.id) ? ' [AUTO]' : '';
    const recTag = p.id === c.bestPlan.id ? ' (recommended)' : '';
    console.log('   [' + p.id + '] ' + p.desc + ' (ok:' + log.successes + ', fail:' + log.failures + ')' + autoTag + recTag);
  });
  console.log('');
});
const applyMode = process.argv.includes('--apply');

if (applyMode) {
  console.log('=== Applying Recommended Plans ===\n');
  choices.forEach((c, i) => {
    if (!c.bestPlan) { console.log((i+1) + '. ' + c.code + ': no plan available'); return; }
    console.log('[' + c.code + '] ' + c.bestPlan.desc + '...');
    const result = c.bestPlan.exec();
    console.log('  --> ' + (result.ok ? 'OK' : 'FAILED') + ': ' + result.msg);
    writeFixRow(state, c.code, c.bestPlan, result);
    record(c.code + ':' + c.bestPlan.id, result.ok);
  });
  console.log('\nDone. Run gateway-health.js to verify.');
  process.exit(0);
}

console.log('Run with --apply to execute recommended plans.');
