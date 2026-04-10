const fs = require('fs');
const path = require('path');

// Search for any actual user text content in the large sessions
const files = [
    '747c06c4-73bf-4676-b9d1-a28bfd666b90.jsonl',
    'b05ed96c-e2cc-4f5d-8b7a-d20690e79f9e.jsonl'
];

for (const fname of files) {
    const fpath = path.join('C:\\Users\\Administrator\\.openclaw\\agents\\main\\sessions\\', fname);
    const content = fs.readFileSync(fpath, 'utf8');
    const lines = content.split('\n');
    let userLineCount = 0;
    let foundRelevant = 0;
    
    for (const line of lines) {
        if (!line.includes('"role":"user"')) continue;
        userLineCount++;
        
        // Look for Chinese text in actual user messages (not metadata)
        try {
            const obj = JSON.parse(line);
            const text = obj.message?.content?.[0]?.text || '';
            // Skip if it's just metadata/conversation_info
            if (text.includes('Conversation info') && !text.includes('收入') && !text.includes('存款') && !text.includes('投资')) {
                continue;
            }
            if (text.length > 80 && (text.includes('收入') || text.includes('存款') || text.includes('投资') || text.includes('绩效') || text.includes('父亲'))) {
                console.log(`\n== ${fname} user msg #${userLineCount} (${text.length} chars) ==`);
                console.log(text.substring(0, 400));
                foundRelevant++;
                if (foundRelevant >= 5) break;
            }
        } catch {}
    }
    console.log(`\nTotal user messages in ${fname}: ${userLineCount}, found relevant: ${foundRelevant}`);
}
