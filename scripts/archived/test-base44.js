const { createClient } = require('@base44/sdk');

async function test() {
  console.log('Creating client...');
  const client = createClient({ apiKey: '5fc261e48bd8479d98277030e4834e83' });
  console.log('Client created');
  
  try {
    // Try to list workspaces/apps
    console.log('Trying to get user info...');
    const user = await client.auth.me();
    console.log('User:', JSON.stringify(user, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    if (err.code) console.error('Code:', err.code);
    if (err.status) console.error('Status:', err.status);
  }
}

test().catch(console.error);
setTimeout(() => { console.log('timeout, exiting'); process.exit(1); }, 15000);
