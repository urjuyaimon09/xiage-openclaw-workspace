
const { spawnSync } = require('child_process');
const fs = require('fs');

// Print all env that contains volc in openclaw
const result = spawnSync('openclaw', ['env'], { encoding: 'utf8' });

if (result.stdout) {
  console.log('STDOUT from openclaw:');
  const lines = result.stdout.split('\n');
  let apiKey = null;
  
  for (const line of lines) {
    if (line.includes('VOLC') || line.includes('volc') || line.includes('API_KEY') || line.includes('api_key')) {
      console.log('Found:', line);
      if (line.includes('=')) {
        const [key, value] = line.split('=', 2);
        if (key.includes('VOLC') || key.includes('volc')) {
          apiKey = value.trim();
          console.log(`Got API KEY: ${apiKey.substring(0, 8)}...`);
          fs.writeFileSync('api_key.txt', apiKey);
          console.log('Saved to api_key.txt');
          process.exit(0);
        }
      }
    }
  }
  
  if (!apiKey) {
    console.log('No volcengine API KEY found in openclaw env');
    process.exit(1);
  }
}

if (result.stderr) {
  console.error('STDERR:', result.stderr);
  process.exit(1);
}
