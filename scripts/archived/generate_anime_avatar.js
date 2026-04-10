const fs = require('fs');
const https = require('https');
const { Buffer } = require('buffer');
const path = require('path');

// 读取原图片
const imagePath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_original.jpg';
const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_anime.png';

if (!fs.existsSync(imagePath)) {
  console.error(`错误: 原始图片不存在: ${imagePath}`);
  process.exit(1);
}

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
  
  console.error('无法找到火山ARK API KEY');
  console.error('请确保已通过 openclaw configure 配置了volcengine认证');
  process.exit(1);
}

const apiKey = getApiKey();
console.log(`使用API KEY长度: ${apiKey.length}`);

// 读取图片并转为base64
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64Image}`;

// 构造请求体 - 使用doubao-image模型进行图像生成/编辑
const requestBody = {
  model: 'doubao-image-32k',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '将这张头像转换为日系动漫风格，必须严格保持原人物的五官特征不变，生成一张高质量的日系动漫头像，保持人物姿态和构图不变。'
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

console.log('正在调用火山ARK doubao-image API...');

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
            console.log(`找到图片URL: ${imageUrl.substring(0, 100)}...`);
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
      console.log(`\n✅ 成功! 日系动漫头像已保存到:`);
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
