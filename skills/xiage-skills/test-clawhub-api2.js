const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function main() {
  // Check the convex http_client bundle for API patterns
  const { data } = await fetchUrl('https://clawhub.ai/assets/http_client-BcenHLLb.js');
  
  // Look for API endpoint patterns
  const apiPatterns = [
    /convex\.site[^"'`\s]+/g,
    /\/api\/v1\/[a-z][a-zA-Z]+/g,
    /skills.*\.(ts|js)/g,
  ];
  
  for (const p of apiPatterns) {
    const matches = data.match(p);
    if (matches) {
      console.log(`Pattern ${p}:`, [...new Set(matches)].slice(0, 10));
    }
  }
  
  // Also check the main JS bundle
  const mainData = await fetchUrl('https://clawhub.ai/assets/main-C_iS0jIE.js');
  const mainMatches = mainData.data.match(/convex\.site[^"'`\s]+/g);
  console.log('Convex site refs in main:', [...new Set(mainMatches || [])].slice(0, 10));
  
  // Try to find what query the skills page uses
  const storeMatches = mainData.data.match(/query\w*\(["'](?:skills|list|all)["']/g);
  console.log('Query calls:', storeMatches?.slice(0, 5));
  
  // Look for "37,761" or similar number patterns
  const countMatches = mainData.data.match(/37,761|37761|[0-9]{2,3},[0-9]{3}/g);
  console.log('Count refs:', [...new Set(countMatches || [])].slice(0, 10));
}

main().catch(console.error);
