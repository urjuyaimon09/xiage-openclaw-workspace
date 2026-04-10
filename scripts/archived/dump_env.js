
console.log('Environment variables:');
for (const key in process.env) {
  if (key.toLowerCase().includes('volc') || key.toLowerCase().includes('ark') || key.toLowerCase().includes('api')) {
    console.log(`${key}=${process.env[key].substring(0, 10)}...`);
  }
}
