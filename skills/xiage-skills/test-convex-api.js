const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error(`JSON parse failed: ${e.message}. Data: ${data.substring(0, 500)}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Try the Convex API
  try {
    const data = await fetchJson('https://wry-manatee-359.convex.site/api/v1/skills');
    console.log('Convex API - type:', typeof data, 'isArray:', Array.isArray(data));
    if (Array.isArray(data)) {
      console.log('Total skills:', data.length);
      console.log('First 3:', JSON.stringify(data.slice(0, 3), null, 2));
    } else if (typeof data === 'object') {
      console.log('Keys:', Object.keys(data));
      const keys = Object.keys(data);
      if (keys.length > 0) {
        const firstKey = keys[0];
        const val = data[firstKey];
        if (Array.isArray(val)) {
          console.log(`${firstKey}: ${val.length} items`);
          console.log('First item:', JSON.stringify(val[0], null, 2));
        }
      }
    } else {
      console.log('Raw data:', JSON.stringify(data).substring(0, 1000));
    }
  } catch(e) {
    console.error('Convex API error:', e.message);
  }
  
  // Try with different convex site IDs
  const sites = [
    'https://wry-manatee-359.convex.site/api/v1/skills?limit=10',
    'https://wry-manatee-359.convex.site/api/v1/skills/list',
    'https://clawhub.ai/api/v1/skills',
  ];
  for (const url of sites) {
    try {
      const d = await fetchJson(url);
      console.log(`\n${url}:`, Array.isArray(d) ? `${d.length} items` : typeof d);
    } catch(e) {
      console.log(`\n${url}: ERROR - ${e.message.substring(0, 100)}`);
    }
  }
}

main().catch(console.error);
