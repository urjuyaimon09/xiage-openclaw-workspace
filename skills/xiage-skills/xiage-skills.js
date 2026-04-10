// xiage-skills.js - 自定义技能全生命周期闭环自动化
// 遵循 SKILL_LIFE.md 规则

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

// 配置
const SKILLS_INDEX = `${process.env.USERPROFILE}/.openclaw/workspace/skills/xiage-skills/metadata/SKILLS-INDEX.md`;
const EVALUATION_FILE = `${process.env.USERPROFILE}/.openclaw/workspace/skills/xiage-skills/metadata/SKILLS-EVALUATION.md`;
const SKILLS_DIR = `${process.env.USERPROFILE}/.openclaw/workspace/skills`;
const USAGE_FILE = `${process.env.USERPROFILE}/.openclaw/workspace/skills/xiage-skills/metadata/skill-usage.json`;
const RETIRED_DIR = `${process.env.USERPROFILE}/.openclaw/workspace/skills/retired`;
const LOG_FILE = `${process.env.USERPROFILE}/.openclaw/workspace/memory/xiage-skills-run.log`;
const MEMORY_DIR = `${process.env.USERPROFILE}/.openclaw/workspace/memory`;

// 浏览器加载（puppeteer-extra + stealth 防检测）
const PLAYWRIGHT_AVAILABLE = true;
let stealthBrowser = null;

// 初始化 stealth 浏览器
async function getStealthBrowser() {
    if (stealthBrowser) return stealthBrowser;
    try {
        const puppeteerExtra = require('puppeteer-extra');
        const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
        puppeteerExtra.use(stealthPlugin);

        // 随机 User-Agent（模拟真实 Chrome）
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ];
        const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

        stealthBrowser = await puppeteerExtra.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
        });
        info(`Stealth browser launched with UA: ${ua.substring(0, 60)}...`);
        return stealthBrowser;
    } catch (e) {
        warn(`Stealth browser failed: ${e.message}, falling back to playwright`);
        return null;
    }
}

// 工具函数
function info(msg) { console.log('\x1b[32m%s\x1b[0m', `[INFO] ${msg}`); }
function warn(msg) { console.log('\x1b[33m%s\x1b[0m', `[WARN] ${msg}`); }
function error(msg) { console.error('\x1b[31m%s\x1b[0m', `[ERROR] ${msg}`); }

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// 初始化
ensureDir(SKILLS_DIR);
ensureDir(MEMORY_DIR);
ensureDir(RETIRED_DIR);
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
}
if (!fs.existsSync(USAGE_FILE)) {
    fs.writeFileSync(USAGE_FILE, '[]', 'utf8');
}

// =========================================================
// 0. 使用记录
// =========================================================
function useSkill(skillName, result, notes) {
    ensureDir(MEMORY_DIR);
    let usage = [];
    try {
        usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (e) {
        usage = [];
    }
    usage.push({
        date: new Date().toISOString(),
        skill: skillName,
        result: result, // 'success' | 'fail'
        notes: notes || ''
    });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8');
    info(`Recorded usage: ${skillName} -> ${result}`);
}

// =========================================================
// 1. 搜索
// =========================================================
// 随机等待工具函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 模拟人类滚动的函数
async function humanLikeScroll(page, maxAttempts = 30) {
    info(`Starting human-like scroll (max ${maxAttempts} steps)`);
    let lastHeight = 0;
    let stagnantSteps = 0;
    const maxStagnant = 5; // 连续5次没变化就停止

    for (let i = 0; i < maxAttempts; i++) {
        // 随机滚动步数（模拟人类不是一口气滚到底）
        const scrollSteps = randInt(1, 4);
        for (let s = 0; s < scrollSteps; s++) {
            const target = lastHeight + randInt(300, 800);
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), target);
            await sleep(randInt(200, 600));
        }

        // 强制滚动到底部一次，确保触发懒加载
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(randInt(1500, 4000));

        const newHeight = await page.evaluate(() => document.body.scrollHeight);
        const currentScroll = await page.evaluate(() => window.scrollY + window.innerHeight);
        const skillCount = await page.evaluate(() => document.querySelectorAll('a[href*="skill"], a[href*="/s/"]').length);

        info(`  Step ${i + 1}: scrollHeight=${newHeight}, window=${currentScroll}, skills≈${skillCount}`);

        if (newHeight === lastHeight && currentScroll >= newHeight) {
            stagnantSteps++;
            if (stagnantSteps >= 2) {
                info(`  Page appears fully loaded (${stagnantSteps} stagnant steps), stopping scroll`);
                break;
            }
        } else {
            stagnantSteps = 0;
        }
        lastHeight = newHeight;
    }
}

async function autoLoadFullHtml(url, outputPath, minCount) {
    if (!PLAYWRIGHT_AVAILABLE) {
        warn('playwright not available, skipping auto load, need manual browser load');
        return false;
    }

    info(`Starting stealth browser for ${url}, need >= ${minCount} skills`);

    const browser = await getStealthBrowser();
    if (!browser) {
        warn('Stealth browser unavailable, falling back to basic playwright');
        const { chromium } = require('playwright');
        const browser2 = await chromium.launch({ headless: true });
        const page2 = await browser2.newPage();
        await page2.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        const html = await page2.content();
        fs.writeFileSync(outputPath, html, 'utf8');
        await browser2.close();
        return (html.match(/<a[^>]+href[^>]+>/g) || []).length >= minCount;
    }

    const page = await browser.newPage();

    try {
        // 随机视口（模拟不同设备）
        const viewportOptions = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
        ];
        const vp = viewportOptions[randInt(0, viewportOptions.length - 1)];
        await page.setViewport({ width: vp.width, height: vp.height });

        // 导航，带重试
        let navOk = false;
        for (let retry = 0; retry < 3; retry++) {
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                navOk = true;
                break;
            } catch (e) {
                warn(`  Navigation attempt ${retry + 1} failed: ${e.message}`);
                await sleep(3000 * (retry + 1));
            }
        }

        if (!navOk) {
            warn('Navigation failed after 3 retries, saving what we have');
            const html = await page.content();
            fs.writeFileSync(outputPath, html, 'utf8');
            await page.close();
            return false;
        }

        // 等待初始渲染
        await sleep(randInt(2000, 4000));

        // 执行人类风格滚动（触发懒加载）
        await humanLikeScroll(page);

        // 额外等待 RSC 内容完全加载
        await sleep(randInt(3000, 6000));

        // ———— 核心修复：用 page.evaluate() 直接从渲染后的 DOM 提取数据 ————
        // page.evaluate() 在浏览器里跑，返回值传到 Node.js，再由 Node.js 写文件
        const skillLinks = await page.evaluate(() => {
            // 尝试多种选择器（适配 skills.sh 各种页面结构）
            const selectors = [
                'a[href*="clawhub.ai"]',
                'a[href*="/openclaw/"]',
                'a[href^="/"][class*="group"]',
                'a[href*="/skills/"]'
            ];
            for (const sel of selectors) {
                const links = [...document.querySelectorAll(sel)];
                if (links.length >= 5) {
                    return links.slice(0, 200).map(a => ({
                        href: a.href,
                        text: (a.textContent || '').trim().slice(0, 100),
                    }));
                }
            }
            return [];
        });

        if (skillLinks.length > 0) {
            // 在 Node.js 里处理 evaluate 结果，写入 eval JSON
            const parsed = skillLinks
                .filter(s => s.href && (s.href.includes('clawhub.ai') || s.href.includes('skills.sh')))
                .map(s => {
                    // 匹配 clawhub.ai/{author}/{name} 或 skills.sh/openclaw/{author}
                    const m = s.href.match(/clawhub\.ai\/([^\/]+)\/([^\/?#]+)/) ||
                              s.href.match(/skills\.sh\/openclaw\/([^\/]+)\/([^\/?#]+)/);
                    return m ? { author: m[1], name: m[2], url: s.href } : null;
                })
                .filter(Boolean);
            if (parsed.length > 0) {
                const evalJsonPath = outputPath.replace('.html', '.eval.json');
                fs.writeFileSync(evalJsonPath, JSON.stringify(parsed, null, 2), 'utf8');
                info(`  [evaluate] Saved ${parsed.length} skills to ${path.basename(evalJsonPath)}`);
            }
        }

        const fullHtml = await page.content();
        fs.writeFileSync(outputPath, fullHtml, 'utf8');
        const finalCount = skillLinks.length || (fullHtml.match(/<a[^>]+href[^>]+>/g) || []).length;
        info(`Automated load complete: saved ${finalCount} skills to ${outputPath}`);
        await page.close();
        return finalCount >= minCount;

    } catch (e) {
        error(`Stealth browser error: ${e.message}`);
        const html = await page.content().catch(() => '');
        fs.writeFileSync(outputPath, html || '', 'utf8');
        await page.close().catch(() => {});
        return false;
    }
}

async function searchSkills() {
    info('Starting automated skill search, following SKILL_LIFE.md rules: 3 sources x >= 100 skills');

    // skills.sh 的技能列表页是 /openclaw/skills（8789个技能），不是 owner 汇总页
    const tmpTrending = `${SKILLS_DIR}/.tmp-skills-trending.html`;
    await autoLoadFullHtml('https://skills.sh/openclaw/skills', tmpTrending, 100);

    const tmpDownloads = `${SKILLS_DIR}/.tmp-skills-downloads.html`;
    await autoLoadFullHtml('https://skills.sh/openclaw/skills?sort=downloads', tmpDownloads, 100);

    let allHtml = '';
    let pageNum = 1;
    const fetchClawhubPage = async () => {
        return new Promise((resolve) => {
            https.get(`https://clawhub.ai/skills?sort=downloads&page=${pageNum}`, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => { allHtml += data; resolve(); });
            });
        });
    };
    while (true) {
        await fetchClawhubPage();
        const currentTotal = (allHtml.match(/<a[^>]+href="https:\/\/clawhub\.ai\/[^"]+"/g) || []).length;
        if (currentTotal >= 100 || pageNum >= 5) { break; }
        pageNum++;
    }
    const tmpClawhub = `${SKILLS_DIR}/.tmp-clawhub-downloads.html`;
    fs.writeFileSync(tmpClawhub, allHtml, 'utf8');
    // ClawHub HTML 直接 HTTPS fetch 已包含完整内容，无需 stealth 浏览器重载

    info('========================================');
    info('Automated search load complete!');
    info('========================================');

    // ── HTML → JSON 解析 ──────────────────────────────────
    // skills.sh 解析：滚动后 HTML 中技能数据在 data-name / data-author / data-downloads 属性里
    function parseSkillsSh(html, source) {
        const results = [];
        // 匹配 <a data-name="foo" data-author="bar" data-downloads="1234" ...>
        const re = /<a\s[^>]*data-name="([^"]+)"[^>]*data-author="([^"]+)"[^>]*data-downloads="([^"]+)"[^>]*>/gi;
        let m;
        while ((m = re.exec(html)) !== null) {
            results.push({
                name: m[1].trim(),
                author: m[2].trim(),
                downloads: parseInt(m[3], 10) || 0,
                url: `https://clawhub.ai/${m[2].trim()}/${m[1].trim()}`
            });
        }
        // 备选：如果 data 属性全空，尝试从 href 构造
        if (results.length === 0) {
            const hrefRe = /<a\s+href="https:\/\/clawhub\.ai\/([^/]+)\/([^"?\s]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
            while ((m = hrefRe.exec(html)) !== null) {
                const author = m[1].trim();
                const name = m[2].trim();
                const text = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
                const dlMatch = text.match(/[\d,]+(?:\s*(?:downloads|installs?|次|下载))/i);
                results.push({
                    name, author,
                    downloads: dlMatch ? parseInt(dlMatch[0].replace(/[^\d]/g, ''), 10) : 0,
                    url: `https://clawhub.ai/${author}/${name}`
                });
            }
        }
        info(`Parsed ${results.length} skills from skills.sh(${source})`);
        return results;
    }

    // ClawHub 解析：直接 HTTPS fetch 的 HTML，技能数据在 <a href="https://clawhub.ai/{author}/{name}">
    function parseClawhub(html) {
        const results = [];
        // 匹配 https://clawhub.ai/{author}/{name}
        const hrefRe = /<a\s[^>]*href="https:\/\/clawhub\.ai\/([^/]+)\/([^"?\s]+)"[^>]*>/gi;
        const seen = new Set();
        let m;
        while ((m = hrefRe.exec(html)) !== null) {
            const author = m[1].trim();
            const name = m[2].trim();
            const key = `${author}/${name}`;
            if (seen.has(key)) continue;
            seen.add(key);
            // 尝试从周围文本提取下载量
            let dl = 0;
            const snippet = html.substring(Math.max(0, m.index - 200), m.index + 200);
            const dlMatch = snippet.match(/([\d,]+)\s*(?:downloads|installs?|次|下载)/i);
            if (dlMatch) dl = parseInt(dlMatch[1].replace(/,/g, ''), 10);
            results.push({ name, author, downloads: dl, url: `https://clawhub.ai/${author}/${name}` });
        }
        info(`Parsed ${results.length} skills from ClawHub`);
        return results;
    }

    // 执行解析，产出结构化 JSON
    // 优先使用 page.evaluate() 直接提取的 JSON（绕过 HTML/RSC 解析问题）
    try {
        const trendingEval = tmpTrending.replace('.html', '.eval.json');
        const downloadsEval = tmpDownloads.replace('.html', '.eval.json');

        let trendingJson, downloadsJson;

        if (fs.existsSync(trendingEval)) {
            trendingJson = JSON.parse(fs.readFileSync(trendingEval, 'utf8'));
            info(`Loaded ${trendingJson.length} skills from evaluate JSON (trending)`);
        } else {
            const trendingHtml = fs.readFileSync(tmpTrending, 'utf8');
            trendingJson = parseSkillsSh(trendingHtml, 'trending');
        }

        if (fs.existsSync(downloadsEval)) {
            downloadsJson = JSON.parse(fs.readFileSync(downloadsEval, 'utf8'));
            info(`Loaded ${downloadsJson.length} skills from evaluate JSON (downloads)`);
        } else {
            const downloadsHtml = fs.readFileSync(tmpDownloads, 'utf8');
            downloadsJson = parseSkillsSh(downloadsHtml, 'downloads');
        }

        const clawhubHtml = fs.readFileSync(tmpClawhub, 'utf8');
        const clawhubJson = parseClawhub(clawhubHtml);
        fs.writeFileSync(path.join(SKILLS_DIR, 'clawhub-downloads.json'), JSON.stringify(clawhubJson, null, 2), 'utf8');

        // 写入结构化 JSON（供 filterSkills 使用）
        fs.writeFileSync(path.join(SKILLS_DIR, 'skills-sh-trending.json'), JSON.stringify(trendingJson, null, 2), 'utf8');
        fs.writeFileSync(path.join(SKILLS_DIR, 'skills-sh-downloads.json'), JSON.stringify(downloadsJson, null, 2), 'utf8');
        fs.writeFileSync(path.join(SKILLS_DIR, 'clawhub-downloads.json'), JSON.stringify(clawhubJson, null, 2), 'utf8');
        info(`Search phase output: skills-sh-trending.json(${trendingJson.length}) skills-sh-downloads.json(${downloadsJson.length}) clawhub-downloads.json(${clawhubJson.length})`);
    } catch (e) {
        error(`Parse error: ${e.message}`);
    }
}

// =========================================================
// 2. 筛选
// =========================================================
function getInstalledSkills() {
    const installed = new Set();
    try {
        const index = fs.readFileSync(SKILLS_INDEX, 'utf8');
        // 修复：按行解析，跳过表头和分割线，只取每行第一列
        const lines = index.split('\n');
        for (const line of lines) {
            const m = line.match(/^\|\s*([^\|]+?)\s*\|/);
            if (!m) continue;
            const skillName = m[1].trim();
            // 跳过表头、分隔线、空值
            if (!skillName || skillName.match(/^(技能名|来源|安装日期|风险|版本|描述|--------)/)) continue;
            installed.add(skillName);
        }
    } catch (e) {}
    return installed;
}

function filterSkills() {
    const installed = getInstalledSkills();
    const trending = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, 'skills-sh-trending.json'), 'utf8'));
    const downloads = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, 'skills-sh-downloads.json'), 'utf8'));
    const clawhub = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, 'clawhub-downloads.json'), 'utf8'));

    const quota = { clawhub: 5, trending: 5, downloads: 5 };

    function processSource(list, quotaCount, installed, sourceName) {
        const processed = list.map(s => {
            const dl = typeof s.downloads === 'string' ? parseInt(s.downloads.replace(/[^\d]/g, ''), 10) : s.downloads;
            return { ...s, downloads: dl, source: sourceName };
        });
        const filtered = processed.filter(s => !installed.has(s.name));
        filtered.sort((a, b) => b.downloads - a.downloads);
        return filtered.slice(0, quotaCount);
    }

    const clawhubTop = processSource(clawhub, quota.clawhub, installed, 'clawhub');
    const trendingTop = processSource(trending, quota.trending, installed, 'trending');
    const downloadsTop = processSource(downloads, quota.downloads, installed, 'downloads');

    const all = [...clawhubTop, ...trendingTop, ...downloadsTop];
    // 同名不同作者：按 short name 去重，同名只保留一个（按 downloads 降序），其余筛出
    const byName = {};
    for (const s of all) {
        if (!byName[s.name] || (s.downloads || 0) > (byName[s.name].downloads || 0)) {
            byName[s.name] = s;
        }
    }
    const unique = Object.values(byName);

    // Pipeline 统计
    const stats = {
        searchTotal: { clawhub: clawhub.length, trending: trending.length, downloads: downloads.length },
        afterInstallFilter: { clawhub: clawhubTop.length, trending: trendingTop.length, downloads: downloadsTop.length },
        afterDedup: {
            clawhub: clawhubTop.filter(s => unique.includes(s)).length,
            trending: trendingTop.filter(s => unique.includes(s)).length,
            downloads: downloadsTop.filter(s => unique.includes(s)).length,
        },
        total: unique.length,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.join(SKILLS_DIR, '.filter-stats.json'), JSON.stringify(stats, null, 2), 'utf8');

    fs.writeFileSync(path.join(SKILLS_DIR, '.filtered-top20.json'), JSON.stringify(unique, null, 2), 'utf8');
    fs.writeFileSync(path.join(SKILLS_DIR, '.filtered-top20.md'), unique.map(s => `- ${s.name} by ${s.author}: ${s.description}`).join('\n\n'), 'utf8');
    info(`Filter complete: ${unique.length} candidates | search: clawhub=${stats.searchTotal.clawhub} trending=${stats.searchTotal.trending} downloads=${stats.searchTotal.downloads} | afterInstallFilter: clawhub=${stats.afterInstallFilter.clawhub} trending=${stats.afterInstallFilter.trending} downloads=${stats.afterInstallFilter.downloads} | deduped: ${unique.length}`);
}

// =========================================================
// 3. 安检
// =========================================================
const RED_FLAG_PATTERNS = [
    { pattern: /curl\s+[^\|]+\|\s*bash/i, label: 'curl | bash 远程代码执行' },
    { pattern: /wget\s+[^\|]+\|\s*sh/i, label: 'wget | sh 远程代码执行' },
    { pattern: /eval\s*\(\s*(process\.env|req\.|request\.|input)/i, label: 'eval 执行外部输入' },
    { pattern: /exec\s*\(\s*(process\.env|req\.|request\.|input)/i, label: 'exec 执行外部输入' },
    { pattern: /os\.system\s*\(/i, label: 'os.system 执行外部输入' },
    { pattern: /subprocess\.run\s*\([^,]+shell\s*=\s*True/i, label: 'subprocess shell=True' },
    { pattern: /base64\s*\.?\s*decode\s*\(\s*(req\.|request\.|input\.|process\.)/i, label: 'base64 解码后执行' },
    { pattern: /decode\s*\(\s*base64/i, label: 'base64 解码执行' },
    { pattern: /process\.env\s*\.(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE|MASTER)/i, label: '读取环境敏感变量' },
    { pattern: /axios\.post\s*\(\s*["'](?!https?:\/\/)/i, label: '向非HTTPS地址发送数据' },
    { pattern: /\.send\s*\(\s*process\.env\./i, label: 'HTTP发送敏感环境变量' },
    { pattern: /sudo\s+/i, label: '请求sudo权限' },
    { pattern: /chmod\s+[467][\d]{3}/i, label: '设置过高文件权限' },
    { pattern: /document\.cookie/i, label: '访问浏览器cookie' },
    { pattern: /localStorage\.setItem\s*\(\s*["']token/i, label: '存储敏感token到本地' },
    { pattern: /new\s+Function\s*\(/i, label: 'new Function 动态执行' },
];

// =========================================================
// 3.5 ClawHub 页面抓取（替代 git clone 的 fallback）
// =========================================================
function fetchClawhubPageText(author, name) {
    return new Promise((resolve) => {
        const clawhubUrl = `https://clawhub.ai/${author}/${name}`;
        info(`  Fetching ClawHub page: ${clawhubUrl}`);
        https.get(clawhubUrl, (res) => {
            if (res.statusCode !== 200) {
                resolve({ ok: false, content: '', error: `HTTP ${res.statusCode}` });
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                // 提取页面中 <pre><code> 或 <code> 里的内容（SKILL.md 通常在这里）
                const codeBlocks = [];
                const preMatches = data.matchAll(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi);
                for (const m of preMatches) {
                    codeBlocks.push(m[1].replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim());
                }
                // 也尝试提取 main 或 pre 标签内的 markdown 内容
                const mainMatch = data.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
                const mainText = mainMatch ? mainMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                resolve({ ok: true, content: codeBlocks.join('\n\n') + (mainText ? '\n\n' + mainText : ''), url: clawhubUrl });
            });
        }).on('error', (e) => {
            resolve({ ok: false, content: '', error: e.message });
        });
    });
}

// =========================================================
// 3.6 文本规则安检（对原始文本应用红标扫描）
// =========================================================
function textRuleSecurityCheck(rawText) {
    const findings = [];
    for (const { pattern, label } of RED_FLAG_PATTERNS) {
        if (pattern.test(rawText)) {
            findings.push(label);
        }
    }
    return findings;
}

// =========================================================
// 3. 安检（含 ClawHub fallback）
// =========================================================
async function securityCheck(candidates) {
    info(`========================================`);
    info(`Security check: ${candidates.length} candidates`);
    const results = [];
    const tmpDir = `${SKILLS_DIR}/.tmp-checkout`;

    for (const candidate of candidates) {
        const { name, author, url, description } = candidate;
        info(`Checking: ${name} by ${author}`);
        let risk = '🟡';
        let rejectReason = '';
        let checkMethod = '';

        // 非 GitHub 来源 → 主动抓取 ClawHub 页面做文本规则安检
        if (!url.includes('github.com')) {
            const pageResult = await fetchClawhubPageText(author, name);
            if (pageResult.ok && pageResult.content) {
                const findings = textRuleSecurityCheck(pageResult.content);
                risk = findings.length > 0 ? '🔴' : '🟢';
                rejectReason = findings.length > 0 ? `ClawHub文本规则命中: ${findings.join('; ')}` : '通过';
                checkMethod = 'clawhub-text-rule';
                info(`  [clawhub-text] ${name}: ${risk} ${rejectReason}`);
            } else {
                risk = '🟡';
                rejectReason = `ClawHub页面抓取失败: ${pageResult.error || 'no content'}`;
                checkMethod = 'clawhub-fail';
                warn(`  ClawHub fetch failed for ${name}: ${rejectReason}`);
            }
            results.push({ name, author, url, description, risk, rejectReason, checkMethod });
            continue;
        }

        let gitCloneOk = false;
        let codeFiles = [];

        try {
            ensureDir(tmpDir);
            const checkoutPath = path.join(tmpDir, `${author}-${name}`);
            if (fs.existsSync(checkoutPath)) {
                fs.rmSync(checkoutPath, { recursive: true, force: true });
            }

            execSync(`git clone --depth 1 "${url}" "${checkoutPath}"`, { stdio: 'ignore', timeout: 30000 });
            gitCloneOk = true;
            checkMethod = 'git-clone';

            function walkDir(dir) {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name !== '.git' && entry.name !== 'node_modules') {
                            walkDir(full);
                        }
                    } else if (/\.(js|ts|py|sh|ps1|rb|go|rs|php|pl)$/i.test(entry.name)) {
                        codeFiles.push(full);
                    }
                }
            }
            walkDir(checkoutPath);

        } catch (e) {
            warn(`  Git clone failed: ${e.message}, falling back to ClawHub page fetch...`);

            // Fallback: ClawHub 页面抓取 + 文本规则安检
            const pageResult = await fetchClawhubPageText(author, name);
            if (pageResult.ok && pageResult.content) {
                checkMethod = 'clawhub-text-rule';
                const findings = textRuleSecurityCheck(pageResult.content);
                if (findings.length > 0) {
                    risk = '🔴';
                    rejectReason = `ClawHub文本规则命中: ${findings.join('; ')}`;
                    info(`  RED FLAG (ClawHub文本): ${rejectReason}`);
                } else {
                    risk = '🟢';
                    info(`  Passed (ClawHub文本规则): 无红标`);
                }
                results.push({ name, author, url, description, risk, rejectReason, checkMethod });
                continue;
            } else {
                warn(`  ClawHub fallback also failed: ${pageResult.error}`);
                risk = '🟡';
                rejectReason = `克隆失败且ClawHub抓取失败: ${e.message}`;
                results.push({ name, author, url, description, risk, rejectReason, checkMethod: 'both-failed' });
                continue;
            }
        }

        // Git clone 成功 → 文件规则扫描
        if (gitCloneOk) {
            let redFlagFound = false;
            for (const file of codeFiles) {
                const content = fs.readFileSync(file, 'utf8');
                for (const { pattern, label } of RED_FLAG_PATTERNS) {
                    if (pattern.test(content)) {
                        redFlagFound = true;
                        rejectReason = `${label} in ${path.basename(file)}`;
                        info(`  RED FLAG: ${rejectReason}`);
                        break;
                    }
                }
                if (redFlagFound) break;
            }

            if (redFlagFound) {
                risk = '🔴';
            } else if (codeFiles.length === 0) {
                risk = '🟢';
                info(`  Passed: ${codeFiles.length} code files, no red flags`);
            } else {
                risk = '🟢';
                info(`  Passed: ${codeFiles.length} code files, no red flags`);
            }
        }

        results.push({ name, author, url, description, risk, rejectReason, checkMethod });
    }

    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const passed = results.filter(r => r.risk !== '🔴');
    const rejected = results.filter(r => r.risk === '🔴');

    info(`Security check complete: ${passed.length} passed, ${rejected.length} rejected`);
    if (rejected.length > 0) {
        rejected.forEach(r => info(`  REJECTED: ${r.name} - ${r.rejectReason}`));
    }

    fs.writeFileSync(path.join(SKILLS_DIR, '.security-check.json'), JSON.stringify(results, null, 2), 'utf8');
    return passed;
}

// =========================================================
// 4. 安装（含 ClawHub fallback）
// 安装顺序：git clone → Puppeteer stealth(ClawHub) → ZIP(GitHub) → ClawHub页面抓取
// =========================================================

// 4a. Puppeteer stealth 方式：从 ClawHub 获取真实下载链接并完成安装
// 优先复用 getStealthBrowser() 单例，单例为空时再自建 browser
async function installViaClawhubPuppeteer(author, skillName) {
    const installPath = path.join(SKILLS_DIR, `${author}-${skillName}`);
    const pageUrl = `https://clawhub.ai/${author}/${skillName}`;
    const zipPath = path.join(SKILLS_DIR, `.tmp-${author}-${skillName}.zip`);

    // 优先复用单例 browser，否则自己 launch
    let browser = await getStealthBrowser();
    let weLaunched = false;
    if (!browser) {
        info(`  [puppeteer] Shared browser unavailable, launching dedicated instance`);
        const puppeteerExtra = require('./node_modules/puppeteer-extra');
        const stealthPlugin = require('./node_modules/puppeteer-extra-plugin-stealth')();
        puppeteerExtra.use(stealthPlugin);
        browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        weLaunched = true;
    }

    info(`  [puppeteer] Using browser for: ${pageUrl}`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000)); // 等待 JS 渲染

    // 找到 "Download zip" 链接（evaluate 在 close 之前，确保上下文有效）
    const downloadLink = await page.$('a[href*="/api/v1/download"]');
    if (!downloadLink) {
        await page.close().catch(() => {});
        if (weLaunched) await browser.close().catch(() => {});
        // 下载链接找不到，尝试抓 ClawHub 页面文本作为兜底
        info('  Download link not found, trying ClawHub page fetch...');
        try {
            const result = await fetchClawhubPageText(author, skillName);
            if (!result.ok || !result.content) {
                throw new Error(`ClawHub fetch failed: ${result.error || 'no content'}`);
            }
            ensureDir(installPath);
            fs.writeFileSync(path.join(installPath, 'SKILL.md'), result.content, 'utf8');
            fs.writeFileSync(path.join(installPath, 'package.json'),
                JSON.stringify({ name: `${author}-${skillName}`, version: '1.0.0' }, null, 2), 'utf8');
            info(`  Installed via page fetch: ${skillName}`);
            return;
        } catch (e) {
            throw new Error(`Page fetch also failed: ${e.message}`);
        }
    }
    const realUrl = await downloadLink.evaluate(el => el.href);
    await page.close().catch(() => {});

    info(`  [puppeteer] Download URL: ${realUrl}`);
    if (weLaunched) await browser.close().catch(() => {});

    // ———— CDP 浏览器下载（绕过 exec 对 Node.js https.get 的封锁）————
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                // 重新开一个 page 专门下载（避免关闭主 browser）
                let downloadBrowser;
                let weLaunchedBrowser = false;
                try {
                    const puppeteerExtra = require('./node_modules/puppeteer-extra');
                    const stealthPlugin = require('./node_modules/puppeteer-extra-plugin-stealth')();
                    puppeteerExtra.use(stealthPlugin);
                    downloadBrowser = await puppeteerExtra.launch({
                        headless: true,
                        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                               '--disable-web-security', '--allow-running-insecure-content']
                    });
                    weLaunchedBrowser = true;
                } catch (e) {
                    throw new Error(`Browser unavailable: ${e.message}`);
                }

                const downloadPage = await downloadBrowser.newPage();
                await downloadPage.setViewport({ width: 1366, height: 900 });

                // 启用 CDP 下载
                const client = await downloadPage.target().createCDPSession();
                await client.send('Page.setDownloadBehavior', {
                    behavior: 'allow',
                    downloadPath: TEMP_DIR
                });

                info(`  [cdp-download] Navigating to: ${realUrl}`);
                await downloadPage.goto(realUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await new Promise(r => setTimeout(r, 8000)); // 等待下载完成

                await downloadPage.close().catch(() => {});
                if (weLaunchedBrowser) await downloadBrowser.close().catch(() => {});

                // 查找下载的 zip
                const files = fs.readdirSync(TEMP_DIR).filter(
                    f => f.endsWith('.zip') && f.includes(skillName)
                );
                if (files.length === 0) {
                    reject(new Error('CDP download failed: no zip file found'));
                    return;
                }
                const downloadedZip = path.join(TEMP_DIR, files[0]);
                const stats = fs.statSync(downloadedZip);
                if (stats.size < 500) {
                    fs.unlinkSync(downloadedZip);
                    reject(new Error(`Downloaded file too small: ${stats.size} bytes`));
                    return;
                }

                // 解压
                const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                const zip = new AdmZip(downloadedZip);
                fs.mkdirSync(installPath, { recursive: true });
                zip.extractAllTo(installPath, true);
                fs.unlinkSync(downloadedZip);
                info(`  [cdp-download] Installed: ${skillName}`);
                resolve();
            } catch (e) {
                reject(e);
            }
        })();
    });
}

// ———— skills.sh 页面文本抓取（最可靠，直接提取渲染后的 SKILL.md 内容）———
async function installViaSkillsShPageFetch(author, skillName, installPath) {
    // skills.sh monorepo: author=skills, 但 URL 路径是 openclaw/skills/{skill}
    const skillsShOwner = (author === 'skills') ? 'openclaw' : author;
    const pageUrl = `https://skills.sh/${skillsShOwner}/skills/${skillName}`;
    info(`  [skills.sh] Fetching page: ${pageUrl}`);

    const XiageNodeModules = path.join(__dirname, 'node_modules');
    let browser;
    let weLaunched = false;

    try {
        const puppeteerExtra = require(XiageNodeModules + '/puppeteer-extra');
        const stealthPlugin = require(XiageNodeModules + '/puppeteer-extra-plugin-stealth')();
        puppeteerExtra.use(stealthPlugin);
        browser = await puppeteerExtra.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
        weLaunched = true;
    } catch (e) {
        warn(`  [skills.sh] Cannot launch browser: ${e.message}`);
        throw new Error(`Browser unavailable: ${e.message}`);
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 4000)); // 等待 JS 渲染

        const skillMdContent = await page.evaluate(() => {
            const text = document.body ? document.body.innerText : '';
            const skillMdStart = text.indexOf('SKILL.md');
            if (skillMdStart === -1) return null;
            const weeklyInstallsIdx = text.indexOf('WEEKLY INSTALLS');
            const endIdx = weeklyInstallsIdx > 0 ? weeklyInstallsIdx : text.length;
            return text.slice(skillMdStart + 'SKILL.md'.length, endIdx).trim();
        });

        await page.close().catch(() => {});
        if (weLaunched) await browser.close().catch(() => {});

        if (!skillMdContent || skillMdContent.length < 100) {
            throw new Error(`SKILL.md content too short (${skillMdContent ? skillMdContent.length : 0} chars), page may be empty`);
        }

        ensureDir(installPath);
        fs.writeFileSync(path.join(installPath, 'SKILL.md'), skillMdContent, 'utf8');
        fs.writeFileSync(path.join(installPath, 'package.json'),
            JSON.stringify({ name: `${author}-${skillName}`, version: '1.0.0' }, null, 2), 'utf8');
        info(`  [skills.sh] Installed ${skillName} via page text fetch (${skillMdContent.length} chars)`);
        return;
    } catch (e) {
        await page.close().catch(() => {});
        if (weLaunched) await browser.close().catch(() => {});
        throw e;
    }
}

// ———— GitHub API 下载（绕过 443 封锁，走 api.github.com）———
async function installViaGithubApi(owner, repo, installPath, zipPath, doInstall) {
    // openclaw/skills 是 monorepo（680MB），跳过，避免长时间卡住
    if (owner === 'openclaw' && repo === 'skills') {
        throw new Error('openclaw/skills is a monorepo, skipping GitHub API (would download ~680MB)');
    }
    const branchesToTry = ['main', 'master'];
    let branchIdx = 0;

    const tryBranch = () => {
        if (branchIdx >= branchesToTry.length) {
            throw new Error(`Both main and master branches failed for ${owner}/${repo}`);
        }
        const branch = branchesToTry[branchIdx++];
        info(`  GitHub API: trying ${owner}/${repo}:${branch}...`);

        return new Promise((resolve, reject) => {
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;
            const file = fs.createWriteStream(zipPath);
            https.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/vnd.github+json'
                }
            }, (res) => {
                if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {
                    file.close();
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    const redirectUrl = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : `https://github.com/${res.headers.location.replace(/^\//, '')}`;
                    https.get(redirectUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' }
                    }, (res2) => {
                        if (res2.statusCode !== 200) {
                            tryBranch().then(resolve).catch(reject);
                            return;
                        }
                        res2.pipe(file);
                        file.on('finish', () => {
                            try {
                                const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                                const zip = new AdmZip(zipPath);
                                fs.mkdirSync(installPath, { recursive: true });
                                zip.extractAllTo(installPath, true);
                                fs.unlinkSync(zipPath);
                                doInstall();
                                resolve();
                            } catch (e) {
                                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                                reject(e);
                            }
                        });
                    }).on('error', e => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });
                    return;
                }
                if (res.statusCode === 404) {
                    file.close();
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    tryBranch().then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    file.close();
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(`GitHub API ZIP failed: HTTP ${res.statusCode}`));
                    return;
                }
                const ct = (res.headers['content-type'] || '').toLowerCase();
                if (!ct.includes('zip') && !ct.includes('octet-stream') && !ct.includes('compressed')) {
                    file.close();
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(`GitHub API: not a zip (${ct})`));
                    return;
                }
                res.pipe(file);
                file.on('finish', () => {
                    try {
                        const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                        const zip = new AdmZip(zipPath);
                        fs.mkdirSync(installPath, { recursive: true });
                        zip.extractAllTo(installPath, true);
                        fs.unlinkSync(zipPath);
                        doInstall();
                        resolve();
                    } catch (e) {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        reject(e);
                    }
                });
                file.on('error', err => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(err); });
            }).on('error', e => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });
        });
    };

    await tryBranch();
}

async function installSingleSkill(author, skillName, skillUrl, risk, description) {
    const installPath = path.join(SKILLS_DIR, `${author}-${skillName}`);
    const zipPath = path.join(SKILLS_DIR, `.tmp-${author}-${skillName}.zip`);
    const extractBase = path.join(SKILLS_DIR, `.tmp-extract-${Date.now()}`);

    // ———— 解析 URL 类型 ————
    // skills.sh 格式: https://skills.sh/openclaw/skills/{skill}
    const skillsShMatch = skillUrl.match(/skills\.sh\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    // GitHub 格式: https://github.com/{owner}/{repo}
    const gitHubMatch = skillUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);

    if (!skillsShMatch && !gitHubMatch) {
        throw new Error(`Cannot parse URL: ${skillUrl}`);
    }

    const doInstall = () => {
        const fullDir = author + "-" + skillName;
        const shortName = skillName;
        const entry = "\r\n| " + shortName + " | " + fullDir + " | " + author + " |";
        const idxContent = fs.readFileSync(SKILLS_INDEX, "utf8");
        if (idxContent.includes("| 短名 | 完整目录 | 作者 |") && !idxContent.includes(fullDir)) {
            const lines = idxContent.split("\r\n");
            const sepLine = lines.findIndex(l => l.match(/^\|--/));
            if (sepLine !== -1) {
                lines.splice(sepLine + 1, 0, entry.replace(/^\r\n/, ""));
                fs.writeFileSync(SKILLS_INDEX, lines.join("\r\n"), "utf8");
            }
        }
        info(`Installed: ${skillName}`);
    };

    // ———— skills.sh monorepo: 从预下载的 openclaw/skills 缓存提取单个 skill ————
    // Fallback 链: monorepo提取 → GitHub API → ClawHub puppeteer → ClawHub页面抓取写SKILL.md
    if (skillsShMatch) {
        const [, , repo, skillInUrl] = skillsShMatch;
        info(`  skills.sh: installing ${skillInUrl}`);

        // Fallback 1: skills.sh 页面文本抓取（最可靠，已验证）
        try {
            await installViaSkillsShPageFetch(author, skillName, installPath);
            doInstall();
            return;
        } catch (e1) {
            warn(`  skills.sh: page fetch failed (${e1.message}), trying monorepo cache...`);
        }

        // Fallback 2: GitHub API (monorepo 技能会 404，跳过直接进 ClawHub)
        // skills.sh monorepo 技能的 author=skills，但 GitHub org 是 openclaw，hardcode 纠正
        const githubOwner = (repo === 'skills') ? 'openclaw' : author;
        try {
            await installViaGithubApi(githubOwner, skillName, installPath, zipPath, doInstall);
            return;
        } catch (e3) {
            const msg = e3 instanceof Error ? e3.message : String(e3);
            warn(`  skills.sh: GitHub API failed (${msg}), skipping to ClawHub...`);
        }

        // Fallback 3: ClawHub puppeteer → page text（最后兜底）
        try {
            await installViaClawhubPuppeteer(author, skillName);
            doInstall();
            return;
        } catch (e4) {
            warn(`  skills.sh: ClawHub puppeteer failed (${e4.message}), trying page text...`);
        }
        try {
            const result = await fetchClawhubPageText(author, skillName);
            if (!result.ok || !result.content) {
                throw new Error(`ClawHub page fetch failed: ${result.error || 'no content'}`);
            }
            ensureDir(installPath);
            fs.writeFileSync(path.join(installPath, 'SKILL.md'), result.content, 'utf8');
            fs.writeFileSync(path.join(installPath, 'package.json'),
                JSON.stringify({ name: `${author}-${skillName}`, version: '1.0.0' }, null, 2), 'utf8');
            info(`  skills.sh: installed ${skillName} via ClawHub page text (last resort)`);
            doInstall();
            return;
        } catch (e5) {
            throw new Error(`All fallbacks exhausted for ${skillName}: skillsShPage→GitHub→ClawHubPuppeteer→ClawHubText, last error: ${e5.message}`);
        }
    }

    // ———— GitHub 直接格式 ————
    const [, owner, repo] = gitHubMatch;

    // Fallback 1: ClawHub ZIP API via stealth browser（最快，直接下载）
    try {
        info(`  GitHub: trying ClawHub ZIP API for ${author}/${skillName}...`);
        await installViaClawhubPuppeteer(author, skillName);
        doInstall();
        return;
    } catch (e1) {
        warn(`  ClawHub ZIP API failed (${e1.message}), trying GitHub API...`);
    }

    // Fallback 2: GitHub API
    try {
        info(`  GitHub: trying ${owner}/${repo} via GitHub API...`);
        await installViaGithubApi(owner, repo, installPath, zipPath, doInstall);
        return;
    } catch (e2) {
        warn(`  GitHub API failed (${e2.message}), trying page text fetch...`);
    }

    // Fallback 3: ClawHub 页面抓取（兜底）
    try {
        const result = await fetchClawhubPageText(author, skillName);
        if (!result.ok || !result.content) {
            throw new Error(`ClawHub page fetch failed: ${result.error || 'no content'}`);
        }
        ensureDir(installPath);
        fs.writeFileSync(path.join(installPath, 'SKILL.md'), result.content, 'utf8');
        fs.writeFileSync(path.join(installPath, 'package.json'),
            JSON.stringify({ name: `${author}-${skillName}`, version: '1.0.0' }, null, 2), 'utf8');
        info(`  GitHub: installed ${skillName} via ClawHub page text (last resort)`);
        doInstall();
        return;
    } catch (e3) {
        throw new Error(`All fallbacks exhausted for ${skillName}: ClawHubZIP→GitHubAPI→ClawHubText, last error: ${e3.message}`);
    }
}

// =========================================================
// 5. 使用记录
// =========================================================
function recordUsage(skillName, result, notes) {
    ensureDir(MEMORY_DIR);
    let usage = [];
    try {
        usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (e) { usage = []; }
    usage.push({
        date: new Date().toISOString(),
        skill: skillName,
        result: result,
        notes: notes || ''
    });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8');
    info(`Usage recorded: ${skillName} -> ${result}`);
}

// =========================================================
// 5.5 固化机制（Memory Flush 模拟）
// =========================================================
// 安装后立即读取 SKILL.md，写入预观察文件.
// 7am cron 实测前可参考，差异化处理"首次安装"vs"已知skill".
async function solidifySkill(author, skillName, description) {
    const installPath = path.join(SKILLS_DIR, `${author}-${skillName}`);
    const skillMdPath = path.join(installPath, 'SKILL.md');
    const PRE_SOLIDIFIED = path.join(SKILLS_DIR, '.tmp-pre-solidified-today.json');

    let observations = { can: [], cannot: [], dependency: '', trigger: '' };

    if (fs.existsSync(skillMdPath)) {
        try {
            const content = fs.readFileSync(skillMdPath, 'utf8');
            // 提取 trigger 命令
            const triggerLines = content.split('\n').filter(l =>
                l.match(/^#{1,3}\s*[(（]?[来来运行执行]/) ||
                l.match(/`[^`]*?(?:node|npx|bash|python)/) ||
                l.match(/(?:命令|Usage|Command|触发):/)
            ).slice(0, 3);
            observations.trigger = triggerLines.join(' | ');

            // 提取依赖（Requires / 依赖 / 需要）
            const depMatch = content.match(/(?:Requires?|依赖|需要)[\s:]*([^\n]+)/i);
            if (depMatch) observations.dependency = depMatch[1].trim();

            // 从描述中推断能力边界
            if (/api\s*key|KEY|token|凭证/.test(content)) {
                observations.cannot.push('需要外部 API Key');
            }
            if (/node|npm|javascript/.test(content) && !/python|perl/.test(content)) {
                observations.can.push('Node.js 环境');
            }
            if (/python|pip/.test(content)) {
                observations.can.push('Python 环境');
            }
            if (/chrome|playwright|浏览器/.test(content)) {
                observations.dependency = 'Chrome/Playwright: ' + observations.dependency;
            }
        } catch (e) {
            warn(`[solidify] 读取 SKILL.md 失败: ${skillName} - ${e.message}`);
        }
    }

    // 追加到预固化文件
    let preSolidified = [];
    try {
        if (fs.existsSync(PRE_SOLIDIFIED)) {
            preSolidified = JSON.parse(fs.readFileSync(PRE_SOLIDIFIED, 'utf8'));
        }
    } catch (e) { preSolidified = []; }

    preSolidified.push({
        author, skillName,
        description: description || '',
        installedAt: new Date().toISOString(),
        preliminary: observations
    });

    fs.writeFileSync(PRE_SOLIDIFIED, JSON.stringify(preSolidified, null, 2), 'utf8');
    info(`[solidify] 预固化完成: ${author}/${skillName}`);
}

// =========================================================
// 5.6 模式识别（Level 2 进化层）
// =========================================================
// 分析 skill-usage.json，检测同类问题出现≥3次的模式.
// 命中时写入 .tmp-pattern-alerts.json，等待坚果确认后执行修改.
const PATTERN_ALERTS_FILE = path.join(MEMORY_DIR, '.tmp-pattern-alerts.json');

function detectPatterns() {
    let usage = [];
    try {
        usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (e) { usage = []; }

    // 按 skill 分组，收集失败 notes
    const skillFailures = {};
    for (const u of usage) {
        if (u.result === 'fail' && u.notes) {
            if (!skillFailures[u.skill]) skillFailures[u.skill] = [];
            skillFailures[u.skill].push(u.notes);
        }
    }

    // 检测重复模式（提取 notes 关键词作为模式）
    const patternCounts = {}; // patternKey -> { skill, count, examples }
    for (const [skill, notesList] of Object.entries(skillFailures)) {
        const patternGroups = {};
        for (const note of notesList) {
            // 提取前20字符作为模式键（简化版：实际可用更复杂NLP）
            const key = note.substring(0, 40).trim();
            if (!patternGroups[key]) patternGroups[key] = { count: 0, examples: [] };
            patternGroups[key].count++;
            if (patternGroups[key].examples.length < 2) {
                patternGroups[key].examples.push(note);
            }
        }
        for (const [pattern, meta] of Object.entries(patternGroups)) {
            if (meta.count >= 3) {
                patternCounts[`${skill}::${pattern}`] = {
                    skill, pattern: meta.examples[0],
                    count: meta.count,
                    examples: meta.examples,
                    severity: meta.count >= 5 ? 'high' : 'medium',
                    detectedAt: new Date().toISOString()
                };
            }
        }
    }

    const alerts = Object.values(patternCounts);
    fs.writeFileSync(PATTERN_ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
    info(`[patterns] 检测完成: ${alerts.length} 个模式警报`);
    if (alerts.length > 0) {
        info('[patterns] 请查看文件确认: ' + PATTERN_ALERTS_FILE);
        for (const a of alerts) {
            console.log(`  🔶 ${a.skill} (×${a.count}): ${a.pattern.substring(0, 60)}`);
        }
    }
    return alerts;
}

// =========================================================
// 5.7 周日全局自省（每周日晚20:00）
// =========================================================
// 检查 SKILLS-INDEX 可用性、清理失效项、更新能力地图.
function weeklyIntrospection() {
    info('========================================');
    info('Weekly introspection started');

    const INTROSPECTION_LOG = path.join(MEMORY_DIR, 'weekly-introspection.json');
    const today = new Date().toISOString().split('T')[0];

    // 读取 skill-usage.json，统计各 skill 状态
    let usage = [];
    try { usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')); } catch (e) { usage = []; }

    const skillStats = {};
    for (const u of usage) {
        if (!skillStats[u.skill]) skillStats[u.skill] = { success: 0, fail: 0, lastDate: null };
        if (u.result === 'success') skillStats[u.skill].success++;
        else if (u.result === 'fail') skillStats[u.skill].fail++;
        const uDate = u.date.split('T')[0];
        if (!skillStats[u.skill].lastDate || uDate > skillStats[u.skill].lastDate) {
            skillStats[u.skill].lastDate = uDate;
        }
    }

    // 检查 SKILLS-INDEX 中每个 skill 目录是否还存在
    const indexContent = fs.readFileSync(SKILLS_INDEX, 'utf8');
    const rows = indexContent.split('\n');
    const issues = [];
    const availableSkills = [];

    for (const row of rows) {
        const trimmed = row.trim();
        if (!trimmed || trimmed === '|' || trimmed.match(/^\|[-\s|]+\|$/)) continue;
        // 匹配 10 列格式: 短名|完整目录|作者|...
        const m = trimmed.match(/^\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|/);
        if (!m) continue;
        const [, shortName, fullDir] = m.map(s => s.trim());
        if (!fullDir || !fullDir.match(/^[a-zA-Z0-9_-]+$/)) continue;

        const skillPath = path.join(SKILLS_DIR, fullDir);
        const exists = fs.existsSync(skillPath);
        const stats = skillStats[shortName] || { success: 0, fail: 0, lastDate: null };

        if (!exists) {
            issues.push({ skill: shortName, issue: '目录缺失（可能已手动删除）', severity: 'info' });
        } else if (stats.fail > 0 && stats.fail / (stats.success + stats.fail) > 0.5) {
            issues.push({ skill: shortName, issue: `失败率${Math.round(stats.fail / (stats.success + stats.fail) * 100)}%（成功${stats.success}/失败${stats.fail}）`, severity: 'warning' });
        }

        if (exists) availableSkills.push({ shortName, fullDir, stats });
    }

    const log = {
        date: today,
        totalIndexed: availableSkills.length + issues.filter(i => i.severity === 'info').length,
        available: availableSkills.length,
        issues,
        topUsed: Object.entries(skillStats).sort((a, b) => (b[1].success + b[1].fail) - (a[1].success + a[1].fail)).slice(0, 10).map(([k, v]) => ({ skill: k, ...v })),
        unusedSkills: availableSkills.filter(s => s.stats.success + s.stats.fail === 0).map(s => s.shortName)
    };

    fs.writeFileSync(INTROSPECTION_LOG, JSON.stringify(log, null, 2), 'utf8');
    info(`[introspection] 周省完成: ${availableSkills.length} 个有效skill, ${issues.length} 个问题`);

    if (log.unusedSkills.length > 0) {
        warn(`[introspection] 未使用的skill: ${log.unusedSkills.join(', ')}`);
    }
    if (issues.length > 0) {
        for (const i of issues) {
            console.log(`  ${i.severity === 'warning' ? '🔶' : 'ℹ️'} ${i.skill}: ${i.issue}`);
        }
    }
    return log;
}

// =========================================================
// 6. 评估
// =========================================================
function evaluateSkills() {
    info('========================================');
    info('Starting skill evaluation');

    // 读取已安装技能（支持4列和5列表格）
    const installed = [];
    try {
        const index = fs.readFileSync(SKILLS_INDEX, 'utf8');
        const rows = index.split('\n');
        for (const row of rows) {
            // 跳过表头、分隔线、空行
            const trimmed = row.trim();
            if (!trimmed || trimmed === '|' || trimmed.match(/^\|[-\s|]+\|$/)) continue;
            // 跳过非技能行（分类标题等）
            if (trimmed.startsWith('| ') && !trimmed.match(/^\| [a-zA-Z]/) && !trimmed.match(/^\| [零一二三四五六七八九十]/)) continue;
            // 4列: name | fullDir | author | description
            // 5列: name | fullDir | author | risk | version
            const m4 = trimmed.match(/^\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|/);
            const m5 = trimmed.match(/^\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|/);
            if (m4) {
                const name = m4[1].trim();
                const fullDir = m4[2].trim();
                const author = m4[3].trim();
                const desc = m4[4].trim();
                if (!name || !name.match(/^(技能名|名称|name|Name|完整目录|Author|说明|Description|--------)/i)) {
                    installed.push({ name, fullDir, author, desc });
                }
            } else if (m5) {
                const name = m5[1].trim();
                const fullDir = m5[2].trim();
                const author = m5[3].trim();
                const risk = m5[4].trim();
                const version = m5[5].trim();
                if (!name || !name.match(/^(技能名|name|Name|说明|--------)/i)) {
                    installed.push({ name, fullDir, author, risk, version });
                }
            }
        }
    } catch (e) { error('Failed to read SKILLS-INDEX: ' + e.message); }
    info(`Loaded ${installed.length} installed skills from SKILLS-INDEX`);

    // 读取使用记录（过去30天）
    let usage = [];
    try {
        usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (e) { usage = []; }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsage = usage.filter(u => new Date(u.date) >= thirtyDaysAgo);

    // 统计每个技能的使用次数和成功率
    const usageStats = {};
    for (const u of recentUsage) {
        if (!usageStats[u.skill]) {
            usageStats[u.skill] = { total: 0, success: 0, fail: 0 };
        }
        usageStats[u.skill].total++;
        if (u.result === 'success') usageStats[u.skill].success++;
        else usageStats[u.skill].fail++;
    }

    // 生成评估报告
    const report = [];
    report.push(`# 技能评估报告`);
    report.push(`**生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}**`);
    report.push('');

    // Pipeline 统计（读最近一次筛选的 .filter-stats.json）
    try {
        const filterStats = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, '.filter-stats.json'), 'utf8'));
        report.push(`## Pipeline 统计（最近一次搜索 / 筛选）`);
        report.push(`**统计时间：${filterStats.timestamp}**`);
        report.push('');
        report.push(`| 来源 | 搜索总量 | 去重后候选 | 配额上限 |`);
        report.push(`|------|---------|-----------|------|`);
        report.push(`| ClawHub | ${filterStats.searchTotal.clawhub} | ${filterStats.afterInstallFilter.clawhub} | ≤8 |`);
        report.push(`| skills.sh trending | ${filterStats.searchTotal.trending} | ${filterStats.afterInstallFilter.trending} | ≤6 |`);
        report.push(`| skills.sh downloads | ${filterStats.searchTotal.downloads} | ${filterStats.afterInstallFilter.downloads} | ≤6 |`);
        report.push(`| **合计** | **${filterStats.searchTotal.clawhub + filterStats.searchTotal.trending + filterStats.searchTotal.downloads}** | **${filterStats.afterInstallFilter.clawhub + filterStats.afterInstallFilter.trending + filterStats.afterInstallFilter.downloads}** | ≤20 |`);
        report.push('');
    } catch (e) {
        report.push(`## Pipeline 统计`);
        report.push(`（无 .filter-stats.json 数据，跳过）`);
        report.push('');
    }

    report.push(`## 评估范围：过去30天使用数据，共 ${recentUsage.length} 条记录`);
    report.push('');

    for (const skill of installed) {
        const stats = usageStats[skill.name] || { total: 0, success: 0, fail: 0 };
        const usageRate = stats.total; // 过去30天调用次数
        const successRate = stats.total > 0 ? Math.round(stats.success / stats.total * 100) : 0;
        const failCount = stats.fail;

        // 稳定性：最近一次是否失败
        const lastRecord = recentUsage.filter(u => u.skill === skill.name).pop();
        const isRecentFail = lastRecord && lastRecord.result === 'fail';

        // 风险等级（5列表格才有）
        const risk = skill.risk || '🟢';

        // 综合评级
        let rating = '🟢';
        if (usageRate === 0 || failCount >= 3) rating = '🔴';
        else if (successRate < 50 || isRecentFail) rating = '🟡';

        report.push(`### ${skill.name} ${rating}`);
        report.push(`| 维度 | 值 |`);
        report.push(`|------|---|`);
        if (skill.author) report.push(`| 作者 | ${skill.author} |`);
        if (skill.fullDir) report.push(`| 完整目录 | ${skill.fullDir} |`);
        if (skill.installDate) report.push(`| 安装日期 | ${skill.installDate} |`);
        if (skill.risk) report.push(`| 风险等级 | ${risk} |`);
        if (skill.desc) report.push(`| 描述 | ${skill.desc} |`);
        report.push(`| 过去30天调用 | ${usageRate} 次 |`);
        report.push(`| 成功率 | ${successRate}% |`);
        report.push(`| 失败次数 | ${failCount} |`);
        report.push(`| 最近状态 | ${lastRecord ? lastRecord.result : '无使用记录'} |`);
        report.push('');

        // 淘汰建议
        if (usageRate === 0) {
            report.push(`**淘汰建议**：连续无使用记录，建议评估是否保留`);
        } else if (rating === '🔴') {
            report.push(`**淘汰建议**：连续失败或成功率过低，建议淘汰`);
        } else if (rating === '🟡') {
            report.push(`**淘汰建议**：存在一定问题，持续观察`);
        } else {
            report.push(`**淘汰建议**：正常，继续使用`);
        }
        report.push('');
    }

    const reportContent = report.join('\n');
    fs.writeFileSync(EVALUATION_FILE, reportContent, 'utf8');
    info('Evaluation complete, report written to: ' + EVALUATION_FILE);

    // 输出飞书推送摘要
    const summary = installed.map(s => {
        const stats = usageStats[s.name] || { total: 0 };
        return `${s.name} ${stats.total > 0 ? `调用${stats.total}次` : '无使用'}`;
    }).join('\n');

    info('========================================');
    info('Evaluation SUMMARY:');
    info(summary);
    info('========================================');
    info('Full report: ' + EVALUATION_FILE);

    return reportContent;
}

// =========================================================
// 7. 淘汰（需要坚果「同意淘汰」触发）
// =========================================================
function retireSkills(skillNames) {
    info(`========================================`);
    info(`Starting skill retirement: ${skillNames.join(', ')}`);
    ensureDir(RETIRED_DIR);

    const results = [];
    for (const name of skillNames) {
        // 从 SKILLS-INDEX.md 移除
        try {
            let index = fs.readFileSync(SKILLS_INDEX, 'utf8');
            const lines = index.split('\n');
            const newLines = lines.filter(line => {
                const match = line.match(/^\|\s*([^\|]+)\s*\|/);
                return !(match && match[1].trim() === name);
            });
            fs.writeFileSync(SKILLS_INDEX, newLines.join('\n'), 'utf8');

            // 移动本地文件到 retired/
            const skillDirs = fs.readdirSync(SKILLS_DIR);
            for (const dir of skillDirs) {
                if (dir.startsWith(name + '-') || dir.endsWith('-' + name)) {
                    const src = path.join(SKILLS_DIR, dir);
                    const dest = path.join(RETIRED_DIR, dir + '.retired-' + new Date().toISOString().slice(0, 10));
                    fs.renameSync(src, dest);
                    info(`Retired: ${dir} -> ${path.basename(dest)}`);
                }
            }
            results.push({ name, status: 'ok' });
        } catch (e) {
            error(`Failed to retire ${name}: ${e.message}`);
            results.push({ name, status: 'fail', error: e.message });
        }
    }

    info('Retirement complete: ' + JSON.stringify(results));
    return results;
}

// =========================================================
// 全流程
// =========================================================
async function fullAutomatic() {
    info('=== xiage-skills full automatic process started ===');
    await searchSkills();
    filterSkills();

    const candidates = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, '.filtered-top20.json'), 'utf8'));
    const safeCandidates = await securityCheck(candidates);

    // 记录本次运行前已安装的技能（用于判断哪些是新装的）
    const beforeInstall = getInstalledSkills();

    const newlyInstalled = [];
    for (const candidate of safeCandidates) {
        const { name, author, url, description, risk } = candidate;
        try {
            await installSingleSkill(author, name, url, risk, description);
            // === 固化：安装后立即写入预观察（Memory Flush 机制）===
            await solidifySkill(author, name, description);
            newlyInstalled.push({ name, author, url, description, risk });
        } catch (e) {
            error(`Install failed: ${name} - ${e.message}`);
        }
    }

    // 写入新安装技能列表，供7am实测cron使用
    const newInstallFile = path.join(SKILLS_DIR, '.tmp-newly-installed-today.json');
    fs.writeFileSync(newInstallFile, JSON.stringify({
        date: new Date().toISOString(),
        skills: newlyInstalled
    }, null, 2), 'utf8');
    info(`Newly installed skills written to ${newInstallFile}: ${newlyInstalled.length} skills`);

    // 6. 实测：安装后立即对所有候选 skill 做功能验证（v1.7.2）
    await fieldTestSkills(safeCandidates);

    info('=== Full automatic process complete ===');
    return newlyInstalled;
}

// =========================================================
// =========================================================
// 6. 实测（fieldtest v1.7.2）
// 遵循 SKILL_LIFE.md 2.6.1 规则：
// 1. 读 SKILL.md 理解用法
// 2. 执行 skill（脚本 / 描述的命令）
// 3. 验证中间产物
// 4. 记录能做什么/不能做什么/坑
// 5. 输出到 SKILL-FIELD-TESTS.md
// =========================================================


function httpGet(url) {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const options = { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' } };
            const req = https.get(options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
            });
            req.on('error', e => resolve({ status: 0, error: e.message }));
            req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
        } catch (e) {
            resolve({ status: 0, error: e.message });
        }
    });
}

async function fieldTestSkill(author, skillName, description) {
    const safeSkillName = skillName.replace(/\//g, '-');
    const skillDir = path.join(SKILLS_DIR, author + '-' + safeSkillName);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const testsFile = FIELD_TESTS_FILE;

    info(`[fieldtest] Starting: ${author}/${skillName}`);

    // — 步骤1：读 SKILL.md ——————————————————————————————
    if (!fs.existsSync(skillMdPath)) {
        warn(`[fieldtest] SKILL.md not found for ${skillName}`);
        return { skill: skillName, author, status: '❌', error: 'SKILL.md not found', can: [], cannot: [], pitfalls: [] };
    }

    let skillMd;
    try {
        skillMd = fs.readFileSync(skillMdPath, 'utf8');
    } catch (e) {
        warn(`[fieldtest] Cannot read SKILL.md: ${e.message}`);
        return { skill: skillName, author, status: '❌', error: e.message, can: [], cannot: [], pitfalls: [] };
    }

    // — 步骤2：判断类型 ——————————————————————————————————
    const files = fs.existsSync(skillDir) ? fs.readdirSync(skillDir) : [];
    const codeFiles = files.filter(f => /\.(js|ts|py|sh|ps1|go|rb|php)$/i.test(f));
    const scriptsDir = path.join(skillDir, 'scripts');
    const hasScripts = fs.existsSync(scriptsDir);
    const isCodeType = codeFiles.length > 0 || hasScripts;

    const result = {
        skill: skillName,
        author,
        type: isCodeType ? 'code' : 'description',
        status: '🟡',
        can: [],
        cannot: [],
        pitfalls: [],
        testDetails: [],
        testedAt: new Date().toISOString()
    };

    // — 步骤2续：执行实测 ——————————————————————————————————
    if (isCodeType) {
        // ===== A. 有代码型：执行脚本 =====

        // 找可执行文件
        const executables = [];
        if (hasScripts) {
            const scriptFiles = fs.readdirSync(scriptsDir);
            for (const f of scriptFiles) {
                if (/\.(js|py|sh)$/i.test(f)) executables.push({ file: path.join(scriptsDir, f), name: f });
            }
        }
        for (const f of codeFiles) {
            if (!['SKILL.md', 'package.json', 'README.md', 'LICENSE', '_meta.json'].includes(f)) {
                executables.push({ file: path.join(skillDir, f), name: f });
            }
        }

        if (executables.length === 0) {
            result.status = '🟡';
            result.cannot.push('无可执行脚本文件');
            result.testDetails.push('SKILL.md存在但目录无脚本文件');
        } else {
            // 逐个执行
            for (const { file, name } of executables) {
                const ext = name.split('.').pop().toLowerCase();
                const isJs = ['js', 'ts'].includes(ext);
                const isPy = ext === 'py';
                const isSh = ['sh', 'ps1'].includes(ext);

                info(`[fieldtest] Running ${name}...`);

                // 提取 SKILL.md 里的用法描述，找测试参数
                const usageLines = skillMd.split('\n').filter(l =>
                    l.includes(name) || l.includes('Usage') || l.includes('命令') || l.includes('用法')
                ).slice(0, 3);
                const testArg = isPy ? ' --help' : (isJs ? ' --help' : '');

                try {
                    let output = '';
                    if (isJs) {
                        try {
                            output = require('child_process').execSync(
                                `node "${file}"${testArg}`, { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
                            );
                        } catch (e) {
                            output = e.stdout || e.stderr || '';
                            if (e.status !== 0 && e.status !== null) {
                                result.testDetails.push(`${name}: 退出码${e.status}，输出: ${output.substring(0, 200)}`);
                            }
                        }
                    } else if (isPy) {
                        try {
                            output = require('child_process').execSync(
                                `python "${file}" --help 2>&1`, { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
                            );
                        } catch (e) {
                            output = e.stdout || e.stderr || '';
                            if (e.status !== 0 && e.status !== null) {
                                result.testDetails.push(`${name}: 退出码${e.status}，输出: ${output.substring(0, 200)}`);
                            }
                        }
                    } else if (isSh) {
                        try {
                            output = require('child_process').execSync(
                                `bash "${file}" 2>&1`, { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
                            );
                        } catch (e) {
                            output = e.stdout || e.stderr || '';
                        }
                    }

                    if (output) {
                        const outStr = (typeof output === 'string' ? output : output.toString()).substring(0, 300);
                        result.testDetails.push(`${name}: ${outStr}`);
                        result.can.push(`${name} 可执行，输出: ${outStr}`);
                        info(`[fieldtest] ${name} output: ${outStr.substring(0, 100)}`);
                    }
                } catch (e) {
                    const errMsg = e.message || '';
                    // 判断错误类型
                    if (errMsg.includes('ENOENT') || errMsg.includes('not found')) {
                        result.cannot.push(`${name}: 运行环境缺失`);
                        result.pitfalls.push(`${name} 需要 ${isPy ? 'Python' : isJs ? 'Node.js' : 'Shell'} 环境`);
                    } else if (errMsg.includes('timeout')) {
                        result.cannot.push(`${name}: 执行超时`);
                    } else {
                        result.pitfalls.push(`${name}: ${errMsg.substring(0, 100)}`);
                    }
                    result.testDetails.push(`${name} ERROR: ${errMsg.substring(0, 150)}`);
                }
            }

            if (result.can.length > 0) {
                result.status = '🟢';
            } else if (result.pitfalls.length > 0) {
                result.status = '🟡';
            }
        }

    } else {
        // ===== B. 纯描述型：按 SKILL.md 描述的用法，实际执行 =====
        // 策略：提取 curl / API URL / 命令，用测试输入实际执行

        // 提取 curl 命令
        const curlMatches = skillMd.match(/curl\s+[^\n]{10,200}/gi) || [];
        // 提取 HTTP URL（API 端点）
        const httpUrls = skillMd.match(/https?:\/\/[^\s'"<>\)\n]{10,200}/gi) || [];
        // 提取脚本调用命令（如 node xxx.js, python xxx.py）
        const cmdMatches = skillMd.match(/(?:node|npx|python|python3|bash|sh)\s+[^\n]{5,100}/gi) || [];

        let hasExecutableContent = false;

        // 尝试执行 curl 命令
        for (const curlCmd of curlMatches.slice(0, 2)) {
            // 构造测试请求（把真实参数替换为测试参数）
            let testCmd = curlCmd
                .replace(/(-d\s+|--data\s+|--data-raw\s+)[^\s]+/g, '$1"test"')
                .replace(/(-X\s+|--request\s+)\w+/g, '$1GET')
                .replace(/(-H\s+[^\s]+\s+)[^\s]+/g, '$1"test"');
            if (testCmd.length < 10) continue;
            hasExecutableContent = true;

            info(`[fieldtest] Trying curl: ${testCmd.substring(0, 80)}...`);
            try {
                const output = require('child_process').execSync(testCmd, { encoding: 'utf8', timeout: 12000, stdio: 'pipe' });
                const outStr = output.substring(0, 200);
                result.can.push(`curl命令可达: ${outStr.substring(0, 80)}`);
                result.testDetails.push(`curl OK: ${outStr}`);
                result.status = '🟢';
            } catch (e) {
                const err = (e.stderr || e.message || '').substring(0, 150);
                // 区分网络错误和认证错误
                if (e.status === 0 && err.includes('command not found')) {
                    result.cannot.push('curl 不可用');
                } else if (e.status === 22) {
                    // HTTP 4xx，可能是需要认证
                    result.can.push('API端点正确，需要API Key');
                    result.testDetails.push(`curl HTTP 4xx: ${err}`);
                } else if (e.status === 7 || err.includes('Connection refused') || err.includes('timeout')) {
                    result.cannot.push('服务不可达（网络或服务未启动）');
                    result.testDetails.push(`curl连接失败: ${err}`);
                } else {
                    result.testDetails.push(`curl执行: ${err}`);
                }
            }
        }

        // 尝试执行脚本调用命令（node ./scripts/deepwiki.js 等）
        for (const cmd of cmdMatches.slice(0, 2)) {
            hasExecutableContent = true;
            info(`[fieldtest] Trying command: ${cmd}...`);
            try {
                const output = require('child_process').execSync(cmd, { encoding: 'utf8', timeout: 12000, stdio: 'pipe' });
                const outStr = output.substring(0, 200);
                result.can.push(`命令可执行: ${cmd.split(' ')[0]} → ${outStr.substring(0, 80)}`);
                result.testDetails.push(`cmd OK: ${outStr}`);
                result.status = '🟢';
            } catch (e) {
                const err = (e.stderr || e.message || '').substring(0, 150);
                if (err.includes('ENOENT') || err.includes('not found')) {
                    result.cannot.push(`工具不可用: ${cmd.split(' ')[0]}`);
                } else if (err.includes('404') || err.includes('not found')) {
                    result.cannot.push('资源不存在（404）');
                } else {
                    result.pitfalls.push(`${cmd.split(' ').slice(0,2).join(' ')}: ${err.substring(0, 100)}`);
                }
                result.testDetails.push(`cmd ERROR: ${err}`);
            }
        }

        // 尝试 HTTP GET 请求验证 API 可达性（对于描述里有 URL 但没有 curl 命令的）
        const uniqueUrls = [...new Set(httpUrls)].slice(0, 3);
        for (const url of uniqueUrls) {
            if (curlMatches.some(c => c.includes(url))) continue; // 已经测过了
            hasExecutableContent = true;
            const cleanUrl = url.replace(/[<>]$/, '').trim();
            info(`[fieldtest] Trying HTTP GET: ${cleanUrl.substring(0, 80)}...`);
            try {
                const res = await httpGet(cleanUrl);
                if (res.status >= 200 && res.status < 300) {
                    result.can.push(`HTTP ${res.status}: ${cleanUrl.substring(0, 60)}`);
                    result.testDetails.push(`HTTP GET ${res.status}: ${cleanUrl.substring(0, 80)}`);
                    if (result.status !== '🟢') result.status = '🟡';
                } else if (res.status >= 400 && res.status < 500) {
                    result.can.push(`API端点存在(HTTP ${res.status})，需要认证或参数`);
                    result.testDetails.push(`HTTP ${res.status}: ${cleanUrl.substring(0, 80)}`);
                    if (result.status !== '🟢') result.status = '🟡';
                } else {
                    result.pitfalls.push(`HTTP ${res.status}: ${cleanUrl.substring(0, 60)}`);
                    result.testDetails.push(`HTTP GET ${res.status}: ${cleanUrl}`);
                }
            } catch (e) {
                result.cannot.push(`网络不可达: ${cleanUrl.substring(0, 60)}`);
                result.testDetails.push(`HTTP GET ERROR: ${e.message}`);
            }
        }

        // 如果什么都没有提取到
        if (!hasExecutableContent || (result.can.length === 0 && result.cannot.length === 0)) {
            result.status = '🟡';
            result.cannot.push('SKILL.md 无可执行内容（纯描述型，需外部服务/凭证）');
            result.testDetails.push('SKILL.md 仅包含文字描述，未提取到可执行命令');
        }
    }

    // — 步骤3：验证中间产物 ——————————————————————————————————
    // 检查安装目录是否有预期的输出文件
    const expectedOutputs = ['output.json', 'result.txt', 'data.csv', 'report.md'];
    for (const f of files) {
        if (expectedOutputs.some(o => f.includes(o))) {
            result.testDetails.push(`检测到输出文件: ${f}`);
        }
    }

    // — 步骤4：综合判断，写入 SKILL-FIELD-TESTS.md ————————————————
    if (result.can.length > 0 && result.cannot.length === 0 && result.pitfalls.length === 0) {
        result.status = '🟢';
    } else if (result.can.length === 0) {
        result.status = result.pitfalls.length > 0 ? '🟡' : '❌';
    }

    // 追加到 SKILL-FIELD-TESTS.md
    const entry = [
        `## ${skillName}（${result.type}型）${result.status}`,
        '',
        `**测试时间**: ${result.testedAt}`,
        `**作者**: ${author}`,
        '',
        `### 能做什么`,
        ...(result.can.length > 0 ? result.can.map(s => `- ${s}`) : ['- （未能实测出功能）']),
        '',
        `### 不能做什么`,
        ...(result.cannot.length > 0 ? result.cannot.map(s => `- ${s}`) : ['- （未发现限制）']),
        '',
        `### 坑`,
        ...(result.pitfalls.length > 0 ? result.pitfalls.map(s => `- ${s}`) : ['- 暂无记录']),
        '',
        `### 实测细节`,
        ...result.testDetails.map(s => `- ${s}`),
        '',
    ].join('\n');

    const existing = fs.existsSync(testsFile) ? fs.readFileSync(testsFile, 'utf8') : '';
    const header = existing.includes('# SKILL 实测记录') ? '' : '# SKILL 实测记录\n\n';
    const updated = header + existing.replace(header, '') + entry + '\n---\n\n';
    fs.writeFileSync(testsFile, updated, 'utf8');

    info(`[fieldtest] Complete: ${author}/${skillName} → ${result.status}`);
    info(`  can: ${result.can.length} | cannot: ${result.cannot.length} | pitfalls: ${result.pitfalls.length}`);

    return result;
}

// fieldTestSkill 对外接口（数组版，供 fullAutomatic 调用）
async function fieldTestSkills(skillList) {
    // skillList: [{name, author, url, description, risk}]
    info(`[fieldtest] Starting field test for ${skillList.length} skills`);
    const results = [];
    for (const s of skillList) {
        try {
            const r = fieldTestSkill(s.author, s.name, s.description);
            results.push(r);
        } catch (e) {
            warn(`[fieldtest] ${s.name} threw: ${e.message}`);
            results.push({ skill: s.name, author: s.author, status: '❌', error: e.message });
        }
    }
    const pass = results.filter(r => r.status === '🟢').length;
    const warn_count = results.filter(r => r.status === '🟡').length;
    const fail = results.filter(r => r.status === '❌').length;
    info(`[fieldtest] Done: 🟢${pass} 🟡${warn_count} ❌${fail}`);
    return results;
}


// 入口
// =========================================================
let action = 'fullautomatic';
const args = process.argv.slice(2);

// ———— 模块导出模式（用于被其他脚本 require） ————
if (args.includes('--module')) {
    module.exports = { securityCheck, installSingleSkill, fullAutomatic, recordUsage, fieldTestSkill, solidifySkill, detectPatterns, weeklyIntrospection };
    info('Module export ready: securityCheck, installSingleSkill, fullAutomatic, recordUsage, fieldTestSkill, solidifySkill, detectPatterns, weeklyIntrospection');
    process.exit(0);
}

if (args.length > 0) {
    action = args[0];
}

switch (action) {
    case 'search':
        (async () => { await searchSkills(); })();
        break;
    case 'filter':
        filterSkills();
        break;
    case 'securitycheck':
        (async () => {
            const candidates = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, '.filtered-top20.json'), 'utf8'));
            await securityCheck(candidates);
        })();
        break;
    case 'install':
        if (args.length < 5) {
            error('Usage: install <author> <skillname> <url> <risk> <description>');
            process.exit(1);
        }
        (async () => {
            await installSingleSkill(args[1], args[2], args[3], args[4], args[5]);
        })();
        break;
    case 'use':
        // 用法: node xiage-skills.js use <skillname> <success|fail> [notes]
        if (args.length < 3) {
            error('Usage: use <skillname> <success|fail> [notes]');
            process.exit(1);
        }
        recordUsage(args[1], args[2], args[3]);
        break;
    case 'evaluate':
        evaluateSkills();
        break;
    case 'retire':
        // 用法: node xiage-skills.js retire <skill1> <skill2> ...
        if (args.length < 2) {
            error('Usage: retire <skillname> [skillname ...]');
            process.exit(1);
        }
        retireSkills(args.slice(1));
        break;

    // ———— 模式识别：分析使用记录，生成 Level 2 建议 ————
    case 'detect-patterns':
        detectPatterns();
        break;

    // ———— 周省：全局 introspection ————
    case 'introspect':
    case 'weekly-introspection':
        weeklyIntrospection();
        break;

    // ———— 单技能安装：安检 → 安装 → 记录 ————
    // 用法: node xiage-skills.js skill <author/skillname> [url]
    case 'skill':
        if (args.length < 2) {
            error('Usage: node xiage-skills.js skill <author/skillname> [url]');
            process.exit(1);
        }
        (async () => {
            const input = args[1];
            const [author, skillName] = input.split('/');
            if (!author || !skillName) {
                error('Format must be: author/skillname, got: ' + input);
                process.exit(1);
            }
            let url = args[2] || '';
            if (!url || url.startsWith('--')) url = `https://github.com/${author}/${skillName}`;

            // ———— GitHub 仓库存在性预检查（异步+超时，不卡主流程） ————
            const checkGitHub = () => new Promise(resolve => {
                let resolved = false;
                const timer = setTimeout(() => { if (!resolved) { resolved = true; resolve('TIMEOUT'); } }, 8000);
                const req = https.get(`https://api.github.com/repos/${author}/${skillName}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
                }, res => {
                    let d = ''; res.on('data', c => d += c); res.on('end', () => {
                        if (resolved) return;
                        clearTimeout(timer); resolved = true;
                        try { const j = JSON.parse(d); resolve(j.id ? 'OK' : 'GONE'); } catch { resolve('PARSE_ERR'); }
                    });
                });
                req.on('timeout', () => { if (!resolved) { resolved = true; resolve('TIMEOUT'); } });
                req.on('error', () => { if (!resolved) { resolved = true; resolve('NETERR'); } });
            });

            info(`[skill] GitHub仓库检查: ${author}/${skillName}...`);
            const repoStatus = await checkGitHub();
            if (repoStatus !== 'OK') {
                warn(`[skill] ⚠️ GitHub仓库${repoStatus === 'TIMEOUT' ? '超时' : repoStatus === 'NETERR' ? '网络不可达' : '不存在'}: ${author}/${skillName}（跳过，继续安装流程）`);
            } else {
                info(`[skill] GitHub仓库验证🟢: ${author}/${skillName}`);
            }

            const candidate = { name: skillName, author, url, risk: '?? ', description: `单技能安装: ${author}/${skillName}` };

            info(`[skill] 安检: ${author}/${skillName}`);
            const safe = await securityCheck([candidate]);
            if (safe.length === 0) {
                warn(`[skill] 安检未通过: ${author}/${skillName}`);
                process.exit(1);
            }
            info(`[skill] 安装: ${author}/${skillName}`);
            await installSingleSkill(safe[0].author, safe[0].name, safe[0].url, safe[0].risk, safe[0].description);
            recordUsage(skillName, 'success', `单技能安装: ${author}/${skillName}`);

            // 写入新装技能文件，让7am实测cron能读到
            const newInstallFile = path.join(SKILLS_DIR, '.tmp-newly-installed-today.json');
            let newInstallData = { date: new Date().toISOString(), skills: [] };
            if (fs.existsSync(newInstallFile)) {
                try { newInstallData = JSON.parse(fs.readFileSync(newInstallFile, 'utf8')); } catch(e) {}
            }
            newInstallData.skills.push({ name: skillName, author, url: safe[0].url, description: safe[0].description });
            fs.writeFileSync(newInstallFile, JSON.stringify(newInstallData, null, 2));
            info(`[skill] 已写入新装技能列表: ${newInstallFile}`);

            // ———— 实测：验证 SKILL.md 存在 + 基本语法 ————
            const installPath = path.join(SKILLS_DIR, `${author}-${skillName}`);
            const skillMdPath = path.join(installPath, 'SKILL.md');
            if (fs.existsSync(skillMdPath)) {
                const content = fs.readFileSync(skillMdPath, 'utf8');
                if (content.length < 50) {
                    warn(`[skill] 实测⚠️：SKILL.md 内容过短（${content.length}字符）`);
                    recordUsage(skillName, 'fail', `实测失败：SKILL.md内容过短(${content.length}字符)`);
                } else {
                    info(`[skill] 实测🟢：SKILL.md 存在（${content.length}字符）`);
                    // 检查是否有可执行的 skill 文件（.js/.mjs）
                    const skillFiles = fs.readdirSync(installPath).filter(f => /\.(js|mjs)$/.test(f) && f !== 'package.json');
                    for (const sf of skillFiles) {
                        const sfPath = path.join(installPath, sf);
                        try {
                            const { execSync } = require('child_process');
                            execSync(`node -c "${sfPath}"`, { stdio: 'ignore', timeout: 10000 });
                            info(`[skill] 实测🟢：${sf} 语法检查通过`);
                        } catch (e) {
                            warn(`[skill] 实测⚠️：${sf} 语法检查失败`);
                            recordUsage(skillName, 'fail', `实测失败：${sf}语法错误`);
                        }
                    }
                    if (skillFiles.length === 0) {
                        info(`[skill] 实测🟡：无JS执行文件，纯配置型skill`);
                    }
                }
            } else {
                warn(`[skill] 实测🔴：SKILL.md 不存在`);
                recordUsage(skillName, 'fail', `实测失败：SKILL.md不存在`);
            }

            // ———— 实测（自动） ————
            info(`[skill] 开始实测: ${author}/${skillName}`);
            await fieldTestSkill(author, skillName);

            info(`[skill] 完成: ${author}/${skillName}`);
        })();
        break;

    // ———— 单技能评估（仅安检+记录，不安装） ————
    // 用法: node xiage-skills.js eval-only <author/skillname> [pass|fail]
    case 'eval-only':
        if (args.length < 2) {
            error('Usage: node xiage-skills.js eval-only <author/skillname> [pass|fail]');
            process.exit(1);
        }
        (async () => {
            const input = args[1];
            const result = args[2] || 'pass';
            const [author, skillName] = input.split('/');
            if (!author || !skillName) {
                error('Format must be: author/skillname, got: ' + input);
                process.exit(1);
            }
            const url = `https://github.com/${author}/${skillName}`;
            const candidate = { name: skillName, author, url, risk: '?? ', description: `评估: ${author}/${skillName}` };

            info(`[eval-only] 安检: ${author}/${skillName}`);
            const safe = await securityCheck([candidate]);
            if (safe.length > 0) {
                recordUsage(skillName, result, `评估: ${author}/${skillName} - ${result}`);
                info(`[eval-only] 评估完成: ${author}/${skillName} -> ${result}`);
            } else {
                warn(`[eval-only] 安检未通过: ${author}/${skillName}`);
                process.exit(1);
            }
        })();
        break;

    // ———— 实测函数：实际运行 skill 并记录到 SKILL-FIELD-TESTS.md ————
    // 三种调用方式：
    //   1. skill 命令安装后直接调用
    //   2. fieldtest <author/skillname> 手动触发
    //   3. cron 读 .tmp-newly-installed-today.json 批量调用
    // 返回: { pass, conclusion, findings: {can: [], cannot: [], errors: []} }
    async function fieldTestSkill(author, skillName) {
        const installPath = path.join(SKILLS_DIR, `${author}-${skillName}`);
        const skillMdPath = path.join(installPath, 'SKILL.md');
        const FIELD_TESTS = `${process.env.USERPROFILE}/.openclaw/workspace/skills/xiage-skills/metadata/SKILL-FIELD-TESTS.md`;
        const today = new Date().toISOString().split('T')[0];

        info(`[fieldtest] 开始实测: ${author}/${skillName}`);

        // ———— 1. 读取 SKILL.md，理解技能用法 ————
        let skillMdContent = '';
        let triggerCommand = '';
        let description = '';
        if (fs.existsSync(skillMdPath)) {
            skillMdContent = fs.readFileSync(skillMdPath, 'utf8');
            // 提取描述
            const descMatch = skillMdContent.match(/description:\s*["']?([^"'\n]+)/i);
            if (descMatch) description = descMatch[1].trim();
            // 提取触发命令（找 ## 命令 / ## Usage / ### 运行 等章节）
            const usageLines = skillMdContent.split('\n').filter(l =>
                l.match(/^#{1,3}\s*[(（]?[来来运行执行启动]/) ||
                l.match(/命令|Usage|Command|触发|Trigger/) ||
                l.match(/`[^`]*?(?:bash|node|npx|opencli)/)
            );
            triggerCommand = usageLines.slice(0, 3).join(' | ');
        } else {
            warn(`[fieldtest] SKILL.md 不存在`);
            return { pass: false, conclusion: 'SKILL.md不存在，无法实测', findings: { can: [], cannot: ['SKILL.md缺失'], errors: ['SKILL.md不存在'] } };
        }

        // ———— 2. 收集所有可执行文件 ————
        const execFiles = [];
        if (fs.existsSync(installPath)) {
            fs.readdirSync(installPath, { withFileTypes: true }).forEach(entry => {
                if (entry.isFile() && /\.(js|mjs|ts|sh|ps1)$/i.test(entry.name) && entry.name !== 'package.json') {
                    execFiles.push(path.join(installPath, entry.name));
                }
            });
            // scripts/ 子目录
            const scriptsDir = path.join(installPath, 'scripts');
            if (fs.existsSync(scriptsDir)) {
                fs.readdirSync(scriptsDir, { withFileTypes: true }).forEach(entry => {
                    if (entry.isFile() && /\.(js|mjs|ts)$/i.test(entry.name)) {
                        execFiles.push(path.join(scriptsDir, entry.name));
                    }
                });
            }
        }

        const errors = [];
        const canDo = [];
        const cannotDo = [];

        // ———— 3. 实际运行测试 ————
        for (const f of execFiles) {
            const fname = path.basename(f);
            const ext = path.extname(f).toLowerCase();
            try {
                if (ext === '.sh') {
                    const out = execSync(`bash "${f}" --help 2>&1`, { stdio: 'pipe', timeout: 15000, cwd: installPath });
                    canDo.push(`bash ${fname} --help: 成功`);
                } else if (ext === '.ps1') {
                    const out = execSync(`powershell -ExecutionPolicy Bypass -File "${f}" -Help 2>&1`, { stdio: 'pipe', timeout: 15000, cwd: installPath });
                    canDo.push(`powershell ${fname}: 成功`);
                } else if (ext === '.ts') {
                    // 尝试 ts-node 或直接 node 跑
                    try {
                        const out1 = execSync(`npx ts-node --help 2>&1`, { stdio: 'pipe', timeout: 5000, cwd: installPath });
                        const out2 = execSync(`npx ts-node "${f}" 2>&1`, { stdio: 'pipe', timeout: 20000, cwd: installPath });
                        canDo.push(`ts-node ${fname}: 执行成功`);
                    } catch (e) {
                        const stderr = e.stderr ? e.stderr.toString() : '';
                        const stdout = e.stdout ? e.stdout.toString() : '';
                        const output = (stdout + stderr).slice(0, 300);
                        if (output.includes('Cannot find module') || output.includes('ERR_MODULE')) {
                            errors.push(`${fname}: 依赖缺失（${output.split('\n')[0]}）`);
                            cannotDo.push(`${fname}: 依赖不满足`);
                        } else if (output.includes('GEMINI') || output.includes('API_KEY') || output.includes('apiKey')) {
                            errors.push(`${fname}: 需要API Key（${output.split('\n')[0]}）`);
                            cannotDo.push(`${fname}: 需要配置API Key`);
                        } else {
                            errors.push(`${fname}: ${output.split('\n')[0]}`);
                        }
                    }
                } else {
                    // .js / .mjs：先 --help，再直接跑
                    let ran = false;
                    try {
                        const out1 = execSync(`node "${f}" --help 2>&1`, { stdio: 'pipe', timeout: 10000, cwd: installPath });
                        canDo.push(`node ${fname} --help: 成功`);
                        ran = true;
                    } catch (e1) {}
                    if (!ran) {
                        try {
                            const out2 = execSync(`node "${f}" 2>&1`, { stdio: 'pipe', timeout: 15000, cwd: installPath });
                            canDo.push(`node ${fname}: 执行成功`);
                        } catch (e2) {
                            const errOut = (e2.stderr || '').toString();
                            const stdOut = (e2.stdout || '').toString();
                            const output = (stdOut + errOut).slice(0, 300);
                            if (output.match(/API_KEY|apiKey|GEMINI|OPENAI|ANTHROPIC/)) {
                                errors.push(`${fname}: 需要API Key`);
                                cannotDo.push(`${fname}: 需要配置API Key`);
                            } else if (output.includes('MODULE_NOT_FOUND') || output.includes('Cannot find module')) {
                                errors.push(`${fname}: 依赖缺失`);
                                cannotDo.push(`${fname}: 依赖不满足`);
                            } else {
                                errors.push(`${fname}: ${output.split('\n')[0]}`);
                            }
                        }
                    }
                }
            } catch (e) {
                const errMsg = e.message || (e.stderr && e.stderr.toString ? e.stderr.toString() : '');
                errors.push(`${fname}: ${errMsg.slice(0, 200)}`);
            }
        }

        // ———— 4. 判断结论 ————
        let conclusion = '';
        let pass = false;
        if (execFiles.length === 0) {
            conclusion = '无执行文件，纯配置型 skill';
            pass = true;
        } else if (canDo.length > 0 && errors.filter(e => !e.includes('需要API')).length === 0) {
            conclusion = '可正常运行';
            pass = true;
        } else if (errors.some(e => e.includes('需要API Key'))) {
            conclusion = '需要配置 API Key 才可运行';
            pass = true; // 不是错误，是依赖未配置
        } else if (errors.length > 0) {
            conclusion = `存在${errors.length}个问题：${errors[0]}`;
            pass = false;
        } else {
            conclusion = '实测通过，无明显问题';
            pass = true;
        }

        // ———— 5. 写入 SKILL-FIELD-TESTS.md ————
        const record = `\n---\n\n## ${skillName} | ${today} | ${description || '未知功能'}\n\n**结论**：${conclusion}\n\n### 实测过程\n${triggerCommand ? `触发命令参考：${triggerCommand}` : '（无明确触发命令）'}\n执行文件：${execFiles.length > 0 ? execFiles.map(f => path.relative(installPath, f)).join(', ') || '无' : '无执行文件'}\n\n### 能做什么\n${canDo.length > 0 ? canDo.map(c => `- ${c}`).join('\n') : '- 未知（请参考 SKILL.md）'}\n\n### 不能做什么\n${cannotDo.length > 0 ? cannotDo.map(c => `- ${c}`).join('\n') : '- 暂未发现'}\n\n### 坑\n${errors.length > 0 ? errors.map(e => `- ${e}`).join('\n') : '- 暂无已知问题'}\n`;
        try {
            if (fs.existsSync(FIELD_TESTS)) {
                fs.appendFileSync(FIELD_TESTS, record, 'utf8');
                info(`[fieldtest] 记录已追加: SKILL-FIELD-TESTS.md`);
            } else {
                fs.writeFileSync(FIELD_TESTS, `# Skill 实测报告库\n\n> 每次实测一个skill后的边界记录：能做什么、不能做什么、有什么坑。\n\n---\n${record}`, 'utf8');
                info(`[fieldtest] 新建实测报告: SKILL-FIELD-TESTS.md`);
            }
        } catch (e) {
            warn(`[fieldtest] 写入报告失败: ${e.message}`);
        }

        info(`[fieldtest] 完成: ${author}/${skillName} → ${pass ? '🟢' : '🔴'} ${conclusion}`);
        return {
            pass: errors.length === 0,
            conclusion: errors.length === 0 ? '🟢 通过' : '🔴 失败',
            skillName,
            author,
            abilityType: '',       // 能力类型：提取/生成/分析/执行/转换/监控
            triggerScenario: '',   // 触发场景：遇到什么问题时该用
            abilityBoundary: '',  // 能力边界：不能处理什么
            comboRecommendation: '', // 组合推荐：适合与哪些skill串联
            testStatus: new Date().toISOString(), // 实测状态：时间+结论
            availability: errors.length === 0 ? '🟢 正常' : '🔴 失效', // 可用性
            findings: { can: canDo, cannot: cannotDo, errors }
        };
    }

    // ———— 每日定时全流程（凌晨1点：搜索→筛选→安检→安装）———
    // 用法: node xiage-skills.js daily
    case 'daily':
        (async () => {
            info('[daily] Starting full automatic process...');
            await fullAutomatic();
            info('[daily] Full automatic process complete.');
        })();
        break;

    // ———— 评估报告：读取今日新装技能，生成实测报告 ————
    // 用法: node xiage-skills.js report
    case 'report':
        (async () => {
            const newInstallFile = path.join(SKILLS_DIR, '.tmp-newly-installed-today.json');
            if (!fs.existsSync(newInstallFile)) {
                info('今日无新安装技能，报告为空');
                process.exit(0);
            }
            let data;
            try {
                data = JSON.parse(fs.readFileSync(newInstallFile, 'utf8'));
            } catch(e) {
                error('无法读取新装技能文件: ' + e.message);
                process.exit(1);
            }
            if (!data.skills || data.skills.length === 0) {
                info('今日无新安装技能');
                process.exit(0);
            }

            info(`=== 今日新装技能实测报告（${data.skills.length}个）===\n`);
            for (const s of data.skills) {
                const installPath = path.join(SKILLS_DIR, `${s.author}-${s.name}`);
                const skillMdPath = path.join(installPath, 'SKILL.md');
                const pkgPath = path.join(installPath, 'package.json');
                const jsFiles = fs.existsSync(installPath) ? fs.readdirSync(installPath).filter(f => /\.(js|mjs)$/.test(f) && f !== 'package.json') : [];

                let status = '🟢';
                let issues = [];
                if (!fs.existsSync(skillMdPath)) { status = '🔴'; issues.push('SKILL.md不存在'); }
                else {
                    const content = fs.readFileSync(skillMdPath, 'utf8');
                    if (content.length < 50) { status = '🟡'; issues.push(`SKILL.md内容过短(${content.length}字)`); }
                    else if (content.includes('404') || content.includes('Not Found')) { status = '🔴'; issues.push('SKILL.md内容为404'); }
                    if (jsFiles.length > 0) {
                        for (const jf of jsFiles) {
                            const jfPath = path.join(installPath, jf);
                            try { require('child_process').execSync(`node -c "${jfPath}"`, { stdio: 'ignore', timeout: 10000 }); }
                            catch(e) { status = '🟡'; issues.push(`${jf}语法错误`); }
                        }
                    }
                }
                if (!fs.existsSync(pkgPath)) { issues.push('package.json不存在'); }

                console.log(`## ${s.name} ${status}`);
                console.log(`- 作者: ${s.author}`);
                console.log(`- 安装路径: skills/${s.author}-${s.name}/`);
                console.log(`- 描述: ${s.description || '无'}`);
                console.log(`- JS文件: ${jsFiles.length > 0 ? jsFiles.join(', ') || '无' : '无（纯配置型）'}`);
                if (issues.length > 0) console.log(`- ⚠️ 问题: ${issues.join('; ')}`);
                else console.log(`- ✅ 无问题`);
                console.log('');
            }
            info(`=== 报告生成完毕 ===`);
        })();
        break;

    // ———— 手动触发实测 ————
    // 用法: node xiage-skills.js fieldtest <author/skillname>
    case 'fieldtest':
        if (args.length < 2) {
            error('Usage: node xiage-skills.js fieldtest <author/skillname>');
            process.exit(1);
        }
        (async () => {
            const input = args[1];
            const [author, skillName] = input.split('/');
            if (!author || !skillName) {
                error('Format must be: author/skillname, got: ' + input);
                process.exit(1);
            }
            const result = await fieldTestSkill(author, skillName);
            console.log(JSON.stringify(result, null, 2));
        })();
        break;

    default:
        (async () => { await fullAutomatic(); })();
        break;
}
