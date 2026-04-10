const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('https://clawhub.ai/skills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for the custom element to upgrade and render
  await sleep(5000);

  // Method 1: Check custom elements
  const customElements = await page.evaluate(() => {
    const names = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.tagName.includes('-')) names.push(el.tagName.toLowerCase());
    }
    return [...new Set(names)];
  });
  console.log('Custom elements found:', customElements);

  // Method 2: Try to access shadow roots via DOM
  const shadowInfo = await page.evaluate(() => {
    const shadows = [];
    function walk(el, path) {
      if (el.shadowRoot) {
        shadows.push({ path, tag: el.tagName, shadowChildren: el.shadowRoot.children.length });
      }
      for (const child of el.children) {
        walk(child, path + '>' + child.tagName);
      }
    }
    walk(document.body, 'body');
    return shadows;
  });
  console.log('Shadow roots found:', shadowInfo.length, shadowInfo);

  // Method 3: Try calling custom element methods if exposed
  const ceMethods = await page.evaluate(() => {
    const results = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.tagName.includes('-')) {
        results.push({
          tag: el.tagName.toLowerCase(),
          props: Object.getOwnPropertyNames(el).filter(p => !p.startsWith('_')),
          methods: typeof el.getSkills === 'function' ? 'has getSkills' : null,
          skills: el.skills ? 'has skills prop' : null,
          data: el.data ? 'has data prop' : null,
        });
      }
    }
    return results;
  });
  console.log('Custom element internals:', ceMethods);

  // Method 4: Check the network response for an API
  const apiData = await page.evaluate(async () => {
    // Try common API patterns
    const urls = [
      'https://clawhub.ai/api/skills',
      'https://wry-manatee-359.convex.site/api/v1/skills',
      'https://clawhub.ai/.netlify/functions/skills',
    ];
    const results = [];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (r.ok) results.push({ url, status: r.status, type: r.headers.get('content-type')?.substring(0, 50) });
        else results.push({ url, status: r.status });
      } catch(e) {
        results.push({ url, error: e.message });
      }
    }
    return results;
  });
  console.log('API probe:', apiData);

  // Method 5: Check if skills data is in a global JS variable
  const globalData = await page.evaluate(() => {
    const keys = ['skills', 'clawhubSkills', '__CLAWHUB__', 'skillData', 'state', 'store'];
    const results = {};
    for (const k of keys) {
      if (window[k]) results[k] = typeof window[k] === 'object' ? JSON.stringify(window[k]).substring(0, 200) : window[k];
    }
    return results;
  });
  console.log('Global data:', globalData);

  await browser.close();
}

test().catch(console.error);
