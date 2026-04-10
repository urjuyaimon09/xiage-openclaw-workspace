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
  
  // Use CDP (Chrome DevTools Protocol) via puppeteer to access complete DOM including shadow DOM
  const client = page.target().createCDPSession();
  
  // Get document with shadow DOM content
  const { root } = await client.send('DOM.getDocument', { depth: -1, pierce: true });
  
  // Find all anchor tags with href containing 'clawhub'
  const result = await client.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: 'a[href*="clawhub"]'
  });
  console.log('All clawhub links via CDP pierce:', result.nodeIds.length);
  
  // Try to get the actual skill card elements using deep search
  const allAnchors = await client.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: 'a'
  });
  console.log('All <a> tags:', allAnchors.nodeIds.length);
  
  // Get innerHTML of the skills container using CDP
  const containerResult = await client.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.skills-container'
  });
  if (containerResult.nodeId) {
    const attrs = await client.send('DOM.getAttributes', { nodeId: containerResult.nodeId });
    console.log('skills-container attributes:', attrs.attributes);
    
    // Get full markup for this node
    const box = await client.send('DOM.getBoxModel', { nodeId: containerResult.nodeId });
    console.log('Box model:', box);
    
    // Try getting children
    const children = await client.send('DOM.requestChildNodes', { nodeId: containerResult.nodeId, depth: 2, pierce: true });
    console.log('Container children:', children.nodes?.length);
  }
  
  // Another approach: use JS to walk all nodes including shadow DOMs
  const skillData = await page.evaluate(async () => {
    // Try piercing through shadow DOMs
    function getDeepText(node, maxDepth = 20, depth = 0) {
      if (depth > maxDepth) return [];
      const results = [];
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.replace(/\s+/g, ' ').trim();
        if (t.length > 5 && /[a-zA-Z]{4,}/.test(t)) results.push(t);
      }
      // Check shadow root
      if (node.shadowRoot) {
        for (const child of node.shadowRoot.childNodes) {
          results.push(...getDeepText(child, maxDepth, depth + 1));
        }
      }
      // Check standard children
      if (node.childNodes) {
        for (const child of node.childNodes) {
          results.push(...getDeepText(child, maxDepth, depth + 1));
        }
      }
      return results;
    }
    
    const allText = getDeepText(document.body);
    // Filter for skill-like text
    return allText.filter(t => t.includes('@') && t.includes('k') || t.includes('★')).slice(0, 20);
  });
  console.log('\nSkill data via shadow piercing:', skillData);
  
  await browser.close();
}

test().catch(console.error);
