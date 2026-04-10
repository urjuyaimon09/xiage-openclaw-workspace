const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Test 1: skills.sh/openclaw (owner overview)
  console.log('\n=== Test skills.sh/openclaw ===');
  await page.goto('https://skills.sh/openclaw', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  const html1 = await page.content();
  const links1 = (html1.match(/clawhub\.ai\//g) || []).length;
  console.log('clawhub links in /openclaw:', links1);

  // Test 2: skills.sh/openclaw/skills (all skills in openclaw owner)
  console.log('\n=== Test skills.sh/openclaw/skills ===');
  await page.goto('https://skills.sh/openclaw/skills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  const html2 = await page.content();
  const links2 = (html2.match(/clawhub\.ai\//g) || []).length;
  const dataName2 = (html2.match(/data-name=/g) || []).length;
  console.log('clawhub links in /openclaw/skills:', links2);
  console.log('data-name attrs in /openclaw/skills:', dataName2);

  // Test 3: clawhub.ai/skills
  console.log('\n=== Test clawhub.ai/skills ===');
  await page.goto('https://clawhub.ai/skills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  const html3 = await page.content();
  const links3 = (html3.match(/href="https:\/\/clawhub\.ai\//g) || []).length;
  const hasLoading = html3.includes('Loading');
  console.log('clawhub links in clawhub.skills:', links3);
  console.log('Has loading text:', hasLoading);

  // Check what the page looks like
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page text snippet:', bodyText);

  await browser.close();
}

test().catch(console.error);
