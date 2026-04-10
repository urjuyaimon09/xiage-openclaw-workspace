const fs = require('fs');
const path = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
let content = fs.readFileSync(path, 'utf8');

// Find the parseSkillsSh function in the file
const startMarker = '    // skills.sh 解析：滚动后 HTML 中技能数据在 data-name / data-author / data-downloads 属性里';
const endMarker = '    // ClawHub 解析：直接 HTTPS fetch 的 HTML';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1) { console.log('Start marker NOT found'); process.exit(1); }
if (endIdx === -1) { console.log('End marker NOT found'); process.exit(1); }

// Find the closing of parseSkillsSh function
// Look for the return statement followed by "    }" at the right indentation
let fnEndIdx = content.indexOf('        info(`Parsed ${results.length} skills from skills.sh(${source})`);', startIdx);
if (fnEndIdx === -1) { console.log('Could not find end of parseSkillsSh'); process.exit(1); }
// Include the return statement line
fnEndIdx = content.indexOf('\n    }', fnEndIdx) + 6; // include newline and closing brace

console.log(`Found parseSkillsSh at ${startIdx}-${fnEndIdx}, length=${fnEndIdx-startIdx}`);

const oldFn = content.substring(startIdx, fnEndIdx);
console.log('Old fn first 100:', JSON.stringify(oldFn.substring(0, 100)));
console.log('Old fn last 100:', JSON.stringify(oldFn.substring(oldFn.length-100)));

const newFn = `    // skills.sh 解析：新版页面 URL 格式为 /{owner}/{repo}/{skill}
    function parseSkillsSh(html, source) {
        const results = [];
        // 新格式: href="/openclaw/openclaw/skill-name" + <span>下载数</span>
        const skillLinkRe = /href="\\/([^\\/]+)\\/([^\\/]+)\\/([^"?\\s]+)"[^>]*>[\\s\\S]*?<span[^>]*>([\\d.]+[KMB]?)<\\/span>/gi;
        let m;
        while ((m = skillLinkRe.exec(html)) !== null) {
            const owner = m[1].trim();
            const repo = m[2].trim();
            const name = m[3].trim();
            let downloads = 0;
            const dlStr = m[4];
            const numMatch = dlStr.match(/^([\\d.]+)/);
            if (numMatch) {
                const num = parseFloat(numMatch[1]);
                downloads = Math.round(num * (dlStr.endsWith('K') ? 1000 : dlStr.endsWith('M') ? 1000000 : dlStr.endsWith('B') ? 1000000000 : 1));
            }
            if (owner === 'openclaw' && repo === 'openclaw') {
                results.push({ name, author: owner, downloads, url: \`https://clawhub.ai/\${owner}/\${name}\` });
            }
        }
        // 旧格式兼容（data 属性式）
        if (results.length === 0) {
            const re = /<a\\s[^>]*data-name="([^"]+)"[^>]*data-author="([^"]+)"[^>]*data-downloads="([^"]+)"[^>]*>/gi;
            while ((m = re.exec(html)) !== null) {
                results.push({
                    name: m[1].trim(),
                    author: m[2].trim(),
                    downloads: parseInt(m[3], 10) || 0,
                    url: \`https://clawhub.ai/\${m[2].trim()}/\${m[1].trim()}\`
                });
            }
        }
        // 旧格式兼容（clawhub 链接式）
        if (results.length === 0) {
            const hrefRe = /<a\\s+href="https:\\/\\/clawhub\\.ai\\/([^/]+)\\/([^"?\\s]+)[^"]*"[^>]*>([\\s\\S]*?)<\\/a>/gi;
            while ((m = hrefRe.exec(html)) !== null) {
                const author = m[1].trim();
                const name = m[2].trim();
                const text = m[3].replace(/<[^>]+>/g, '').replace(/\\s+/g, ' ').trim();
                const dlMatch = text.match(/[\\d,]+(?:\\s*(?:downloads|installs?|次|Downloads))/i);
                results.push({
                    name, author,
                    downloads: dlMatch ? parseInt(dlMatch[0].replace(/[^\\d]/g, ''), 10) : 0,
                    url: \`https://clawhub.ai/\${author}/\${name}\`
                });
            }
        }
        info(\`Parsed \${results.length} skills from skills.sh(\${source})\`);
        return results;
    }`;

const newContent = content.substring(0, startIdx) + newFn + content.substring(fnEndIdx);
fs.writeFileSync(path, newContent, 'utf8');
console.log('Done replacing parseSkillsSh');
