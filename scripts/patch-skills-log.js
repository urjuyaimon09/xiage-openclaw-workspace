const fs = require('fs');
const p = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\skills-CDh2H_rr.js';
let c = fs.readFileSync(p, 'utf8');
const old = 'skillsLogger$1.warn("Skipping skill path that resolves outside its configured root.", {';
if (!c.includes(old)) { console.log('Pattern not found'); process.exit(1); }
// Patch: add skill name in message text, extracted from candidatePath
const patch = 'skillsLogger$1.warn("SKIP skill: " + (params.candidatePath || "").replace(/.*[/\\\\]/, "") + " (path outside root), from: " + (params.source || "").replace(/.*[/\\\\]/, ""), {';
c = c.replace(old, patch);
fs.writeFileSync(p, c, 'utf8');
console.log('Patched OK');
