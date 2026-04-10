const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseSkillsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const results = [];
    
    // Skip headers and static text
    const skipSet = new Set(['SKILL', 'SUMMARY', 'AUTHOR', 'STATS', 'Cards', 'Highlighted', 
        'Hide suspicious', 'Newest', 'Recently updated', 'Downloads', 'Installs', 
        'Stars', 'Name', 'Browse the skill library.', 'ClawHub', 'Skills', 'Plugins', 
        'Search', 'About', 'System', 'Light', 'Dark', 'Sign in', 'with GitHub',
        '↓', 'v']);
    
    // Valid version: must match X.Y or X.Y.Z (at least one dot, digits on both sides)
    const versionRe = /^\d+\.\d+(\.\d+)?$/;
    
    // Skill name: short, alphanumeric + punctuation, not a version/stats/number/author
    function isSkillName(s) {
        if (!s || s.length < 2 || s.length > 60) return false;
        if (skipSet.has(s)) return false;
        if (versionRe.test(s)) return false; // is a version
        if (/^★/.test(s)) return false; // is stars
        if (/^[@\$]/.test(s)) return false; // is author or special
        if (/^[\d,]+(\.\d+)?[KM]?$/.test(s)) return false; // is number/stats
        if (/^v\d/.test(s)) return false; // is "v1.0.0" style
        if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(s)) return false; // Title Case sentence = likely header
        if (s.length > 30 && s.includes(' ')) return false; // long description fragment
        return true;
    }
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        
        if (skipSet.has(line)) { i++; continue; }
        
        // Version: must have a dot between numbers (not "1 v" or "13 v")
        if (versionRe.test(line)) {
            const version = line;
            
            // Look backwards for skill name (up to 3 lines back)
            let skillName = null;
            for (let j = i - 1; j >= 0 && i - j < 4; j--) {
                if (isSkillName(lines[j])) {
                    skillName = lines[j];
                    break;
                }
            }
            
            // Look forwards: description → @author → stats
            let author = null, dlRaw = null, stars = 0;
            for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                const fwd = lines[j];
                if (fwd.startsWith('@') && fwd.length < 50) {
                    if (!author) author = fwd.substring(1);
                } else if (/^[\d.]+[KM]?$/.test(fwd) && !dlRaw && j > i + 1) {
                    const num = parseFloat(fwd);
                    dlRaw = fwd; // keep raw string for later
                } else if (/★/.test(fwd)) {
                    const m = fwd.match(/★\s*(\d+)/);
                    if (m) stars = parseInt(m[1], 10);
                }
            }
            
            // Parse downloads from raw string
            let downloads = 0;
            if (dlRaw) {
                const num = parseFloat(dlRaw);
                downloads = dlRaw.endsWith('K') ? Math.round(num * 1000) :
                           dlRaw.endsWith('M') ? Math.round(num * 1000000) :
                           dlRaw.endsWith('B') ? Math.round(num * 1000000000) : num;
            }
            
            if (skillName && author) {
                results.push({ name: skillName, author, version, downloads, stars });
            }
        }
        i++;
    }
    
    return results;
}

async function main() {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto('https://clawhub.ai/skills', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);
    
    // Scroll to bottom in steps to trigger infinite scroll
    let prevLen = 0;
    for (let scroll = 0; scroll < 20; scroll++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1500);
        const curLen = await page.evaluate(() => document.body.innerText.length);
        if (curLen === prevLen) break;
        console.log(`Scroll ${scroll+1}: innerText ${curLen} chars`);
        prevLen = curLen;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1000);
    
    // Get innerText and parse
    const innerText = await page.evaluate(() => document.body.innerText);
    console.log('\nTotal innerText length:', innerText.length);
    
    const skills = parseSkillsFromText(innerText);
    console.log('Parsed skills:', skills.length);
    
    // Deduplicate by name@author
    const seen = new Set();
    const unique = skills.filter(s => {
        const k = `${s.author}/${s.name}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
    });
    console.log('After dedup:', unique.length);
    
    // Sample
    console.log('\nFirst 5:', JSON.stringify(unique.slice(0, 5), null, 2));
    console.log('\nLast 3:', JSON.stringify(unique.slice(-3), null, 2));
    
    // Stats
    const totalStars = unique.reduce((a, s) => a + (s.stars || 0), 0);
    console.log('\nStats: totalSkills=', unique.length, 'totalStars=', totalStars);
    
    // Save
    fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/skills/clawhub-skills-parsed.json', JSON.stringify(unique, null, 2));
    
    await browser.close();
    return unique;
}

main().then(skills => {
    console.log(`\nFinal: ${skills.length} skills parsed`);
    process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
