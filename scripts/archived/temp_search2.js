const fs = require('fs');
const path = require('path');

// Search large files for user messages (not tool results) with personal data
const files = [
    '747c06c4-73bf-4676-b9d1-a28bfd666b90.jsonl',
    'b05ed96c-e2cc-4f5d-8b7a-d20690e79f9e.jsonl'
];

const dataPatterns = [
    '月收入', '年收入', '月支出', '存款', '工资', '绩效C', '股票',
    '比特币', '债务', '投资亏损', '血脂', '血压', '尿酸',
    '焦虑', '压力', '晋升', '调薪', '父亲养老', '母亲健康',
    '夫妻关系', '家庭能量', '豚豚', '璐姐'
];

let count = 0;
for (const fname of files) {
    const fpath = path.join('C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\', fname);
    const content = fs.readFileSync(fpath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
        if (!line.includes('"role":"user"')) continue;
        for (const pattern of dataPatterns) {
            if (line.includes(pattern)) {
                try {
                    const obj = JSON.parse(line);
                    const text = obj.message?.content?.[0]?.text || '';
                    if (text.includes('ou_d5069f') && text.length > 100) {
                        console.log(`\n=== ${fname} line ${count} contains '${pattern}' ===`);
                        console.log(text.substring(0, 600));
                        console.log('===');
                    }
                } catch {}
                break;
            }
        }
        count++;
    }
}
console.log('Done');
