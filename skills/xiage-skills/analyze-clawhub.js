const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('https://clawhub.ai/skills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for skills to actually load
  console.log('Waiting for skills to render...');
  try {
    await page.waitForSelector('.card', { timeout: 10000 });
    console.log('Cards appeared!');
  } catch(e) {
    console.log('No .card found:', e.message);
  }
  await sleep(2000);
  
  // Get innerHTML
  const innerHtml = await page.evaluate(() => document.body.innerHTML);
  const links = (innerHtml.match(/href="https:\/\/clawhub\.ai\/([^"]+)"/g) || []);
  console.log('clawhub links in innerHTML:', links.length);
  if (links.length > 0) console.log('First 5:', links.slice(0, 5));
  
  // Try different selectors
  const allAnchors = await page.evaluate(() => {
    const as = Array.from(document.querySelectorAll('a[href]'));
    return as.map(a => a.href).filter(h => h.includes('clawhub')).slice(0, 5);
  });
  console.log('querySelectorAll a[href] clawhub:', allAnchors);
  
  // Check for shadow DOM
  const shadowDom = await page.evaluate(() => {
    return document.querySelectorAll('*').length;
  });
  console.log('Total elements in DOM:', shadowDom);
  
  // Check body innerHTML length
  console.log('body innerHTML length:', innerHtml.length);
  
  // Save for inspection
  fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/skills/.tmp-clawhub-inner.html', innerHtml, 'utf8');
  console.log('Saved');
  
  await browser.close();
}

test().catch(console.error);
