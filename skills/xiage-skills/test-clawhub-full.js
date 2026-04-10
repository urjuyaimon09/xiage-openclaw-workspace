const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('https://clawhub.ai/skills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(8000);
  
  // Get innerText (rendered text content)
  const innerText = await page.evaluate(() => document.body.innerText);
  console.log('innerText length:', innerText.length);
  console.log('innerText (first 2000):\n', innerText.substring(0, 2000));
  
  // Get all visible text
  const bodyText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      const t = node.textContent.trim();
      if (t.length > 3) texts.push(t);
    }
    return texts.join(' | ').substring(0, 3000);
  });
  console.log('\nAll text nodes (3000):\n', bodyText);
  
  // Get computed style for elements to check visibility
  const visibleCards = await page.evaluate(() => {
    const cards = document.querySelectorAll('.card, .skill-card, [class*="card"], [class*="skill"]');
    return Array.from(cards).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.innerText?.substring(0, 100),
      display: getComputedStyle(el).display,
      opacity: getComputedStyle(el).opacity,
      visibility: getComputedStyle(el).visibility
    })).slice(0, 3);
  });
  console.log('\nCards found:', visibleCards);

  await browser.close();
}

test().catch(console.error);
