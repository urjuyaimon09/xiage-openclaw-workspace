
// Extract skills from HTML to JSON
const fs = require('fs');
const path = require('path');

// Extract skills from skills.sh HTML
function extractFromSkillsShHtml(html, sourceUrl) {
    const skills = [];
    // Match the pre-rendered skill links: <a class="group grid..." href="/author/name">
    // Look for any <a> tag containing href that looks like /author/name
    const pattern = /<a[^>]+href="\/([^\/]+)\/([^\/>]+)"[^>]*>/g;
    const skillMap = new Map(); // avoid duplicates
    let match;
    while ((match = pattern.exec(html)) !== null) {
        const author = match[1];
        const name = match[2];
        // Skip navigation links
        if (['openclaw', 'official', 'audits', 'docs'].includes(name)) continue;
        if (!skillMap.has(name)) {
            // Approximate downloads 0 - will sort by position anyway
            skillMap.set(name, {
                name,
                author,
                downloads: 0,
                description: '',
                url: `https://skills.sh/${author}/${name}`
            });
        }
    }
    return Array.from(skillMap.values());
}

// Extract from clawhub HTML
function extractFromClawhubHtml(html) {
    const skills = [];
    // Match skill cards: https://clawhub.ai/author/name
    const pattern = /<a\s+class="skill-card"[^>]*href="([^"]+)"[^>]*>.*?<h3[^>]*>([^<]+)<\/h3>.*?by\s+([^<]+)<.*?<p[^>]*>([^<]+)<\/p>/gs;
    let match;
    while ((match = pattern.exec(html)) !== null) {
        const url = match[1];
        const name = match[2].trim();
        const author = match[3].trim();
        const description = match[4].trim();
        // ClawHub doesn't show downloads inline, approximate from position
        skills.push({
            name,
            author,
            downloads: 0, // will be sorted by position anyway
            description,
            url
        });
    }
    return skills;
}

// Extract trending
const trendingHtml = fs.readFileSync(path.join(__dirname, '.tmp-skills-trending.html'), 'utf8');
const trendingSkills = extractFromSkillsShHtml(trendingHtml, 'https://skills.sh/openclaw?sort=trending');
fs.writeFileSync(path.join(__dirname, 'skills-sh-trending.json'), JSON.stringify(trendingSkills, null, 2), 'utf8');
console.log(`Extracted ${trendingSkills.length} skills from skills.sh trending`);

// Extract downloads
const downloadsHtml = fs.readFileSync(path.join(__dirname, '.tmp-skills-downloads.html'), 'utf8');
const downloadsSkills = extractFromSkillsShHtml(downloadsHtml, 'https://skills.sh/openclaw?sort=downloads');
fs.writeFileSync(path.join(__dirname, 'skills-sh-downloads.json'), JSON.stringify(downloadsSkills, null, 2), 'utf8');
console.log(`Extracted ${downloadsSkills.length} skills from skills.sh downloads`);

console.log('Done!');
