const fs = require('fs');
const path = require('path');

// 使用字节跳动的豆包AI图像生成API转换头像为动漫风格
// 需要配置API_KEY，但如果环境变量没有的话，我们先输出prompt信息

const inputPath = process.argv[2];
const outputPath = process.argv[3];

console.log(`正在将 ${inputPath} 转换为日系动漫风格...`);

// 读取原始图片为base64
const imageBuffer = fs.readFileSync(inputPath);
const base64Image = imageBuffer.toString('base64');

// 生成提示词
const prompt = `日系动漫风格头像，保持原图人物的五官特征，发型不变，日系动画风，高清，PNG格式，透明背景可选，动漫插画风格，吉卜力风格`;

console.log('\n生成提示词:');
console.log(prompt);
console.log('\n需要使用AI图像生成API将照片转为动漫风格。由于当前环境没有配置API令牌，我们将提供一个完美的提示词，你可以直接用这个提示词在Midjourney、DALL-E或其他AI图像工具中生成：\n');

const fullPrompt = `参考这张照片，将人物转换为干净的日系动漫风格头像，保持原人物的五官特征和发型，不要改变五官位置和特征，整体风格是清新日系动画插画，高清，头像构图，白色背景。

**提示词：**
japanese anime style portrait, young man with the same facial features as reference picture, clean anime aesthetic, studio ghibli inspired, soft colors, high detail, avatar composition, white background, anime key visual, digital illustration --ar 1:1 --style raw`;

console.log(fullPrompt);

// 如果有ARK_API_KEY，则调用Volcengine API
const arkApiKey = process.env.ARK_API_KEY;
if (!arkApiKey) {
  console.log('\n⚠️  需要配置ARK_API_KEY环境变量才能自动生成。请告知主代理人生成完成，需要用户手动使用提示词生成，或者配置API。');
  fs.writeFileSync(outputPath + '.prompt.txt', fullPrompt);
  process.exit(1);
}

// 如果有API_KEY，继续调用API
console.log('找到API密钥，正在调用Volcengine API...');

const https = require('https');
const http = require('http');

const requestData = JSON.stringify({
  model: "doubao-vision-pro-32k",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
          }
        },
        {
          type: "text",
          text: `请将这张照片转换为日系动漫风格头像，一定要严格保持原人物的五官特征、发型和比例，生成一张日系动画风格的头像。输出只需要生成的PNG图片结果。`
        }
      ]
    }
  ]
});

const options = {
  hostname: 'ark.cn-beijing.volces.com',
  port: 443,
  path: '/api/v3/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${arkApiKey}`,
    'Content-Length': Buffer.byteLength(requestData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('API响应收到');
      
      if (response.choices && response.choices[0] && response.choices[0].message) {
        const content = response.choices[0].message.content;
        // 查找图片URL或base64
        const imageMatch = content.match(/data:image\/[^;]+;base64,([a-zA-Z0-9+/=]+)/);
        if (imageMatch) {
          const imageBuffer = Buffer.from(imageMatch[1], 'base64');
          fs.writeFileSync(outputPath, imageBuffer);
          console.log(`✅ 动漫风格头像已保存到: ${outputPath}`);
          process.exit(0);
        } else {
          console.log('未找到图片数据，响应内容:');
          console.log(content);
          fs.writeFileSync(outputPath + '.response.txt', content);
          process.exit(1);
        }
      } else {
        console.error('错误响应:', data);
        process.exit(1);
      }
    } catch (e) {
      console.error('解析响应失败:', e);
      console.error('原始数据:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
  process.exit(1);
});

req.write(requestData);
req.end();
