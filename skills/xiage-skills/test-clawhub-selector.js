const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('https://clawhub.ai/skills', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  
  // Get full innerHTML length
  const len = await page.evaluate(() => document.body.innerHTML.length);
  console.log('innerHTML length:', len);
  
  // Get all links via evaluate (not innerHTML-based)
  const links = await page.evaluate(() => {
    const result = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while (node = walker.nextNode()) {
      const el = node;
      if (el.tagName === 'A' && el.href && el.href.includes('clawhub.ai')) {
        result.push(el.href);
      }
    }
    return result;
  });
  console.log('Links via TreeWalker:', links.length, links.slice(0, 5));
  
  // Get ALL links from the page using evaluate
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.includes('clawhub'));
  });
  console.log('All clawhub links via querySelectorAll:', allLinks.length, allLinks.slice(0, 5));
  
  // Get ALL text content and look for @author patterns
  const authors = await page.evaluate(() => {
    const result = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const t = node.textContent.trim();
      if (t.startsWith('@') && t.length > 2) {
        if (!seen.has(t)) {
          seen.add(t);
          result.push(t);
        }
      }
    }
    return result;
  });
  console.log('\n@author mentions found:', authors.length, authors.slice(0, 10));
  
  // Get skill names
  const skillNames = await page.evaluate(() => {
    const result = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    // Skills appear to be in grid cells - look for text before @author
    let prevText = '';
    let nodeIter = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (node = nodeIter.nextNode()) {
      const t = node.textContent.trim();
      // Skill names are short (< 30 chars) and followed by version pattern
      if (/^\d+\.\d+/.test(t) && prevText.length > 3 && prevText.length < 40) {
        result.push({ skill: prevText, version: t });
      }
      prevText = t;
    }
    return result.slice(0, 10);
  });
  console.log('\nSkill + version pairs:', skillNames);

  await browser.close();
}

test().catch(console.error);
