// fix-search.js - 修复 skills.sh 页面抓取，使用 https 直接请求 + HTML 解析
const https = require('https');
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = `${process.env.USERPROFILE}\\.openclaw\\workspace\\skills`;

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function parseSkillsFromHtml(html) {
    // skills.sh 页面结构: <a ... data-name="..." data-author="..." data-downloads="...">
    // 或者从文本内容解析: [name installs](/openclaw/skills/name)
    const results = [];

    // 方法1: 尝试 data-* 属性
    const re1 = /<a\s[^>]*data-name="([^"]+)"[^>]*data-author="([^"]+)"[^>]*data-downloads="([^"]+)"[^>]*>/gi;
    let m;
    while ((m = re1.exec(html)) !== null) {
        results.push({
            name: m[1].trim(),
            author: m[2].trim(),
            downloads: parseInt(m[3], 10) || 0,
            url: `https://clawhub.ai/${m[2].trim()}/${m[1].trim()}`
        });
    }

    // 方法2: 从文本内容解析 (from web_fetch text extraction)
    // 模式: [name installs](/openclaw/skills/name)
    if (results.length === 0) {
        const re2 = /\[([^\]]+?)(\d+)\]\(\/openclaw\/skills\/([^)]+)\)/g;
        while ((m = re2.exec(html)) !== null) {
            const fullName = m[1].trim();
            const downloads = parseInt(m[2], 10) || 0;
            const slug = m[3].trim();
            results.push({
                name: fullName,
                author: 'openclaw',
                downloads,
                url: `https://clawhub.ai/openclaw/${slug}`
            });
        }
    }

    // 方法3: 更通用的模式 [name installs](/openclaw/skills/name)
    if (results.length === 0) {
        const re3 = /\[([^\]]+)\](\d+)\]\(/gi;
        const reInner = /\[([^\]]+)\s*(\d+)\]\(\/openclaw\/skills\/([^)]+)\)/g;
        while ((m = reInner.exec(html)) !== null) {
            results.push({
                name: m[1].trim(),
                author: 'openclaw',
                downloads: parseInt(m[2], 10) || 0,
                url: `https://clawhub.ai/openclaw/${m[3].trim()}`
            });
        }
    }

    return results;
}

async function main() {
    console.log('[INFO] Starting fixed search...');

    // Fetch skills.sh trending page
    const trendingHtml = await fetchHtml('https://skills.sh/openclaw/skills?sort=trending');
    const trending = parseSkillsFromHtml(trendingHtml);
    console.log(`[INFO] Parsed ${trending.length} skills from trending page`);
    fs.writeFileSync(path.join(SKILLS_DIR, 'skills-sh-trending.json'), JSON.stringify(trending, null, 2));

    // Fetch skills.sh downloads page
    const downloadsHtml = await fetchHtml('https://skills.sh/openclaw/skills?sort=downloads');
    const downloads = parseSkillsFromHtml(downloadsHtml);
    console.log(`[INFO] Parsed ${downloads.length} skills from downloads page`);
    fs.writeFileSync(path.join(SKILLS_DIR, 'skills-sh-downloads.json'), JSON.stringify(downloads, null, 2));

    // Fetch clawhub
    let clawhubHtml = '';
    try {
        clawhubHtml = await fetchHtml('https://clawhub.ai/skills?sort=downloads');
    } catch(e) {
        console.log(`[WARN] ClawHub fetch failed: ${e.message}`);
    }
    if (clawhubHtml) {
        const clawhubResults = [];
        const re = /<a\s[^>]*href="https:\/\/clawhub\.ai\/([^/]+)\/([^"?\s]+)"[^>]*>/gi;
        let m;
        const seen = new Set();
        while ((m = re.exec(clawhubHtml)) !== null) {
            const author = m[1].trim();
            const name = m[2].trim();
            const key = `${author}/${name}`;
            if (!seen.has(key)) {
                seen.add(key);
                clawhubResults.push({ name, author, downloads: 0, url: `https://clawhub.ai/${author}/${name}` });
            }
        }
        console.log(`[INFO] Parsed ${clawhubResults.length} skills from ClawHub`);
        fs.writeFileSync(path.join(SKILLS_DIR, 'clawhub-downloads.json'), JSON.stringify(clawhubResults, null, 2));
    } else {
        fs.writeFileSync(path.join(SKILLS_DIR, 'clawhub-downloads.json'), JSON.stringify([], null, 2));
    }

    console.log('[INFO] Fixed search complete!');
}

main().catch(console.error);
