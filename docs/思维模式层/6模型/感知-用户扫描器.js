/**
 * 感知-用户扫描器.js
 *
 * 子系统1：解析用户表单 -> 计算U阶 -> 输出感知报告
 *
 * 使用：
 *   node 感知-用户扫描器.js parse <formDataJson>
 *   node 感知-用户扫描器.js report
 *   node 感知-用户扫描器.js trend
 */

const sm = require('./感知-状态管理器.js');

function calculateTrend(history, field) {
  if (history.length < 2) return { direction: 'N/A', delta: 0 };
  const recent = history.slice(-4);
  const values = recent.map(h => {
    if (h.data && h.data.uLevels) return h.data.uLevels[field] && h.data.uLevels[field].level;
    return null;
  }).filter(v => v !== null && v !== undefined);
  if (values.length < 2) return { direction: 'N/A', delta: 0 };
  const delta = values[values.length - 1] - values[0];
  const direction = delta > 0.3 ? 'up' : delta < -0.3 ? 'down' : 'stable';
  return { direction, delta: parseFloat(delta.toFixed(2)), values };
}

function generateReport() {
  const state = sm.read();
  const history = sm.readHistory('user', 10);
  const u = state.user;
  if (!u) {
    console.log('No user perception data. Run "parse" first.');
    return null;
  }

  const t = {
    u1: calculateTrend(history, 'u1'),
    u2: calculateTrend(history, 'u2'),
    u3: calculateTrend(history, 'u3'),
    u4: calculateTrend(history, 'u4'),
    u5: calculateTrend(history, 'u5')
  };

  const risks = [];
  if (u.u1.level <= 2) risks.push('U1 danger: exhaustion/income gap');
  if (u.u2.level <= 2) risks.push('U2 danger: low savings/planning');
  if (u.u3.level <= 2) risks.push('U3 danger: relationship strain');
  if (u.u5.level <= 2) risks.push('U5 danger: lack of real outcomes');

  const gains = [];
  if (t.u1.direction === 'up') gains.push('U1 improving');
  if (t.u5.direction === 'up') gains.push('U5 self-actualization improving');

  const labels = { u1: 'Survival', u2: 'Safety', u3: 'Belonging', u4: 'Esteem', u5: 'Self-Actual' };
  const dirs = { up: 'UP', down: 'DOWN', stable: 'STABLE', 'N/A': 'N/A' };

  console.log('\n=== User Reality Perception Report ===');
  console.log('U1 Survival:  L' + u.u1.level + '  [' + dirs[t.u1.direction] + ']');
  console.log('U2 Safety:    L' + u.u2.level + '  [' + dirs[t.u2.direction] + ']');
  console.log('U3 Belonging: L' + u.u3.level + '  [' + dirs[t.u3.direction] + ']');
  console.log('U4 Esteem:    L' + u.u4.level + '  [' + dirs[t.u4.direction] + ']');
  console.log('U5 SelfAct:   L' + u.u5.level + '  [' + dirs[t.u5.direction] + ']');
  console.log('--------------------------------');
  console.log('Avg Level: L' + u.avgLevel);

  if (risks.length > 0) {
    console.log('\n[RISKS]');
    risks.forEach(r => console.log('  ! ' + r));
  }
  if (gains.length > 0) {
    console.log('\n[GAINS]');
    gains.forEach(g => console.log('  + ' + g));
  }

  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : 'N/A';
  console.log('\nUpdated: ' + updated);

  return { u, trends: t, risks, gains, avgLevel: u.avgLevel };
}

// CLI
const [,, cmd, arg1] = process.argv;

if (require.main === module) {
  if (cmd === 'parse') {
    let formData;
    try {
      formData = JSON.parse(arg1 || '{}');
    } catch (e) {
      console.error('Usage: node 感知-用户扫描器.js parse <json>');
      process.exit(1);
    }
    const result = sm.updateUser(formData);
    console.log('U calculated: U1=' + result.u1.level + ' U2=' + result.u2.level + ' U3=' + result.u3.level + ' U4=' + result.u4.level + ' U5=' + result.u5.level + ' Avg=' + result.avgLevel);
    generateReport();

  } else if (cmd === 'report') {
    generateReport();

  } else if (cmd === 'trend') {
    const history = sm.readHistory('user', 10);
    console.log('\n=== U-Level Trends ===');
    ['u1','u2','u3','u4','u5'].forEach(key => {
      const t = calculateTrend(history, key);
      console.log(key.toUpperCase() + ': ' + t.direction + ' (delta=' + t.delta + ')');
    });

  } else {
    console.log('Usage: parse <json> | report | trend');
  }
}

module.exports = { generateReport, calculateTrend };
