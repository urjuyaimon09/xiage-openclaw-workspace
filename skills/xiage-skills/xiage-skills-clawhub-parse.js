const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Parse skills from text stream (text nodes walk in DOM order)
function parseSkillsFromText(textNodes) {
    const results = [];
    let i = 0;
    
    while (i < textNodes.length) {
        const t = textNodes[i];
        // Version pattern "1.0.0" is our anchor - skills appear before it
        if (/^\d+\.\d+(\.\d+)?$/.test(t)) {
            const version = t;
            // Look backwards for skill name (short text, alphanumeric+hyphen, before version)
            let skillName = null;
            for (let j = i - 1; j >= 0 && i - j < 4; j--) {
                const prev = textNodes[j];
                if (prev.length > 2 && prev.length < 60 && /^[a-zA-Z0-9][a-zA-Z0-9 +_-]+$/.test(prev)) {
                    skillName = prev;
                    break;
                }
            }
            
            // Look forwards for @author (after version + description)
            let author = null;
            let downloads = 0;
            let stars = 0;
            for (let j = i + 1; j < Math.min(i + 20, textNodes.length); j++) {
                const fwd = textNodes[j];
                if (fwd.startsWith('@') && fwd.length < 40) {
                    author = fwd.substring(1);
                }
                // Downloads: "212k", "1.2M"
                const dlMatch = fwd.match(/^([\d.]+)([KM])?$/);
                if (dlMatch && !author && j > i + 1) {
                    const num = parseFloat(dlMatch[1]);
                    downloads = dlMatch[2] === 'K' ? Math.round(num * 1000) : dlMatch[2] === 'M' ? Math.round(num * 1000000) : num;
                }
                // Stars: "★ 812"
                const starsMatch = fwd.match(/★\s*(\d+)/);
                if (starsMatch) {
                    stars = parseInt(starsMatch[1], 10);
                }
            }
            
            if (skillName && author) {
                results.push({ name: skillName, author, version, downloads, stars });
            }
        }
        i++;
    }
    
    return results;
}

async function loadClawhubSkills() {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto('https://clawhub.ai/skills', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(5000); // Wait for JS to render
    
    // Collect ALL text nodes in DOM order
    const textNodes = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
            const t = node.textContent.replace(/\s+/g, ' ').trim();
            if (t.length > 2) nodes.push(t);
        }
        return nodes;
    });
    
    console.log(`Total text nodes: ${textNodes.length}`);
    
    // Parse skills from text
    const skills = parseSkillsFromText(textNodes);
    console.log(`Parsed skills: ${skills.length}`);
    console.log('Sample:', skills.slice(0, 5));
    
    await browser.close();
    return skills;
}

loadClawhubSkills().catch(console.error);
