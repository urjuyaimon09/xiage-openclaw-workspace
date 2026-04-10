const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('https://clawhub.ai/skills', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait much longer for JS to fully render
  for (let i = 0; i < 5; i++) {
    await sleep(2000);
    const len = await page.evaluate(() => document.body.innerHTML.length);
    console.log(`After ${(i+1)*2}s: innerHTML length = ${len}`);
  }
  
  // Get text grid structure
  const gridText = await page.evaluate(() => {
    const result = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let prevTwo = [];
    while (node = walker.nextNode()) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (t.length > 3) {
        prevTwo.push(t);
        if (prevTwo.length > 2) prevTwo.shift();
        // Look for skill grid pattern: version follows skill name
        if (/^\d+\.\d+/.test(t) && prevTwo[0] && /^[a-zA-Z][a-zA-Z0-9 -]+$/.test(prevTwo[0])) {
          result.push(`SKILL: "${prevTwo[0]}" VERSION: ${t}`);
        }
      }
    }
    return result.slice(0, 20);
  });
  console.log('\nSkill grid pattern:', gridText);
  
  // Try getting ALL text in document order
  const allText = await page.evaluate(() => {
    const result = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let lastShort = '';
    while (node = walker.nextNode()) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (t.length > 5) {
        // Pattern: @steipete (author), 212k (downloads), ★ 812 (stars)
        result.push(t);
      }
    }
    return result;
  });
  
  // Parse skill entries from text stream
  const skills = [];
  for (let i = 0; i < allText.length; i++) {
    const t = allText[i];
    if (t.startsWith('@') && t.length < 50) {
      const author = t;
      const dlMatch = allText[i+1];
      const starsMatch = allText[i+2];
      const dl = dlMatch ? dlMatch.match(/^[\d.]+[KM]?$/)?.[0] : null;
      const stars = starsMatch ? starsMatch.match(/★\s*(\d+)/)?.[1] : null;
      // Look backwards for skill name + version
      let skillName = '', version = '';
      for (let j = i - 1; j >= 0 && i - j < 5; j--) {
        if (/^\d+\.\d+/.test(allText[j])) { version = allText[j]; skillName = allText[j-1]; break; }
      }
      if (skillName && author) {
        skills.push({ skill: skillName, version, author: author.substring(1), downloads: dl, stars });
      }
    }
  }
  console.log('\nParsed skills:', skills.length, skills.slice(0, 5));
  
  await browser.close();
}

test().catch(console.error);
