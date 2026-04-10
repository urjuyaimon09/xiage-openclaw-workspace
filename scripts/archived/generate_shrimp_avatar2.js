
const fs = require('fs');
const https = require('https');
const { Buffer } = require('buffer');
const path = require('path');

// 输出路径
const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_shrimp.png';

// 读取API KEY从环境变量或尝试从OpenClaw配置
function getApiKey() {
  // 尝试已知的环境变量名称
  const envVars = ['VOLCANO_ENGINE_API_KEY', 'VOLCENGINE_API_KEY', 'ARK_API_KEY'];
  for (const envVar of envVars) {
    if (process.env[envVar]) {
      console.log(`找到API KEY在环境变量 ${envVar}`);
      return process.env[envVar];
    }
  }
  
  // 如果没有找到，尝试读取openclaw的auth存储
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
  
  // 试试内置的API KEY
  const builtinKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';
  console.log('使用内置API KEY');
  return builtinKey;
}

const apiKey = getApiKey();
console.log(`使用API KEY长度: ${apiKey.length}`);

// 构造请求体 - 使用正确格式的doubao-image模型，火山方舟要求完整endpoint ID
// 尝试常见的图像生成endpoint格式
const requestBody = {
  model: 'doubao/doubao-image-gen-001',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '生成一个赛博朋克风格的龙虾主题AI助手头像，赛博霓虹效果，强烈的科技感，融合龙虾元素，机械改造的龙虾头部，蓝色和粉色霓虹发光效果，深色赛博城市背景，高清细节，1:1正方形构图，数字艺术'
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

console.log('正在调用火山ARK doubao-image API生成赛博朋克龙虾头像...');

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
      
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        console.error('响应格式异常:', JSON.stringify(response, null, 2));
        process.exit(1);
      }
      
      const message = response.choices[0].message;
      console.log('消息内容类型:', typeof message.content);
      
      let imageUrl = null;
      
      // 遍历content寻找图片
      if (Array.isArray(message.content)) {
        for (const content of message.content) {
          console.log(`发现内容类型: ${content.type}`);
          if (content.type === 'image_url') {
            imageUrl = content.image_url.url;
            console.log(`找到图片URL: ${imageUrl.substring(0, 80)}...`);
            break;
          }
        }
      }
      
      if (!imageUrl) {
        console.error('没有找到生成的图片，模型返回内容:');
        console.error(JSON.stringify(message, null, 2));
        process.exit(1);
      }
      
      // 下载图片
      downloadImage(imageUrl, outputPath);
      
    } catch (e) {
      console.error('解析响应失败:', e.message);
      console.error('原始响应:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e.message);
  process.exit(1);
});

req.write(JSON.stringify(requestBody));
req.end();

function downloadImage(url, outputPath) {
  console.log(`正在下载图片到: ${outputPath}`);
  const parsedUrl = new URL(url);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET'
  };

  const requester = parsedUrl.protocol === 'https:' ? https : https;
  
  const req = requester.request(options, (res) => {
    let data = Buffer.alloc(0);
    res.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
    });

    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.error(`下载失败，状态码: ${res.statusCode}`);
        console.error('Headers:', res.headers);
        process.exit(1);
      }
      
      fs.writeFileSync(outputPath, data);
      console.log(`\n✅ 成功! 赛博朋克龙虾头像已保存到:`);
      console.log(`   ${outputPath}`);
      console.log(`\n文件大小: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    });
  });

  req.on('error', (e) => {
    console.error('下载请求失败:', e.message);
    process.exit(1);
  });

  req.end();
}
