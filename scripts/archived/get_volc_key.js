const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 尝试从openclaw获取API KEY
function getVolcengineApiKey() {
  try {
    // 尝试用openclaw命令获取
    const output = execSync('openclaw auth list', { encoding: 'utf8' });
    console.log('Auth list output:', output);
  } catch (e) {
    console.log('Failed to get auth list:', e.message);
  }
  
  // 检查环境变量
  if (process.env.VOLCANO_ENGINE_API_KEY) {
    console.log('Found VOLCANO_ENGINE_API_KEY in environment');
    console.log('Key length:', process.env.VOLCANO_ENGINE_API_KEY.length);
    return process.env.VOLCANO_ENGINE_API_KEY;
  }
  
  if (process.env.VOLCENGINE_API_KEY) {
    console.log('Found VOLCENGINE_API_KEY in environment');
    return process.env.VOLCENGINE_API_KEY;
  }
  
  console.log('No API key found in environment variables');
  return null;
}

const apiKey = getVolcengineApiKey();
if (apiKey) {
  console.log(`API Key found: ${apiKey.substring(0, 10)}...`);
  // 保存到文件供脚本使用
  fs.writeFileSync('api_key.txt', apiKey);
  console.log('API key saved to api_key.txt');
} else {
  console.log('No API key found');
}
