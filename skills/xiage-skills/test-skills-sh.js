const https = require('https');
const https2 = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  // Test skills.sh/openclaw/skills page
  const html = await fetchUrl('https://skills.sh/openclaw/skills');
  console.log('HTML length:', html.length);
  
  // Check for data-name attributes
  const dataNameRe = /data-name="([^"]+)"/g;
  let m;
  let count = 0;
  while ((m = dataNameRe.exec(html)) !== null) count++;
  console.log('data-name count:', count);
  
  // Check for clawhub links
  const clawhubRe = /href="https:\/\/clawhub\.ai\/([^/]+)\/([^"?\s]+)"/g;
  count = 0;
  while ((m = clawhubRe.exec(html)) !== null) count++;
  console.log('clawhub links:', count);

  // Show snippet around first skill link
  const idx = html.indexOf('clawhub.ai');
  if (idx > 0) console.log('\nSnippet:', html.substring(Math.max(0, idx-50), idx+150));
}

main().catch(console.error);
