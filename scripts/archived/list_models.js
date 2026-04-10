const fs = require('fs');
const https = require('https');

const apiKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';

// 火山ARK正确的图像生成模型
// 常见选项： doubao-pro-1.5k, doubao-pro-32k, 或者使用image generation endpoint
// 试试doubao-pro-32k
const modelId = 'doubao-pro-32k';

const imagePath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_original.jpg';
const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_anime.png';

if (!fs.existsSync(imagePath)) {
  console.error(`错误: 原始图片不存在: ${imagePath}`);
  process.exit(1);
}

// 读取图片并转为base64
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64Image}`;

const requestBody = {
  model: modelId,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '你是一个图像转换AI。请将这张头像转换为日系动漫风格，必须严格保持原人物的五官特征、姿态和构图不变，只改变绘画风格为干净的日系动漫插画风格。请返回生成的图片URL。'
        },
        {
          type: 'image_url',
          image_url: {
            url: dataUrl
          }
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

console.log(`使用模型: ${modelId}`);
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
      console.log('\n完整响应:');
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.error('解析失败:');
      console.error(data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e.message);
  process.exit(1);
});

req.write(JSON.stringify(requestBody));
req.end();
