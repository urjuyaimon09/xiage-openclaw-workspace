const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseSkillsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('Total lines:', lines.length);
    
    // Count version-like patterns
    const versionLines = lines.filter(l => /^\d+\.\d+/.test(l));
    console.log('Version-like lines:', versionLines.length, versionLines.slice(0, 5));
    
    // Count @author lines
    const authorLines = lines.filter(l => l.startsWith('@'));
    console.log('@author lines:', authorLines.length, authorLines.slice(0, 3));
    
    // Check if "SKILL" header is present
    const hasHeaders = ['SKILL', 'SUMMARY', 'AUTHOR', 'STATS'].filter(h => lines.includes(h));
    console.log('Headers found:', hasHeaders);
    
    // Show a snippet around first version-like line
    const firstVersionIdx = lines.findIndex(l => /^\d+\.\d+/.test(l));
    if (firstVersionIdx >= 0) {
        console.log('First version context:', lines.slice(Math.max(0, firstVersionIdx-3), firstVersionIdx+5));
    }
}

async function main() {
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto('https://clawhub.ai/skills', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);
    
    // Test 1: before scroll
    let text1 = await page.evaluate(() => document.body.innerText);
    console.log('\n=== BEFORE SCROLL ===');
    console.log('Length:', text1.length);
    parseSkillsFromText(text1);
    
    // Test 2: after one scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);
    let text2 = await page.evaluate(() => document.body.innerText);
    console.log('\n=== AFTER SCROLL ===');
    console.log('Length:', text2.length);
    parseSkillsFromText(text2);
    
    await browser.close();
}

main().catch(console.error);
