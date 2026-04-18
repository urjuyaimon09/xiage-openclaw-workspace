/**
 * doc-loader.js v4.0.0
 * 层级文档加载器 - 动态文件系统扫描 + 静态索引元数据
 * 
 * v4.0.0 核心升级：
 * - warmUp() 动态扫描文件系统，对齐实际文件结构
 * - 静态 doc-index.json 提供向量/关键词元数据
 * - 文件存在性 100% 准确，不再有过期路径问题
 * 
 * 设计理念：
 * - Loop1 = 帧级感知：给定输入上下文，返回需要加载的文档目录（快，只读索引）
 * - Loop2 = 按需读取：给定文档ID，返回完整原文
 * 
 * 层级索引结构（nested）：
 *   categories/
 *     identity/              ← SOUL.md, USER.md, IDENTITY.md
 *     rules/                 ← 规则层
 *       execution/           ← PRIMARY, AGENTS, BOOTSTRAP, MEMORY, HEARTBEAT
 *       code/                ← CODE_RULES, DOC_RULES
 *       safety/              ← SAFETY_RULES
 *       meta/                ← WORKING_PRINCIPLE, VISION, LEGISLATION等
 *     consciousness/        ← 意识层
 *       engine/              ← 意识.md, doc-index.json, doc-loader.js
 *       6模型/              ← 6个prompt文件
 *     mind/                  ← 心智层
 *       驱动器/             ← 驱动器v2.js, 驱动引擎v2.md
 *       引擎/               ← 显意识注意力思维引擎, 状态采集器, 心智日志
 *       COGNITION/          ← COGNITION_MODEL.md
 *       索引/               ← 索引.md, 心智层手册
 *     projects/              ← 项目层
 *       索引/               ← 索引.md
 *       项目档案/            ← P001-*.md
 *       规则/               ← 项目管理规则
 *     cognition/             ← Cognition/
 *       index/              ← index.md
 *       世界观/人生观/价值观/协作观/行业观/元认知
 *     meta-cognition/        ← 元认知 4文件
 *     meta/                  ← TOOLS.md, SKILLS-INDEX.md
 *     archive/               ← docs/archive/
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, 'doc-index.json');
const WORKSPACE = process.cwd();

// 21维向量维度
const DIM = 21;

// ============================================================
// 缓存层
// ============================================================
let _cache = null;

/**
 * 预热：扫描文件系统 + 加载静态索引元数据
 * 每次启动调用一次，后续所有操作走缓存
 */
function warmUp() {
    const staticIndex = loadStaticIndex();
    const scannedFiles = scanWorkspace();
    
    // 融合：扫描结果 + 静态元数据
    _cache = {
        docs: mergeIndex(staticIndex, scannedFiles),
        version: staticIndex.version,
        last_updated: new Date().toISOString(),
        scannedAt: new Date().toISOString()
    };
    
    console.log('[doc-loader] 预热完成', {
        totalDocs: _cache.docs.length,
        version: _cache.version,
        scannedAt: _cache.scannedAt
    });
    
    return _cache;
}

/**
 * 加载静态索引（提供向量和关键词元数据）
 */
function loadStaticIndex() {
    try {
        const content = fs.readFileSync(INDEX_PATH, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.warn('[doc-loader] 静态索引加载失败:', e.message);
        return { categories: {}, version: 'unknown' };
    }
}

/**
 * 扫描工作区，建立实际文件路径映射
 * 返回 { relativePath: fullPath } map
 */
function scanWorkspace() {
    const files = {};
    
    // 需要扫描的根目录和子目录
    const scanRoots = [
        { dir: WORKSPACE, prefix: '' },
        { dir: path.join(WORKSPACE, 'docs'), prefix: 'docs/' },
        { dir: path.join(WORKSPACE, 'docs', '意识层'), prefix: 'docs/意识层/' },
        { dir: path.join(WORKSPACE, 'docs', '心智层'), prefix: 'docs/心智层/' },
        { dir: path.join(WORKSPACE, 'docs', '思维模式层'), prefix: 'docs/思维模式层/' },
        { dir: path.join(WORKSPACE, 'docs', '思维模式层', '6模型'), prefix: 'docs/思维模式层/6模型/' },
        { dir: path.join(WORKSPACE, 'docs', '规则层'), prefix: 'docs/规则层/' },
        { dir: path.join(WORKSPACE, 'docs', '规则层', 'safety'), prefix: 'docs/规则层/safety/' },
        { dir: path.join(WORKSPACE, 'docs', '项目层'), prefix: 'docs/项目层/' },
        { dir: path.join(WORKSPACE, 'docs', '项目层', '项目档案'), prefix: 'docs/项目层/项目档案/' },
        { dir: path.join(WORKSPACE, 'docs', '项目层', '规则'), prefix: 'docs/项目层/规则/' },
        { dir: path.join(WORKSPACE, 'docs', '元认知'), prefix: 'docs/元认知/' },
        { dir: path.join(WORKSPACE, 'docs', 'archive'), prefix: 'docs/archive/' },
        { dir: path.join(WORKSPACE, 'Cognition'), prefix: 'Cognition/' },
        { dir: path.join(WORKSPACE, 'Cognition', '世界观'), prefix: 'Cognition/世界观/' },
        { dir: path.join(WORKSPACE, 'Cognition', '人生观'), prefix: 'Cognition/人生观/' },
        { dir: path.join(WORKSPACE, 'Cognition', '价值观'), prefix: 'Cognition/价值观/' },
        { dir: path.join(WORKSPACE, 'Cognition', '协作观'), prefix: 'Cognition/协作观/' },
        { dir: path.join(WORKSPACE, 'Cognition', '行业观'), prefix: 'Cognition/行业观/' },
        { dir: path.join(WORKSPACE, 'Cognition', '元认知'), prefix: 'Cognition/元认知/' },
    ];
    
    // 忽略的文件/目录
    const ignore = new Set([
        'node_modules', '.git', '.DS_Store', 'Thumbs.db',
        'package.json', 'package-lock.json',
        '.openclaw', 'memory', '.claude'
    ]);
    
    function scanDir(dir, prefix) {
        if (!fs.existsSync(dir)) return;
        
        try {
            fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
                if (ignore.has(entry.name)) return;
                
                const relPath = prefix + entry.name;
                
                if (entry.isDirectory()) {
                    scanDir(path.join(dir, entry.name), relPath + '/');
                } else if (entry.isFile()) {
                    // 只处理 md, js, json 文件
                    if (/\.(md|js|json)$/.test(entry.name)) {
                        files[relPath] = path.join(dir, entry.name);
                    }
                }
            });
        } catch (e) {
            // 忽略权限错误
        }
    }
    
    scanRoots.forEach(({ dir, prefix }) => scanDir(dir, prefix));
    
    return files;
}

/**
 * 融合静态索引元数据和扫描结果
 */
function mergeIndex(staticIndex, scannedFiles) {
    const docs = [];
    
    // 从静态索引提取所有 doc 条目
    function extractDocs(node, categoryPath = '') {
        if (!node) return;
        
        // 处理 docs 数组
        if (node.docs && Array.isArray(node.docs)) {
            node.docs.forEach(doc => {
                const fullPath = path.join(WORKSPACE, doc.path);
                
                // 检查文件是否存在
                const exists = scannedFiles[doc.path] || fs.existsSync(fullPath);
                
                docs.push({
                    id: doc.id,
                    path: doc.path,
                    fullPath: fullPath,
                    exists: exists,
                    categoryPath: categoryPath,
                    _vector: doc._vector || new Array(DIM).fill(0),
                    _keywords_text: doc._keywords_text || []
                });
            });
        }
        
        // 递归处理 subcategories
        if (node.subcategories) {
            Object.entries(node.subcategories).forEach(([name, sub]) => {
                if (!name.startsWith('_')) {
                    const newPath = categoryPath ? `${categoryPath}/${name}` : name;
                    extractDocs(sub, newPath);
                }
            });
        }
    }
    
    if (staticIndex.categories) {
        Object.entries(staticIndex.categories).forEach(([name, cat]) => {
            if (!name.startsWith('_')) {
                extractDocs(cat, name);
            }
        });
    }
    
    // 检查扫描到的文件是否在索引中，不在的话添加（默认向量）
    const indexedPaths = new Set(docs.map(d => d.path));
    Object.entries(scannedFiles).forEach(([relPath, fullPath]) => {
        if (!indexedPaths.has(relPath)) {
            // 从路径猜测 categoryPath
            let categoryPath = 'uncategorized';
            if (relPath.startsWith('docs/')) categoryPath = 'docs';
            if (relPath.startsWith('Cognition/')) categoryPath = 'cognition';
            
            docs.push({
                id: path.basename(relPath, path.extname(relPath)),
                path: relPath,
                fullPath: fullPath,
                exists: true,
                categoryPath: categoryPath,
                _vector: new Array(DIM).fill(0),
                _keywords_text: [],
                _autoAdded: true
            });
        }
    });
    
    return docs;
}

// ============================================================
// 公开接口
// ============================================================

/**
 * ===== Loop1 接口 =====
 * 查询文档目录（摘要）
 * 
 * @param {string} globPattern - glob模式，如 'rules/execution/*', 'ALL', '*demand*'
 */
function loadForLoop1(globPattern) {
    if (!_cache) warmUp();
    
    const matchedDocs = findDocs(globPattern || 'ALL');
    
    // 按 categoryPath 分组
    const byCategory = {};
    for (const doc of matchedDocs) {
        const cat = doc.categoryPath || 'root';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({
            id: doc.id,
            path: doc.path,
            summary: doc._keywords_text ? doc._keywords_text.join(', ') : '',
            exists: doc.exists
        });
    }
    
    return {
        format: 'loop1',
        version: _cache.version,
        timestamp: new Date().toISOString(),
        query: globPattern,
        matched_count: matchedDocs.length,
        categories_count: Object.keys(byCategory).length,
        byCategory: byCategory,
        docs: matchedDocs.map(doc => ({
            id: doc.id,
            path: doc.path,
            categoryPath: doc.categoryPath,
            summary: doc._keywords_text ? doc._keywords_text.join(', ') : '',
            vector: doc._vector || new Array(DIM).fill(0),
            exists: doc.exists,
            _debug_keywords: doc._keywords_text
        }))
    };
}

/**
 * 辅助：按glob模式查找文档
 */
function findDocs(pattern) {
    if (!_cache) warmUp();
    
    if (pattern === 'ALL' || !pattern) {
        return _cache.docs.filter(d => d.exists);
    }
    
    // 解析 glob 模式
    const normalized = pattern.replace(/\//g, '/');
    
    // 支持 * 匹配
    if (pattern.includes('*')) {
        const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '[^/]*').replace(/\?/g, '.') + '$'
        );
        return _cache.docs.filter(d => {
            const matchPath = d.categoryPath + '/' + d.id;
            return regex.test(matchPath) && d.exists;
        });
    }
    
    // 精确匹配 categoryPath
    return _cache.docs.filter(d => {
        return d.categoryPath === pattern && d.exists;
    });
}

/**
 * ===== Loop2 接口 =====
 * 按ID加载完整文档原文
 * 
 * @param {string|Array} docIds - 单个ID或ID数组
 */
function loadForLoop2(docIds) {
    if (!_cache) warmUp();
    
    const ids = Array.isArray(docIds) ? docIds : [docIds];
    const results = [];
    const errors = [];
    
    for (const id of ids) {
        const doc = _cache.docs.find(d => d.id === id);
        if (!doc) {
            errors.push({ id, error: '文档ID不存在' });
            continue;
        }
        
        if (!doc.exists) {
            errors.push({ id, path: doc.path, error: '文件不存在' });
            continue;
        }
        
        try {
            const content = fs.readFileSync(doc.fullPath, 'utf8');
            results.push({
                id: doc.id,
                path: doc.path,
                categoryPath: doc.categoryPath,
                content: content,
                summary: doc._keywords_text ? doc._keywords_text.join(', ') : ''
            });
        } catch (e) {
            errors.push({ id, path: doc.path, error: `读取失败: ${e.message}` });
        }
    }
    
    return {
        format: 'loop2',
        timestamp: new Date().toISOString(),
        loaded_count: results.length,
        error_count: errors.length,
        docs: results,
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * 辅助：按类别加载全部文档
 */
function loadCategory(category) {
    return loadForLoop1(category + '/*');
}

/**
 * 辅助：关键词搜索
 */
function searchByKeyword(keyword) {
    return loadForLoop1('*' + keyword + '*');
}

/**
 * 获取索引结构概览
 */
function getIndexOverview() {
    if (!_cache) warmUp();
    
    const cats = {};
    for (const doc of _cache.docs) {
        if (!cats[doc.categoryPath]) {
            cats[doc.categoryPath] = { count: 0, exists: 0 };
        }
        cats[doc.categoryPath].count++;
        if (doc.exists) cats[doc.categoryPath].exists++;
    }
    
    return {
        format: 'overview',
        version: _cache.version,
        last_updated: _cache.last_updated,
        scannedAt: _cache.scannedAt,
        total_docs: _cache.docs.length,
        categories: cats
    };
}

/**
 * 获取单文档向量
 */
function getDocVector(docId) {
    if (!_cache) warmUp();
    const doc = _cache.docs.find(d => d.id === docId);
    return doc ? doc._vector : null;
}

/**
 * 融合多个文档向量（OR逻辑）
 */
function fuseVectors(docIds) {
    if (!_cache) warmUp();
    const fused = new Array(DIM).fill(0);
    
    for (const id of docIds) {
        const vec = getDocVector(id);
        if (vec) {
            for (let i = 0; i < DIM; i++) {
                fused[i] = fused[i] || vec[i];
            }
        }
    }
    
    return fused;
}

/**
 * 获取所有文档的扁平向量列表
 */
function getAllDocVectors() {
    if (!_cache) warmUp();
    return _cache.docs
        .filter(d => d.exists)
        .map(doc => ({
            id: doc.id,
            path: doc.path,
            categoryPath: doc.categoryPath,
            vector: doc._vector || new Array(DIM).fill(0)
        }));
}

/**
 * 检查索引与文件系统是否一致
 */
function checkConsistency() {
    if (!_cache) warmUp();
    
    const issues = [];
    
    for (const doc of _cache.docs) {
        if (!doc.exists) {
            issues.push({ type: 'missing', id: doc.id, path: doc.path });
        }
    }
    
    // 检查自动添加的文件
    const autoAdded = _cache.docs.filter(d => d._autoAdded);
    
    return {
        total: _cache.docs.length,
        indexed: _cache.docs.filter(d => !d._autoAdded).length,
        autoAdded: autoAdded.length,
        missing: issues.length,
        issues: issues,
        autoAddedFiles: autoAdded.map(d => ({ id: d.id, path: d.path }))
    };
}

// 导出
module.exports = {
    loadForLoop1,
    loadForLoop2,
    loadCategory,
    searchByKeyword,
    getIndexOverview,
    findDocs,
    warmUp,
    getDocVector,
    fuseVectors,
    getAllDocVectors,
    checkConsistency
};

// 调试/测试
if (require.main === module) {
    console.log('=== doc-loader v4.0.0 测试 ===\n');
    
    // 预热
    console.log('--- warmUp() ---');
    const cache = warmUp();
    console.log('total docs:', cache.docs.length);
    console.log('');
    
    // 一致性检查
    console.log('--- checkConsistency() ---');
    const check = checkConsistency();
    console.log('indexed:', check.indexed, 'auto-added:', check.autoAdded, 'missing:', check.missing);
    if (check.autoAddedFiles.length) {
        console.log('自动添加的文件:');
        check.autoAddedFiles.forEach(f => console.log('  +', f.id, f.path));
    }
    if (check.issues.length) {
        console.log('缺失的文件:');
        check.issues.forEach(f => console.log('  -', f.id, f.path));
    }
    console.log('');
    
    // Loop1 测试
    console.log('--- loadForLoop1("identity/*") ---');
    const id = loadForLoop1('identity/*');
    console.log('matched:', id.matched_count);
    id.docs.forEach(d => console.log(' ', d.id, d.exists ? '✓' : '✗'));
    console.log('');
    
    console.log('--- loadForLoop1("rules/execution/*") ---');
    const re = loadForLoop1('rules/execution/*');
    console.log('matched:', re.matched_count);
    re.docs.forEach(d => console.log(' ', d.id, d.exists ? '✓' : '✗'));
    console.log('');
    
    console.log('--- loadForLoop1("mind/驱动器/*") ---');
    const md = loadForLoop1('mind/驱动器/*');
    console.log('matched:', md.matched_count);
    md.docs.forEach(d => console.log(' ', d.id, d.exists ? '✓' : '✗'));
    console.log('');
    
    console.log('--- loadForLoop1("consciousness/6模型/*") ---');
    const m6 = loadForLoop1('consciousness/6模型/*');
    console.log('matched:', m6.matched_count);
    m6.docs.forEach(d => console.log(' ', d.id, d.exists ? '✓' : '✗'));
    console.log('');
    
    console.log('--- loadForLoop1("projects/项目档案/*") ---');
    const pp = loadForLoop1('projects/项目档案/*');
    console.log('matched:', pp.matched_count);
    pp.docs.forEach(d => console.log(' ', d.id, d.exists ? '✓' : '✗'));
    console.log('');
    
    // Loop2 测试
    console.log('--- loadForLoop2(["SOUL_md", "PRIMARY_md", "AGENTS_md"]) ---');
    const loop2 = loadForLoop2(['SOUL_md', 'PRIMARY_md', 'AGENTS_md']);
    console.log('loaded:', loop2.loaded_count, 'errors:', loop2.error_count);
    loop2.docs.forEach(d => console.log(' ', d.id, 'len:', d.content.length));
    console.log('');
    
    // 向量融合测试
    console.log('--- fuseVectors(["SOUL_md", "USER_md"]) ---');
    const fused = fuseVectors(['SOUL_md', 'USER_md']);
    const dims = fused.reduce((acc, v, i) => { if (v) acc.push(i); return acc; }, []);
    console.log('active dims:', dims);
}
