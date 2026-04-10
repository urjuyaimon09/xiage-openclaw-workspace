
const https = require('https');
const http = require('http');
const fs = require('fs');
const { Buffer } = require('buffer');

// 使用Hugging Face Stable Diffusion API免费生成
// 使用公共推理API
const API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";

// 不需要认证也可以访问，只是限速
const prompt = "cyberpunk lobster avatar, neon cyberpunk, futuristic technology, glowing neon blue and pink lights, mechanical lobster, high tech, sci-fi, HD 1024x1024, 1:1 square composition, sharp details, digital art, dark background";

const requestBody = {
  inputs: prompt,
  parameters: {
    width: 1024,
    height: 1024,
    num_inference_steps: 30,
    guidance_scale: 7.5
  }
};

console.log('正在调用Hugging Face Stable Diffusion XL生成赛博朋克龙虾头像...');

const parsedUrl = new URL(API_URL);
const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
  path: parsedUrl.pathname + parsedUrl.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(requestBody))
  }
};

const requester = https;

const req = requester.request(options, (res) => {
  let data = Buffer.alloc(0);
  res.on('data', (chunk) => {
    data = Buffer.concat([data, chunk]);
  });

  res.on('end', () => {
    console.log(`响应状态码: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_shrimp.png';
      fs.writeFileSync(outputPath, data);
      console.log(`✅ 头像生成成功，保存到: ${outputPath}`);
      console.log(`文件大小: ${data.length} 字节`);
    } else if (res.statusCode === 503) {
      console.error('模型加载中，请稍候重试');
      console.error(data.toString());
    } else {
      console.error('生成失败');
      console.error(data.toString());
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e);
  console.error('错误信息:', e.message);
  console.error('堆栈:', e.stack);
  process.exit(1);
});

req.write(JSON.stringify(requestBody));
req.end();
