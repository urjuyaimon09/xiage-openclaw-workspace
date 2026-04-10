const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Parse skills from rendered innerText grid
function parseSkillsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const results = [];
    
    // The grid columns are: SKILL | SUMMARY | AUTHOR | STATS
    // Skill entries look like: "SkillName\n1.0.0\nDescription text...\n@author\n212k\n★ 812"
    let i = 0;
    let skipNext = false;
    
    while (i < lines.length) {
        const line = lines[i];
        
        // Skip column headers
        if (['SKILL', 'SUMMARY', 'AUTHOR', 'STATS', 'Cards', 'Highlighted', 'Hide suspicious',
             'Newest', 'Recently updated', 'Downloads', 'Installs', 'Stars', 'Name', 'Browse the skill library.'].includes(line)) {
            i++; continue;
        }
        
        // Version pattern: "1.0.0", "v1.2.3"
        if (/^v?\d+\.\d+/.test(line)) {
            const version = line.replace(/^v/, '');
            
            // Look backwards for skill name
            let skillName = '';
            for (let j = i - 1; j >= 0 && i - j < 3; j--) {
                const prev = lines[j];
                // Skip things that are clearly not skill names
                if (['Sign in', 'with GitHub', 'ClawHub', 'Skills', 'Plugins', 'Search', 'About',
                     'System', 'Light', 'Dark', ''].includes(prev)) continue;
                if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(prev)) continue; // Two capitalized words = probably column header
                if (/^[\d,]+$/.test(prev)) continue; // Pure numbers
                if (/^★/.test(prev)) continue;
                if (prev.startsWith('@')) continue;
                if (/[.!?]$/.test(prev) && prev.length > 30) continue; // Long sentences
                skillName = prev;
                break;
            }
            
            // Look forwards for @author, downloads, stars
            let author = '', downloads = 0, stars = 0;
            let desc = '';
            for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
                const fwd = lines[j];
                if (fwd.startsWith('@') && fwd.length < 50) {
                    author = fwd.substring(1);
                }
                const dlMatch = fwd.match(/^([\d.]+)([KM])?$/);
                if (dlMatch && !author && j > i + 1) {
                    const num = parseFloat(dlMatch[1]);
                    downloads = dlMatch[2] === 'K' ? Math.round(num * 1000) :
                               dlMatch[2] === 'M' ? Math.round(num * 1000000) : num;
                }
                const starsMatch = fwd.match(/★\s*(\d+)/);
                if (starsMatch) stars = parseInt(starsMatch[1], 10);
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
    
    // Scroll to load more content
    for (let scroll = 0; scroll < 5; scroll++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await sleep(1000);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(2000);
    
    // Get innerText
    const innerText = await page.evaluate(() => document.body.innerText);
    console.log('innerText length:', innerText.length);
    
    // Parse
    const skills = parseSkillsFromText(innerText);
    console.log('\nParsed skills:', skills.length);
    console.log('\nFirst 10:', JSON.stringify(skills.slice(0, 10), null, 2));
    console.log('\nLast 5:', JSON.stringify(skills.slice(-5), null, 2));
    
    // Count unique authors
    const authors = [...new Set(skills.map(s => s.author))];
    console.log('\nUnique authors:', authors.length);
    
    // Save full results
    fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/skills/clawhub-skills-parsed.json', JSON.stringify(skills, null, 2));
    console.log('\nSaved to clawhub-skills-parsed.json');
    
    await browser.close();
}

main().catch(console.error);
