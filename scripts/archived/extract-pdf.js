const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const filename = 'C:/Users/Administrator/.openclaw/media/inbound/OpenClawå_è_¾å_æ_æ_å_-28ä_ªæ_ä¾---a3c65d7d-1b03-4a2f-8d46-783fa7dfb5c6.pdf';

const dataBuffer = fs.readFileSync(filename);

const parser = new PDFParse();
parser.parse(dataBuffer).then(data => {
  console.log('Total pages:', data.numpages);
  console.log('First 3000 chars of text:');
  console.log(data.text ? data.text.slice(0, 3000) : 'No text field');
  console.log('Keys:', Object.keys(data));
}).catch(err => {
  console.error('Error:', err.message);
});
