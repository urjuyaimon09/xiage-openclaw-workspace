const fs = require('fs');
const https = require('https');
const http = require('http');
const { Buffer } = require('buffer');
const path = require('path');

// 读取环境变量中的API KEY（从OpenClaw配置获取）
const apiKey = process.env.VOLCENGINE_API_KEY;
const endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const imagePath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_original.jpg';

if (!apiKey) {
  console.error('错误: 请设置 VOLCENGINE_API_KEY 环境变量');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`错误: 图片文件不存在: ${imagePath}`);
  process.exit(1);
}

// 读取图片并转为base64
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');

// 构造请求 - 使用支持文生图/图像生成的模型，这里假设使用doubao-image生成
const requestBody = {
  model: 'doubao-image-32k',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '请将这张头像转换为日系动漫风格，保持原人物的五官特征不变，生成一张高质量的日系动漫头像，输出为PNG格式图片'
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
          }
        }
      ]
    }
  ]
};

const parsedUrl = new URL(endpoint);
const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
  path: parsedUrl.pathname + parsedUrl.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Content-Length': Buffer.byteLength(JSON.stringify(requestBody))
  }
};

const requester = parsedUrl.protocol === 'https:' ? https : http;

console.log('正在调用火山ARK API生成日系动漫头像...');

const req = requester.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`API错误: 状态码 ${res.statusCode}`);
      console.error('响应内容:', data);
      process.exit(1);
    }

    try {
      const response = JSON.parse(data);
      console.log('收到响应，解析结果...');
      
      // 提取图片URL - 不同模型返回格式可能不同
      const message = response.choices[0].message;
      
      // 处理图像生成响应
      for (const content of message.content) {
        if (content.type === 'image_url') {
          const imageUrl = content.image_url.url;
          console.log(`获取到图片URL: ${imageUrl}`);
          downloadImage(imageUrl, 'avatar_anime.png');
          return;
        }
      }
      
      // 如果返回的是文本描述，检查是否有图片链接在文本中
      if (message.content[0].type === 'text') {
        console.log('模型返回文本:', message.content[0].text);
      }
      
      console.error('错误: 未在响应中找到生成的图片');
      process.exit(1);
      
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
  console.log(`正在下载生成的图片到 ${outputPath}...`);
  const parsedUrl = new URL(url);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET'
  };

  const requester = parsedUrl.protocol === 'https:' ? https : http;
  
  const req = requester.request(options, (res) => {
    let data = Buffer.alloc(0);
    res.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
    });

    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.error(`下载失败: 状态码 ${res.statusCode}`);
        process.exit(1);
      }
      
      const fullPath = path.join('C:\\Users\\Administrator\\.openclaw\\workspace', outputPath);
      fs.writeFileSync(fullPath, data);
      console.log(`✅ 图片已保存到: ${fullPath}`);
      console.log(`尺寸: ${data.length} 字节`);
    });
  });

  req.on('error', (e) => {
    console.error('下载失败:', e.message);
    process.exit(1);
  });

  req.end();
}
