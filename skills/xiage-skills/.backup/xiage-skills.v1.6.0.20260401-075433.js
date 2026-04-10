// xiage-skills.js - 自定义技能全生命周期闭环自动化
// 遵循 SKILL_LIFE.md 规则

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

// 配置
const SKILLS_INDEX = `${process.env.USERPROFILE}\\.openclaw\\workspace\\SKILLS-INDEX.md`;
const EVALUATION_FILE = `${process.env.USERPROFILE}\\.openclaw\\workspace\\SKILLS-EVALUATION.md`;
const SKILLS_DIR = `${process.env.USERPROFILE}\\.openclaw\\workspace\\skills`;
const USAGE_FILE = `${process.env.USERPROFILE}\\.openclaw\\workspace\\memory\\skill-usage.json`;
const RETIRED_DIR = `${process.env.USERPROFILE}\\.openclaw\\workspace\\skills\\retired`;
const LOG_FILE = `${process.env.USERPROFILE}\\.openclaw\\workspace\\memory\\xiage-skills-run.log`;
const MEMORY_DIR = `${process.env.USERPROFILE}\\.openclaw\\workspace\\memory`;

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
    const tmpTrending = `${SKILLS_DIR}\\.tmp-skills-trending.html`;
    await autoLoadFullHtml('https://skills.sh/openclaw/skills', tmpTrending, 100);

    const tmpDownloads = `${SKILLS_DIR}\\.tmp-skills-downloads.html`;
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
    const tmpClawhub = `${SKILLS_DIR}\\.tmp-clawhub-downloads.html`;
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

    const quota = { clawhub: 20, trending: 20, downloads: 20 };

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
    const nameSet = new Set();
    const unique = all.filter(s => {
        if (nameSet.has(s.name)) { return false; }
        nameSet.add(s.name);
        return true;
    });

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
    const tmpDir = `${SKILLS_DIR}\\.tmp-checkout`;

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
            fs.rmSync(checkoutPath, { recursive: true, force: true });

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

    // 下载并解压 ZIP（手动跟随 307 重定向，再验证 content-type）
    return new Promise((resolve, reject) => {
        const doDownload = (url) => {
            const file = fs.createWriteStream(zipPath);
            https.get(url, (res) => {
                if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {
                    file.close();
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    doDownload(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(`Download failed: HTTP ${res.statusCode}`));
                    return;
                }
                const ct = (res.headers['content-type'] || '').toLowerCase();
                if (!ct.includes('zip') && !ct.includes('octet-stream') && !ct.includes('compressed')) {
                    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    reject(new Error(`Not a zip (content-type: ${ct}), possible redirect to error page`));
                    return;
                }
                res.pipe(file);
                file.on('finish', () => {
                    try {
                        const stats = fs.statSync(zipPath);
                        if (stats.size < 500) {
                            fs.unlinkSync(zipPath);
                            reject(new Error(`Downloaded file too small: ${stats.size} bytes`));
                            return;
                        }
                        const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                        const zip = new AdmZip(zipPath);
                        fs.mkdirSync(installPath, { recursive: true });
                        zip.extractAllTo(installPath, true);
                        fs.unlinkSync(zipPath);
                        resolve();
                    } catch (e) {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        reject(e);
                    }
                });
                file.on('error', (err) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(err); });
            }).on('error', (e) => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });
        };
        doDownload(realUrl);
    });
}

// ———— skills.sh 页面文本抓取（最可靠，直接提取渲染后的 SKILL.md 内容）———
async function installViaSkillsShPageFetch(author, skillName, installPath) {
    const pageUrl = `https://skills.sh/${author}/skills/${skillName}`;
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

        // Fallback 2: GitHub API
        try {
            await installViaGithubApi(author, skillName, installPath, zipPath, doInstall);
            return;
        } catch (e3) {
            warn(`  skills.sh: GitHub API failed (${e3.message}), trying ClawHub...`);
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

    info('=== Full automatic process complete ===');
    return newlyInstalled;
}

// ———— 预下载 openclaw/skills monorepo 一次，复用给所有 skills.sh 技能 ————
const MONOREPO_CACHE = { path: null, downloading: null };

async function preDownloadOpenclawSkillsRepo() {
    if (MONOREPO_CACHE.path && fs.existsSync(MONOREPO_CACHE.path)) {
        info(`  [cache] openclaw/skills already cached at ${MONOREPO_CACHE.path}`);
        return MONOREPO_CACHE.path;
    }
    if (MONOREPO_CACHE.downloading) {
        info('  [cache] Another download in progress, waiting...');
        return MONOREPO_CACHE.downloading;
    }

    const zipPath = path.join(SKILLS_DIR, `.tmp-openclaw-skills.zip`);
    const extractPath = path.join(SKILLS_DIR, `.tmp-openclaw-skills-extract`);

    const downloadPromise = new Promise(async (resolve, reject) => {
        try {
            // 清理旧缓存
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });

            // GitHub API → 302 → codeload
            const apiUrl = 'https://api.github.com/repos/openclaw/skills/zipball/main';
            info(`  [download] Getting ${apiUrl}...`);

            const doDownload = (url) => {
                const file = fs.createWriteStream(zipPath);
                https.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/vnd.github+json' }
                }, (res) => {
                    if ([307, 302, 303].includes(res.statusCode) && res.headers.location) {
                        file.close(); if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        doDownload(res.headers.location); return;
                    }
                    if (res.statusCode !== 200) { file.close(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
                    const ct = (res.headers['content-type'] || '').toLowerCase();
                    if (!ct.includes('zip') && !ct.includes('octet') && !ct.includes('compressed')) {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        reject(new Error(`Not zip: ${ct}`)); return;
                    }
                    res.pipe(file);
                    file.on('finish', () => {
                        info(`  [download] ZIP downloaded, extracting...`);
                        const AdmZip = require(process.env.APPDATA + '/npm/node_modules/adm-zip');
                        const zip = new AdmZip(zipPath);
                        fs.mkdirSync(extractPath, { recursive: true });
                        zip.extractAllTo(extractPath, true);
                        fs.unlinkSync(zipPath);
                        // 找顶层目录
                        const topDirs = fs.readdirSync(extractPath);
                        if (!topDirs.length) { reject(new Error('Empty ZIP')); return; }
                        const skillsDir = path.join(extractPath, topDirs[0], 'skills');
                        if (!fs.existsSync(skillsDir)) { reject(new Error('No skills/ subdir in ZIP')); return; }
                        MONOREPO_CACHE.path = skillsDir;
                        info(`  [cache] openclaw/skills Skills/ cached at ${skillsDir}`);
                        resolve(skillsDir);
                    });
                    file.on('error', err => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(err); });
                }).on('error', e => { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); reject(e); });
            };
            doDownload(apiUrl);
        } catch (e) {
            reject(e);
        }
    });

    MONOREPO_CACHE.downloading = downloadPromise;
    try {
        const result = await downloadPromise;
        MONOREPO_CACHE.downloading = null;
        return result;
    } catch (e) {
        MONOREPO_CACHE.downloading = null;
        throw e;
    }
}

// =========================================================
// 入口
// =========================================================
let action = 'fullautomatic';
const args = process.argv.slice(2);
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
    default:
        (async () => { await fullAutomatic(); })();
        break;
}
