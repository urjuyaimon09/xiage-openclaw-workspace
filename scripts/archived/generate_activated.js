const fs = require('fs');
const https = require('https');
const { Buffer } = require('buffer');

const apiKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';
const modelId = 'doubao-seed-code-preview-251028';
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

// 构造请求
const requestBody = {
  model: modelId,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '这是一张人物头像照片。我需要你帮我将这张照片转换成日系动漫风格，保持原人物的五官特征、脸型、发型、表情和构图都不变，只改变绘画风格为干净清爽的日系动漫插画。请基于对原图五官的分析，给出详细提示词用于AI图像生成，如果可以直接生成图片请返回图片链接。'
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
        for (const content of message.content) {
          if (content.type === 'text') {
            console.log(content.text);
            // 保存回复到文件
            fs.writeFileSync('C:\\Users\\Administrator\\.openclaw\\workspace\\model_response.txt', content.text);
            console.log('\n(回复已保存到 model_response.txt)');
          } else if (content.type === 'image_url') {
            console.log('\n找到生成的图片!');
            downloadImage(content.image_url.url, outputPath);
          }
        }
      } else if (typeof message.content === 'string') {
        console.log(message.content);
        fs.writeFileSync('C:\\Users\\Administrator\\.openclaw\\workspace\\model_response.txt', message.content);
        console.log('\n(回复已保存到 model_response.txt)');
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
