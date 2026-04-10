const https = require('https');

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`URL: ${url}`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, JSON.stringify(res.headers).substring(0, 200));
        try {
          const parsed = JSON.parse(data);
          console.log(`Parsed: keys=${Object.keys(parsed).join(',')}`);
          if (parsed.items !== undefined) console.log(`Items count: ${parsed.items.length}, nextCursor: ${parsed.nextCursor}`);
          if (parsed._state !== undefined) console.log(`_state:`, JSON.stringify(parsed._state).substring(0, 300));
          // Print first few items if any
          if (parsed.items && parsed.items.length > 0) {
            console.log(`First item:`, JSON.stringify(parsed.items[0]).substring(0, 500));
          }
          // Print raw first 500 chars
          console.log(`Raw (500):`, data.substring(0, 500));
        } catch(e) {
          console.log(`Not JSON: ${data.substring(0, 200)}`);
        }
        console.log('---');
      });
    }).on('error', reject);
  });
}

async function main() {
  // The convex site used by clawhub
  await fetchJson('https://wry-manatee-359.convex.site/api/v1/skills');
  await fetchJson('https://wry-manatee-359.convex.site/api/v1/skills/list');
  await fetchJson('https://wry-manatee-359.convex.site/api/v1/skills?limit=5');
  await fetchJson('https://wry-manatee-359.convex.site/api/v1/skills?count=5');
  
  // Also check what the page's JS bundle uses for API calls
  // by looking at the convex api module path
  await fetchJson('https://wry-manatee-359.convex.site/api/v1/site/stats');
  await fetchJson('https://wry-manatee-359.convex.site/api/v1/package/list');
  await fetchJson('https://wry-manatee-359.convex.site/api/v1/skill/list');
}

main().catch(console.error);
