
const fs = require('fs');
const path = require('path');

const openclawJsonPath = path.join(process.env.USERPROFILE, '.openclaw', 'openclaw.json');
const config = JSON.parse(fs.readFileSync(openclawJsonPath, 'utf8'));

console.log('Config structure:');
console.log(JSON.stringify(config, null, 2));

// Check if there are any endpoints or models defined
if (config.agents && config.agents.defaults && config.agents.defaults.models) {
  console.log('\n--- Defined models ---');
  console.log(Object.keys(config.agents.defaults.models));
  Object.entries(config.agents.defaults.models).forEach(([key, value]) => {
    console.log(`${key}:`, JSON.stringify(value));
  });
}
