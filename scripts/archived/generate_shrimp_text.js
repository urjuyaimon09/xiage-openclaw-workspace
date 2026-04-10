
const fs = require('fs');
const https = require('https');
const { Buffer } = require('buffer');
const path = require('path');

// 输出路径
const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_shrimp.png';

// 读取API KEY从环境变量或尝试从OpenClaw配置
function getApiKey() {
  const envVars = ['VOLCANO_ENGINE_API_KEY', 'VOLCENGINE_API_KEY', 'ARK_API_KEY'];
  for (const envVar of envVars) {
    if (process.env[envVar]) {
      console.log(`找到API KEY在环境变量 ${envVar}`);
      return process.env[envVar];
    }
  }
  const authPath = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'auth');
  if (fs.existsSync(authPath)) {
    const files = fs.readdirSync(authPath);
    for (const file of files) {
      if (file.includes('volc') || file.includes('ark')) {
        try {
          const content = fs.readFileSync(path.join(authPath, file), 'utf8');
          const data = JSON.parse(content);
          if (data.credential?.apiKey) {
            console.log(`找到API KEY在认证文件 ${file}`);
            return data.credential.apiKey;
          }
        } catch (e) {
          continue;
        }
      }
    }
  }
  const builtinKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';
  console.log('使用内置API KEY');
  return builtinKey;
}

const apiKey = getApiKey();
console.log(`使用API KEY长度: ${apiKey.length}`);

// 使用当前已配置好的模型ID volcengine-plan/ark-code-latest
const requestBody = {
  model: 'volcengine-plan/ark-code-latest',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '我需要你帮我生成一张图片：一个赛博朋克风格的龙虾主题AI助手头像，要求：赛博霓虹效果，强烈科技感，融合龙虾元素，机械改造龙虾头部，蓝色粉色霓虹发光，深色背景，高清细节，1:1正方形构图。请你直接帮我生成这张图片，并返回图片链接。'
        }
      ]
    }
  ]
};

const endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const parsedUrl = new URL(endpoint);

const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || 443,
  path: parsedUrl.pathname + parsedUrl.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Content-Length': Buffer.byteLength(JSON.stringify(requestBody))
  }
};

console.log('正在调用火山ARK API...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`响应状态码: ${res.statusCode}`);
    
    if (res.statusCode !== 200) {
      console.error('API错误响应:');
      console.error(data);
      process.exit(1);
    }

    try {
      const response = JSON.parse(data);
      console.log('解析响应成功');
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.error('解析失败:', e.message);
      console.error('原始数据:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e.message);
  process.exit(1);
});

req.write(JSON.stringify(requestBody));
req.end();
