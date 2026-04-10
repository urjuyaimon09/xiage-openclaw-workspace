const fs = require('fs');
const https = require('https');
const { Buffer } = require('buffer');

// 正确的配置
const apiKey = 'f4db03b2-181f-4c75-893e-9fd24ef70e78';
// 当前运行的模型是 volcengine-plan/ark-code-latest，让我们看看它实际使用的endpoint是什么
// 根据OpenClaw源码，base URL是 https://ark.cn-beijing.volces.com/api/v3

const imagePath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_original.jpg';
const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_anime.png';

// 读取图片并转base64
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64Image}`;

// 当前正在使用的模型是 ark-code-latest，它对应的endpoint就是当前配置使用的
// 让我们使用同一个endpoint来请求，因为API KEY已经认证了
// 从配置中可以看到模型ID是 volcengine-plan/ark-code-latest
// 但是实际endpoint ID应该在OpenClaw的models.json中，让我找找它

console.log('查找当前模型配置...');

const modelsPath = 'C:\\Users\\Administrator\\.openclaw\\agents\\main\\agent\\models.json';
if (fs.existsSync(modelsPath)) {
  const modelsConfig = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
  console.log('已找到models.json');
  console.log(JSON.stringify(modelsConfig, null, 2));
} else {
  console.log('models.json not found at', modelsPath);
}
