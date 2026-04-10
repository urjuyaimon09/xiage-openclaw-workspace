const fs = require('fs');
const path = require('path');

// Search in the large sessions for actual user input text (not tool results, not CROSS_SESSION)
// Look for user message content with Chinese characters
const largeFiles = [
    '747c06c4-73bf-4676-b9d1-a28bfd666b90.jsonl',
    'b05ed96c-e2cc-4f5d-8b7a-d20690e79f9e.jsonl'
];

// Patterns that indicate user personal data (not metadata)
const dataPatterns = [
    '月收入', '年收入', '存款', '工资', '绩效', '股票', '比亚迪', '华为股票',
    '比特币', '债务', '投资', '亏损', '血脂', '血压', '尿酸', '糖尿病',
    '婚姻', '夫妻', '父亲', '母亲', '岳父', '岳母', '儿子', '女儿', '豚豚',
    '焦虑', '压力', '晋升', '调薪', '辞退', '裁员'
];

for (const fname of largeFiles) {
    const fpath = path.join('C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\', fname);
    const content = fs.readFileSync(fpath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            if (obj.type === 'message' && obj.message?.role === 'user') {
                const text = obj.message.content?.[0]?.text || '';
                // Check if it's real user content (not just metadata/conversation info)
                if (text.includes('ou_d5069f') && dataPatterns.some(p => text.includes(p))) {
                    // Extract the actual user text
                    const match = text.match(/ou_d5069f[^\n]*\n([\s\S]{20,500})/);
                    if (match) {
                        console.log(`\n=== ${fname} ===`);
                        console.log(match[1].substring(0, 500));
                    }
                }
            }
        } catch {}
    }
}
