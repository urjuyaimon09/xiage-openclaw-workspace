const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseSkillsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const results = [];
    
    const skipSet = new Set(['SKILL', 'SUMMARY', 'AUTHOR', 'STATS', 'Cards', 'Highlighted', 
        'Hide suspicious', 'Newest', 'Recently updated', 'Downloads', 'Installs', 
        'Stars', 'Name', 'Browse the skill library.', 'ClawHub', 'Skills', 'Plugins', 
        'Search', 'About', 'System', 'Light', 'Dark', 'Sign in', 'with GitHub',
        '↓', 'v', '']);
    
    const versionRe = /^v\d+\.\d+(\.\d+)?$/;
    const dlRe = /^[\d.]+[kKmMbB]$/;
    
    function isSkillName(s) {
        if (!s || s.length < 2 || s.length > 50) return false;
        if (skipSet.has(s)) return false;
        if (versionRe.test(s)) return false;
        if (dlRe.test(s)) return false;
        if (/^★/.test(s)) return false;
        if (/^[@\$]/.test(s)) return false;
        if (/^[\d,]+$/.test(s)) return false;
        // Long multi-word text = description
        if (s.length > 35 && s.includes(' ')) return false;
        // "X v" (version count) - single X followed by v
        if (/^\d+ v$/.test(s)) return false;
        return true;
    }
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        
        // Skill name: non-version, short, not a known header
        if (isSkillName(line)) {
            const skillName = line;
            
            // Look FORWARD for version (vX.Y), author (@), stats
            let version = null, author = null, dlRaw = null, stars = 0;
            for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
                const fwd = lines[j];
                if (versionRe.test(fwd)) {
                    if (!version) version = fwd.replace(/^v/, '');
                } else if (fwd.startsWith('@') && fwd.length < 50) {
                    if (!author) author = fwd.substring(1);
                } else if (dlRe.test(fwd)) {
                    if (!dlRaw) {
                        const num = parseFloat(fwd);
                        const suffix = fwd.slice(-1).toUpperCase();
                        dlRaw = suffix === 'K' ? Math.round(num * 1000) :
                               suffix === 'M' ? Math.round(num * 1000000) :
                               suffix === 'B' ? Math.round(num * 1000000000) : num;
                    }
                } else if (/★/.test(fwd)) {
                    const m = fwd.match(/★\s*(\d+)/);
                    if (m) stars = parseInt(m[1], 10);
                }
            }
            
            if (author) {
                results.push({ 
                    name: skillName, 
                    author, 
                    version: version || '0.0.0', 
                    downloads: dlRaw || 0, 
                    stars 
                });
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
    
    let prevLen = 0;
    for (let s = 0; s < 20; s++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1500);
        const curLen = await page.evaluate(() => document.body.innerText.length);
        if (curLen === prevLen) break;
        prevLen = curLen;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1000);
    
    const innerText = await page.evaluate(() => document.body.innerText);
    const skills = parseSkillsFromText(innerText);
    
    const seen = new Set();
    const unique = skills.filter(s => {
        const k = `${s.author}/${s.name}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
    });
    
    console.log(`Parsed: ${skills.length}, unique: ${unique.length}`);
    console.log('\nFirst 8:', JSON.stringify(unique.slice(0, 8), null, 2));
    console.log('\nLast 3:', JSON.stringify(unique.slice(-3), null, 2));
    
    fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/skills/clawhub-skills-parsed.json', JSON.stringify(unique, null, 2));
    await browser.close();
}

main().catch(console.error);
