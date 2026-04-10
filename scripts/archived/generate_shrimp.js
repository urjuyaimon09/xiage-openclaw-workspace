
const https = require('https');
const fs = require('fs');
const { Buffer } = require('buffer');

// 使用免费的Stable Diffusion API via api-inference-community
const prompt = "cyberpunk cybernetics lobster avatar, neon glowing blue and pink highlights, mechanical implants, high tech future city background, hyper detailed, HD, 1024x1024 square, portrait avatar, digital art";

const payload = {
  prompt: prompt,
  negative_prompt: "bad anatomy, blurry, low quality, ugly, deformed",
  width: 1024,
  height: 1024,
  num_inference_steps: 20,
  guidance_scale: 7
};

const outputPath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\avatar_shrimp.png';

console.log('Generating cyberpunk lobster avatar...');

const options = {
  hostname: 'api-inference.huggingface.co',
  port: 443,
  path: '/models/stabilityai/stable-diffusion-xl-base-1.0',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(payload))
  }
};

const req = https.request(options, (res) => {
  let data = Buffer.alloc(0);
  res.on('data', (chunk) => {
    data = Buffer.concat([data, chunk]);
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode === 200) {
      fs.writeFileSync(outputPath, data);
      console.log(`✅ Successfully generated avatar! Saved to ${outputPath}`);
      console.log(`File size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.error('Error:');
      console.error(data.toString());
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(JSON.stringify(payload));
req.end();
