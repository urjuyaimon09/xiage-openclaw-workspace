const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const viewportOptions = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 375, height: 812 },
  ];
  const vp = viewportOptions[Math.floor(Math.random() * viewportOptions.length)];
  await page.setViewport({ width: vp.width, height: vp.height });

  // Test clawhub skills page - with innerHTML extraction
  console.log('\n=== ClawHub /skills with innerHTML ===');
  await page.goto('https://clawhub.ai/skills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);
  
  // Use innerHTML to get rendered DOM
  const innerHtml = await page.evaluate(() => document.body.innerHTML);
  const innerLinks = (innerHtml.match(/href="https:\/\/clawhub\.ai\/([^"]+)"/g) || []).length;
  console.log('clawhub skill links (innerHTML):', innerLinks);
  
  // Try to find skill names in the DOM text
  const skillNames = await page.evaluate(() => {
    // Look for elements with skill name patterns
    const links = Array.from(document.querySelectorAll('a[href*="clawhub.ai"]'));
    return links.slice(0, 5).map(a => a.href).join('\n');
  });
  console.log('Sample skill links:\n', skillNames);

  // Test skills.sh/openclaw/openclaw page  
  console.log('\n=== skills.sh/openclaw/openclaw with innerHTML ===');
  await page.goto('https://skills.sh/openclaw/openclaw', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);
  
  const shInnerHtml = await page.evaluate(() => document.body.innerHTML);
  const shLinks = (shInnerHtml.match(/href="https:\/\/clawhub\.ai\/([^"]+)"/g) || []).length;
  const shDataName = (shInnerHtml.match(/data-name="([^"]+)"/g) || []).length;
  console.log('clawhub links (innerHTML):', shLinks);
  console.log('data-name attrs (innerHTML):', shDataName);

  // Check the actual DOM structure
  const shBodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log('skills.sh body text:\n', shBodyText.substring(0, 500));
  
  // Save HTML for inspection
  fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/skills/.tmp-sh-openclaw-openclaw.html', shInnerHtml, 'utf8');
  console.log('Saved skills.sh/openclaw/openclaw innerHTML');

  await browser.close();
}

test().catch(console.error);
