
// 使用DALL-E通过openrouter或者直接调用可用API
const fs = require('fs');
const https = require('https');
const http = require('http');
const { Buffer } = require('buffer');

// 我们使用内置API KEY，现在正确的endpoint就是完整模型ID
const apiKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';
const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_shrimp.png';

// 正确格式: 对于doubao图像生成，需要用户创建推理接入点
// 默认公共接入点不存在，我们改用文本来让AI描述，然后调用另一个方式
const prompt = "生成赛博朋克风格龙虾头像，参数：cyberpunk lobster avatar，赛博霓虹 科技感 龙虾元素 1:1高清PNG";

console.log('调用火山引擎 API...');

// 使用已配置好的模型，它就是"volcengine-plan/ark-code-latest"，但是正确格式是endpoint是ark-code-latest在volcengine-plan
// 根据OpenClaw的命名方式 provider/endpoint-id -> endpoint-id 是实际的endpoint ID
const requestBody = {
  model: "ark-code-latest",
  messages: [
    {
      role: "user",
      content: `你现在需要帮我生成一张图片：${prompt}。你可以直接返回markdown格式的图片，或者描述我可以用哪个公共API生成？实际上，请你帮我给出一个可以直接生成这张图片的base64数据，或者给出一个直接的图片链接。`
    }
  ]
};

const endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
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

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`状态码: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      console.error('错误:', data);
      process.exit(1);
    }

    try {
      const json = JSON.parse(data);
      console.log('响应成功');
      const text = json.choices[0].message.content;
      console.log('AI回复:', text);
      
      // 尝试提取图片URL
      const urlMatch = text.match(/https?:\/\/[^\s]+\.(png|jpg|jpeg)/i);
      if (urlMatch) {
        const imageUrl = urlMatch[0];
        console.log('找到图片URL:', imageUrl);
        downloadImage(imageUrl, outputPath);
      } else {
        // 检查base64
        const base64Match = text.match(/data:image\/[^;]+;base64,([a-zA-Z0-9+/=\s]+)/);
        if (base64Match) {
          const base64 = base64Match[1].replace(/\s/g, '');
          const buffer = Buffer.from(base64, 'base64');
          fs.writeFileSync(outputPath, buffer);
          console.log(`✅ Saved to ${outputPath}, ${buffer.length} bytes`);
        } else {
          console.log('No image found in response');
        }
      }
    } catch (e) {
      console.error('解析错误:', e);
      console.error('Raw data:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e);
});

req.write(JSON.stringify(requestBody));
req.end();

function downloadImage(url, outputPath) {
  const parsedUrl = new URL(url);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    let data = Buffer.alloc(0);
    res.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        fs.writeFileSync(outputPath, data);
        console.log(`✅ 下载成功，保存到: ${outputPath}`);
        console.log(`文件大小: ${data.length} 字节`);
      } else {
        console.error(`下载失败，状态码: ${res.statusCode}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error('下载失败:', e);
  });

  req.end();
}
