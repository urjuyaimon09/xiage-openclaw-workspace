const fs = require('fs');
const https = require('https');

const apiKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';

// 用户需要在火山ARK控制台创建推理接入点，正确的模型ID格式是: {account_id}/{endpoint_id}
// 但是doubao支持图像编辑，让我试试使用正确的格式
// 根据火山文档，图像生成/编辑模型入口:
// https://www.volcengine.com/docs/82379/1339793

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

// 尝试几个常见的公开可访问模型ID
const testModels = [
  'doubao/doubao-vision-pro',
  'bytedance-doubao/doubao-vision-pro',
  'doubao-vision-pro',
  'doubao-image-gen',
  'image-generation-001',
  'doubao-pro'
];

console.log('尝试不同的模型ID...\n');

let currentModel = 0;

function tryNextModel() {
  if (currentModel >= testModels.length) {
    console.error('\n所有测试模型都失败了');
    console.log('\n根据火山ARK文档，你需要:');
    console.log('1. 登录火山引擎ARK控制台: https://console.volcengine.com/ark');
    console.log('2. 创建一个推理接入点，选择doubao图像模型');
    console.log('3. 获取完整的Endpoint ID (格式: ep-xxxxxx)');
    process.exit(1);
  }
  
  const modelId = testModels[currentModel];
  currentModel++;
  
  console.log(`\n==> 尝试模型: ${modelId}`);
  
  const requestBody = {
    model: modelId,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请描述这张图片中的人物长相和五官特征，然后生成一张相同五官长相的日系动漫风格头像。'
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

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`状态码: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(data);
          console.log('\n成功!响应:');
          console.log(JSON.stringify(response, null, 2));
          return;
        } catch (e) {
          console.log('解析失败:', data);
        }
      } else {
        console.log('错误:', data);
      }
      
      // 尝试下一个模型
      setTimeout(tryNextModel, 500);
    });
  });

  req.on('error', (e) => {
    console.error('请求失败:', e.message);
    setTimeout(tryNextModel, 500);
  });

  req.write(JSON.stringify(requestBody));
  req.end();
}

tryNextModel();
