const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://devpress.csdn.net/xclaw';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      timeout: 15000
    }, res => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function extractArticles(html) {
  // Match devpress article URLs
  const re = /href="(https:\/\/devpress\.csdn\.net\/xclaw\/[^"]+)"/g;
  const seen = new Set();
  const results = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (!seen.has(url) && url.includes('.html')) {
      seen.add(url);
      results.push(url);
    }
  }
  return results;
}

async function fetchDetails(url) {
  try {
    const html = await fetch(url);
    // Title: <h1> or og:title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      || html.match(/<title>([^<]+)<\/title>/i);
    // Author
    const authorMatch = html.match(/class="[^"]*user-name[^"]*"[^>]*>([^<]+)<\/a>/i)
      || html.match(/class="[^"]*author[^"]*"[^>]*>([^<]+)<\/a>/i);
    // Date
    const dateMatch = html.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
    // Description
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/i)
      || html.match(/class="[^"]*desc[^"]*"[^>]*>([^<]+)/i);

    return {
      url,
      title: titleMatch ? titleMatch[1].replace(/[\s\n]+/g, ' ').trim() : '未知标题',
      author: authorMatch ? authorMatch[1].replace(/[\s\n]+/g, ' ').trim() : '未知作者',
      date: dateMatch ? dateMatch[1].trim() : '',
      desc: descMatch ? descMatch[1].substring(0, 100).trim() : ''
    };
  } catch (e) {
    return { url, title: '获取失败', author: '', date: '', desc: '' };
  }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const memoryFile = path.join(__dirname, '..', 'memory', `${today}.md`);

  console.log(`🔍 抓取小龙虾开发者社区 [${today}]...\n`);

  // Fetch homepage (latest articles)
  let articleUrls = new Set();
  try {
    console.log('📥 抓取首页...');
    const html = await fetch(BASE);
    const urls = extractArticles(html);
    urls.forEach(u => articleUrls.add(u));
    console.log(`   找到 ${urls.length} 篇`);
  } catch (e) {
    console.log(`   ❌ 失败: ${e.message}`);
  }

  // Fetch search sorted by latest
  try {
    console.log('📥 抓取最新文章列表...');
    const html = await fetch(`${BASE}/search?q=openclaw&sort=latest`);
    const urls = extractArticles(html);
    urls.forEach(u => articleUrls.add(u));
    console.log(`   找到 ${urls.length} 篇`);
  } catch (e) {
    console.log(`   ❌ 失败: ${e.message}`);
  }

  // Fetch search sorted by hot
  try {
    console.log('📥 抓取热门文章列表...');
    const html = await fetch(`${BASE}/search?q=openclaw&sort=hot`);
    const urls = extractArticles(html);
    urls.forEach(u => articleUrls.add(u));
    console.log(`   找到 ${urls.length} 篇`);
  } catch (e) {
    console.log(`   ❌ 失败: ${e.message}`);
  }

  const uniqueUrls = [...articleUrls].slice(0, 20); // max 20 to avoid rate limit
  console.log(`\n📊 共 ${uniqueUrls.length} 篇待获取详情...`);

  // Fetch details with concurrency control (5 at a time)
  const results = [];
  for (let i = 0; i < uniqueUrls.length; i += 5) {
    const batch = uniqueUrls.slice(i, i + 5);
    const batchResults = await Promise.all(batch.map(u => fetchDetails(u)));
    results.push(...batchResults);
    console.log(`   已获取 ${Math.min(i + 5, uniqueUrls.length)}/${uniqueUrls.length}`);
  }

  // Write to memory
  let md = `\n## OpenClaw 社区每日动态 [${today}]\n\n`;
  md += `> 来源: devpress.csdn.net/xclaw | 抓取时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

  md += `| # | 标题 | 作者 | 时间 |\n`;
  md += `|---|------|------|------|\n`;
  results.forEach((r, i) => {
    const shortTitle = r.title.length > 40 ? r.title.substring(0, 40) + '…' : r.title;
    md += `| ${i + 1} | [${shortTitle}](${r.url}) | ${r.author} | ${r.date} |\n`;
  });

  md += `\n**摘要：**\n`;
  results.slice(0, 3).forEach(r => {
    if (r.desc) md += `- ${r.desc}\n`;
  });

  md += `\n---\n`;

  fs.appendFileSync(memoryFile, md);
  console.log(`\n✅ 已追加到: ${memoryFile}`);
}

main().catch(e => { console.error('❌ 错误:', e.message); process.exit(1); });
