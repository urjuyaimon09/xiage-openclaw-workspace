const fs = require('fs');
const c = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js', 'utf8');

const iac = c.indexOf('installViaClawhubPuppeteer');
const closePos = c.indexOf('await page.close();', iac);
const evalPos = c.indexOf('downloadLink.evaluate(el => el.href)', iac);
console.log('Fix 1 (close before evaluate): close at', closePos, 'evaluate at', evalPos, '->', closePos > evalPos ? 'FIXED' : 'STILL BROKEN');

const dlStart = c.indexOf('// 下载并解压 ZIP', iac);
const chunk2 = c.substring(dlStart, dlStart + 600);
console.log('Fix 2: has doDownload:', chunk2.includes('doDownload'), 'has content-type:', chunk2.includes("content-type"), 'has [307:', chunk2.includes('[307'));

const iss = c.indexOf('installSingleSkill');
const fb = c.indexOf("Puppeteer failed, falling back", iss);
const chunk3 = c.substring(fb, fb + 400);
console.log('Fix 3: has doZipFallback:', chunk3.includes('doZipFallback'), 'has [307:', chunk3.includes('[307'), 'has content-type:', chunk3.includes("content-type"));
