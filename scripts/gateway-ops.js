#!/usr/bin/env node
// Gateway Auto-Ops 主脚本
// 串联: health → diagnose → fix
// 支持独立运行每一步: node gateway-ops.js [health|diagnose|fix|apply]
const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_DIR = 'C:\\Users\\Administrator\\.openclaw\\workspace\\scripts';

function run(script, args = '') {
  const cmd = `node "${path.join(SCRIPT_DIR, script)}" ${args}`;
  console.log('\n=== [' + script + '] ===');
  const start = Date.now();
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    console.log(out);
  } catch (e) {
    console.log('[ERROR] ' + e.message);
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.log(e.stderr);
  }
  console.log('[' + script + '] done in ' + (Date.now() - start) + 'ms');
}

const step = process.argv[2] || 'all';

console.log('=== Gateway Ops [' + step + '] ===');

if (step === 'health') {
  run('gateway-health.js');
} else if (step === 'diagnose') {
  run('gateway-diagnose.js');
} else if (step === 'fix') {
  run('gateway-fix.js');
} else if (step === 'apply') {
  run('gateway-fix.js', '--apply');
} else if (step === 'all') {
  run('gateway-health.js');
  run('gateway-diagnose.js');
  run('gateway-fix.js', '--apply');
}
