const fs = require('fs');
const path = 'C:/Users/Administrator/.openclaw/workspace/skills/xiage-skills/xiage-skills.js';
let content = fs.readFileSync(path, 'utf8');

// Replace parseClawhub(html) with parseClawhubFromJson(jsonPath)
const oldParseClawhub = `    function parseClawhub(html) {
        const results = [];
        // 匹配 https://clawhub.ai/{author}/{name}
        const hrefRe = /<a\\s[^>]*href="https:\\/\\/clawhub\\.ai\\/([^/]+)\\/([^"?\\s]+)"[^>]*>/gi;
        const seen = new Set();
        let m;
        while ((m = hrefRe.exec(html)) !== null) {
            const author = m[1].trim();
            const name = m[2].trim();
            const key = \`\${author}/\${name}\`;
            if (seen.has(key)) continue;
            seen.add(key);
            // 尝试从周围文本提取下载量
            let dl = 0;
            const snippet = html.substring(Math.max(0, m.index - 200), m.index + 200);
            const dlMatch = snippet.match(/([\\d,]+)\\s*(?:downloads|installs?|次|Downloads)/i);
            if (dlMatch) dl = parseInt(dlMatch[1].replace(/,/g, ''), 10);
            results.push({ name, author, downloads: dl, url: \`https://clawhub.ai/\${author}/\${name}\` });
        }
        info(\`Parsed \${results.length} skills from ClawHub\`);
        return results;
    }`;

const newParseClawhub = `    function parseClawhubFromJson(jsonPath) {
        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            return data.map(s => ({
                name: s.name,
                author: s.author,
                downloads: s.downloads || 0,
                stars: s.stars || 0,
                url: \`https://clawhub.ai/\${s.author}/\${s.name}\`
            }));
        } catch (e) {
            warn(\`Failed to parse clawhub JSON: \${e.message}\`);
            return [];
        }
    }`;

if (!content.includes(oldParseClawhub)) {
    console.log('oldParseClawhub NOT FOUND!');
    process.exit(1);
}

content = content.replace(oldParseClawhub, newParseClawhub);
console.log('Replaced parseClawhub');

// Replace the invocation section
const oldInvoke = `        const clawhubHtml = fs.readFileSync(tmpClawhub, 'utf8');
        const clawhubJson = parseClawhub(clawhubHtml);
        fs.writeFileSync(path.join(SKILLS_DIR, 'clawhub-downloads.json'), JSON.stringify(clawhubJson, null, 2), 'utf8');`;

const newInvoke = `        const clawhubJson = parseClawhubFromJson(tmpClawhubJson);
        fs.writeFileSync(path.join(SKILLS_DIR, 'clawhub-downloads.json'), JSON.stringify(clawhubJson, null, 2), 'utf8');`;

if (!content.includes(oldInvoke)) {
    console.log('oldInvoke NOT FOUND!');
    process.exit(1);
}

content = content.replace(oldInvoke, newInvoke);
console.log('Replaced invocation');

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
