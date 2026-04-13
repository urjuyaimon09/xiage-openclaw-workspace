#!/usr/bin/env node
// Precise SKILL.md path fixer - only replaces ~/ in "location:" metadata field
const fs = require('fs');
const path = require('path');

const workspaceRoot = 'C:\\Users\\Administrator\\.openclaw\\workspace';
const skillsDir = path.join(workspaceRoot, 'skills');

const PREPLANS = {
  'ivangdavila-business': {
    old: '~/business/',
    new: 'C:\\Users\\Administrator\\.openclaw\\workspace\\business\\'
  },
  'ivangdavila-self-improving': {
    old: '~/self-improving/',
    new: 'C:\\Users\\Administrator\\.openclaw\\workspace\\self-improving\\'
  },
  'openclaw-openai-image-gen': {
    old: '~/Projects/',
    new: 'C:\\Users\\Administrator\\.openclaw\\workspace\\Projects\\'
  }
};

const fixed = [];
const failed = [];

for (const [skillName, plan] of Object.entries(PREPLANS)) {
  const skillDir = path.join(skillsDir, skillName);
  const skillMd = path.join(skillDir, 'SKILL.md');
  
  if (!fs.existsSync(skillDir)) {
    console.log('SKIP: ' + skillName + ' (directory not found)');
    continue;
  }
  
  if (!fs.existsSync(skillMd)) {
    console.log('SKIP: ' + skillName + ' (SKILL.md not found)');
    continue;
  }
  
  let c = fs.readFileSync(skillMd, 'utf8');
  const before = c;
  
  if (c.includes(plan.old)) {
    c = c.replace(new RegExp(plan.old.replace(/\\/g, '\\\\'), 'g'), plan.new.replace(/\\/g, '\\\\'));
    fs.writeFileSync(skillMd, c, 'utf8');
    fixed.push(skillName);
    console.log('FIXED: ' + skillName);
    console.log('  ' + plan.old + ' --> ' + plan.new);
  } else {
    console.log('OK: ' + skillName + ' (path already correct or not found)');
  }
}

console.log('\nDone. Fixed: ' + fixed.length);
if (failed.length) console.log('Failed: ' + failed.join(', '));
