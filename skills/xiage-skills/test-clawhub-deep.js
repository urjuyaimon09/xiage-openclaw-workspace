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
  
  // Check for iframes
  const iframes = await page.evaluate(() => {
    const frames = document.querySelectorAll('iframe');
    return Array.from(frames).map(f => ({
      id: f.id,
      src: f.src,
      width: f.width,
      height: f.height,
      style: f.style.cssText
    }));
  });
  console.log('Iframes:', iframes);
  
  // Check for hidden elements containing skill text
  const hiddenContent = await page.evaluate(() => {
    const results = [];
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        const text = el.innerText?.trim();
        if (text && text.length > 20 && !text.includes('Sign in') && !text.includes('ClawHub') && !text.includes('Loading')) {
          results.push({ tag: el.tagName, class: el.className.substring(0, 80), text: text.substring(0, 100), display: style.display });
        }
      }
    }
    return results.slice(0, 5);
  });
  console.log('\nHidden elements with text:', hiddenContent);
  
  // Check for textarea or script with JSON data
  const rawData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/json"], script[id^="__NEXT_DATA"], script:not([src])');
    return Array.from(scripts).map(s => ({
      type: s.type || 'text/javascript',
      id: s.id,
      textLength: s.textContent?.length || 0,
      textPreview: s.textContent?.substring(0, 200)
    })).filter(s => s.textLength > 100);
  });
  console.log('\nData scripts:', rawData.slice(0, 3));
  
  // Check __NEXT_DATA or similar
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__') || document.querySelector('script[data-config]') || document.querySelector('script#__NEXT_DATA__');
    if (el) return { length: el.textContent?.length, preview: el.textContent?.substring(0, 500) };
    return null;
  });
  console.log('\n__NEXT_DATA__:', nextData);

  // Try to get the full DOM as text including all children
  const fullDomText = await page.evaluate(() => {
    // Get all visible text via Chrome DevTools Protocol
    const result = [];
    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.replace(/\s+/g, ' ').trim();
        if (t.length > 2) result.push(t);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          for (const child of node.childNodes) traverse(child);
        }
      }
    }
    traverse(document.body);
    return result.join(' | ');
  });
  console.log('\nFull DOM text (3000):\n', fullDomText.substring(0, 3000));

  await browser.close();
}

test().catch(console.error);
