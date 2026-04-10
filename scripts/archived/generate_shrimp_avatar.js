
const fs = require('fs');
const https = require('https');
const http = require('http');
const { Buffer } = require('buffer');
const path = require('path');

// 获取API KEY从环境变量
function getApiKey() {
  // 检查环境变量
  const envVars = ['VOLCANO_ENGINE_API_KEY', 'VOLCENGINE_API_KEY', 'ARK_API_KEY'];
  for (const envVar of envVars) {
    if (process.env[envVar]) {
      console.log(`找到API KEY在环境变量 ${envVar}`);
      return process.env[envVar];
    }
  }
  
  // 尝试从openclaw认证目录读取
  const authPath = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'auth');
  if (fs.existsSync(authPath)) {
    const files = fs.readdirSync(authPath);
    for (const file of files) {
      try {
        const fullPath = path.join(authPath, file);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (data.credential?.apiKey) {
          console.log(`找到API KEY在认证文件 ${file}`);
          return data.credential.apiKey;
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  console.error('无法找到可用的ARK API KEY');
  return null;
}

// 使用已有的API密钥
const apiKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';
console.log(`使用API KEY，长度: ${apiKey.length}`);

// 火山图像生成需要使用完整的endpoint URL，而不是model字段
const endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const outputPath = 'avatar_shrimp.png';

// 使用正确的模型ID格式 - 需要账号/端点格式
// 根据火山文档，使用公开可访问的模型ID
const requestBody = {
  model: 'bytedance-doubao/doubao-pro-32k',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '请为我生成一张图片：一个赛博朋克风格的龙虾主题AI助手头像，赛博霓虹效果，强烈的科技感，融合龙虾元素，机械改造的龙虾头部，蓝色粉色霓虹光效，深色赛博城市背景，高清细节，1:1正方形构图，请直接输出生成的图片'
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

console.log('正在调用火山方舟AI生成赛博朋克龙虾头像...');

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
      
      // 提取图片URL
      const message = response.choices[0].message;
      
      // 处理图像生成响应
      for (const content of message.content) {
        if (content.type === 'image_url') {
          const imageUrl = content.image_url.url;
          console.log(`获取到图片URL: ${imageUrl.substring(0, 100)}...`);
          downloadImage(imageUrl, outputPath);
          return;
        }
      }
      
      // 如果返回的是文本，输出看看
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
      console.log(`✅ 头像已保存到: ${fullPath}`);
      console.log(`文件大小: ${data.length} 字节`);
    });
  });

  req.on('error', (e) => {
    console.error('下载失败:', e.message);
    process.exit(1);
  });

  req.end();
}
