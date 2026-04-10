const fs = require('fs');
const https = require('https');
const { Buffer } = require('buffer');

const apiKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';
const modelId = 'doubao-seed-1-8-251228';
const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';

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

console.log(`使用模型: ${modelId}`);
console.log(`原始图片大小: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

// 构造请求体 - 这个模型支持图像输入，让它描述然后指导生成，或者直接让它返回图像
const requestBody = {
  model: modelId,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '这是一张人物头像照片。请帮我将这张照片转换为日系动漫风格，必须严格保持原人物的五官特征、脸型、发型表情和构图不变。请直接描述如何生成，如果你支持图像生成，请返回生成后的图片URL。'
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

const endpoint = `${baseUrl}/chat/completions`;
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
      
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        console.error('响应格式无效:', JSON.stringify(response, null, 2));
        process.exit(1);
      }
      
      const message = response.choices[0].message;
      console.log('\n模型回复:');
      
      if (Array.isArray(message.content)) {
        // 多模态内容，检查是否有图片
        let hasImage = false;
        for (const content of message.content) {
          if (content.type === 'text') {
            console.log(content.text);
          } else if (content.type === 'image_url') {
            console.log('\n找到生成的图片!');
            hasImage = true;
            downloadImage(content.image_url.url, outputPath);
          }
        }
        if (!hasImage) {
          console.log('\n模型没有返回图片，请根据上面的文本描述重新生成');
        }
      } else if (typeof message.content === 'string') {
        console.log(message.content);
        console.log('\n注意: 模型只返回了文本，没有生成图片。这个模型是视觉语言模型，不支持图像生成。');
        console.log('需要使用专门的图像生成模型端点。');
      }
      
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
