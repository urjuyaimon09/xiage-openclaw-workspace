
const Tesseract = require('tesseract.js');
const path = require('path');

const imagePath = path.join('C:', 'Users', 'Administrator', '.openclaw', 'media', 'inbound', 'd0471ae7-1c75-4e25-ac90-5c3cabed388d.jpg');

async function extractText() {
  console.log('Starting OCR...');
  const { data: { text } } = await Tesseract.recognize(
    imagePath,
    'chi_sim+eng',
    {
      logger: m => {} // 禁用日志
    }
  );
  console.log('\n--- Extracted Text ---\n');
  console.log(text);
}

extractText().catch(err => console.error(err));
