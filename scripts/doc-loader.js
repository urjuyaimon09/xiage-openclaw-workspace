/**
 * doc-loader.js v3.0.0
 * 层级文档加载器 - 适配 Agent Loop 两层架构
 * 
 * v3.0.0 重大升级：keywords升级为定长二进制向量
 * - 21维全局概念向量，固定维度
 * - Loop1只加载向量，零文本token，极致压缩
 * - 原文本keywords保留在 _keywords_text 字段（仅用于调试/展示）
 * 
 * 设计理念：
 * - Loop1 = 帧级感知：给定输入上下文，返回需要加载的文档目录（快，只读索引）
 * - Loop2 = 按需读取：给定文档ID，返回完整原文
 * 
 * 层级索引结构（nested）：
 *   categories/
 *     identity/
 *     rules/
 *       execution/
 *       memory/
 *       code/
 *     business/
 *       models/
 *       demands/
 *     cognition/
 *     meta/
 * 
 * Glob 模式示例：
 *   loadForLoop1('identity/*')           → identity/下所有文档
 *   loadForLoop1('rules/execution/*')    → rules/execution/下所有
 *   loadForLoop1('business/models/*')    → 业务模型类
 *   loadForLoop1('ALL')                 → 全部
 *   loadForLoop1('*demand*')             → 关键词匹配
 * 
 * 使用：
 *   const loader = require('./scripts/doc-loader.js');
 *   
 *   // Loop1: 查询文档目录（摘要）
 *   loader.loadForLoop1('rules/execution/*')
 *   
 *   // Loop2: 按ID加载原文
 *   loader.loadForLoop2('SOUL_md')
 *   loader.loadForLoop2(['SOUL_md', 'USER_md'])
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'docs', 'doc-index.json');

/**
 * 加载索引
 */
function loadIndex() {
    try {
        const content = fs.readFileSync(INDEX_PATH, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        throw new Error(`索引加载失败: ${INDEX_PATH} - ${e.message}`);
    }
}

/**
 * 扁平化所有文档（提取所有doc条目）
 * @param {Object} categoriesObj - categories 对象的顶层引用
 * @param {string} basePath - 基础路径
 */
function flattenDocs(categoriesObj, basePath = '') {
    const docs = [];
    
    // categoriesObj 是 { identity: {...}, rules: {...}, ... } 这样的结构
    for (const [catName, catNode] of Object.entries(categoriesObj)) {
        // 跳过元字段（如 _type, _path）
        if (catName.startsWith('_')) continue;
        
        const catPath = basePath ? `${basePath}/${catName}` : catName;
        
        // 如果有 subcategories，递归展开
        if (catNode.subcategories) {
            for (const [subName, subNode] of Object.entries(catNode.subcategories)) {
                if (subName.startsWith('_')) continue;
                const subPath = `${catPath}/${subName}`;
                
                // subNode 可能有 docs
                if (subNode.docs && Array.isArray(subNode.docs)) {
                    for (const doc of subNode.docs) {
                        docs.push({
                            ...doc,
                            categoryPath: subPath
                        });
                    }
                }
            }
        }
        
        // 如果当前节点有 docs（直接在 category 下）
        if (catNode.docs && Array.isArray(catNode.docs)) {
            for (const doc of catNode.docs) {
                docs.push({
                    ...doc,
                    categoryPath: catPath
                });
            }
        }
    }
    
    return docs;
}

/**
 * Glob 模式匹配
 * 支持:
 *   *       - 单层任意字符
 *   DEEP/*    - 任意深层
 *   path/*  - 指定路径下所有
 */
function globMatch(pattern, target) {
    if (pattern === 'ALL' || pattern === '**/*' || pattern === '*') {
        return true;
    }
    
    // 脱掉 **/ 处理
    const cleanPattern = pattern
        .replace(/\*\*/g, '')
        .replace(/\//g, '\\/');
    
    // 处理末尾的 /*
    const normalizedPattern = cleanPattern
        .replace(/\/\*/g, '/.*')
        .replace(/\*/g, '[^/]*');
    
    const regex = new RegExp('^' + normalizedPattern + '$', 'i');
    return regex.test(target);
}

/**
 * 从 categoryPath 匹配 docs
 * 例如 'rules/execution/*' 匹配 categoryPath 包含 'rules/execution' 的文档
 */
function categoryPathMatch(pattern, categoryPath) {
    if (pattern === 'ALL' || pattern === '**/*' || pattern === '*') return true;
    
    // 脱掉末尾的 /*
    const prefixPattern = pattern.replace(/\/\*$/, '');
    
    // 如果 pattern 有路径前缀
    if (prefixPattern.includes('/')) {
        return categoryPath.startsWith(prefixPattern);
    }
    
    // 单层匹配（如 'identity' 匹配 'identity'）
    const topLevel = categoryPath.split('/')[0];
    return topLevel === prefixPattern || globMatch(pattern, categoryPath);
}

/**
 * 查找匹配的文档
 */
function findDocs(globPattern) {
    const index = loadIndex();
    const allDocs = flattenDocs(index.categories);
    
    // ALL 匹配全部
    if (globPattern === 'ALL') {
        return allDocs;
    }
    
    // 纯关键词搜索（没有/）→ 用 _keywords_text 匹配（仅调试展示）
    if (!globPattern.includes('/')) {
        const keyword = globPattern.replace(/\*/g, '').toLowerCase();
        if (keyword) {
            return allDocs.filter(doc => {
                if (doc._keywords_text) {
                    return doc._keywords_text.some(kw => 
                        kw.toLowerCase().includes(keyword)
                    );
                }
                return doc.id.toLowerCase().includes(keyword);
            });
        }
        return [];
    }
    
    // 路径/glob 匹配
    return allDocs.filter(doc => {
        if (categoryPathMatch(globPattern, doc.categoryPath)) return true;
        if (globMatch(globPattern, doc.id)) return true;
        return false;
    });
}

/**
 * ===== Loop1 接口 =====
 * 加载匹配的文档摘要目录（快，只读索引）
 * 
 * @param {string} globPattern - glob 模式
 *   'identity/*'        → identity/下所有
 *   'rules/*'          → rules/下所有  
 *   'business/models/*' → 业务模型
 *   'ALL'             → 全部
 *   '*demand*'         → 关键词匹配
 * 
 * @returns {Object} Loop1 格式输出
 */
function loadForLoop1(globPattern) {
    const matchedDocs = findDocs(globPattern || 'ALL');
    
    // 按 categoryPath 分组
    const byCategory = {};
    for (const doc of matchedDocs) {
        const cat = doc.categoryPath || 'root';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({
            id: doc.id,
            path: doc.path,
            summary: doc.loop1 ? doc.loop1.summary : '',
            keywords: doc.loop1 ? doc.loop1.keywords : []
        });
    }
    
    return {
        format: 'loop1',
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        query: globPattern,
        matched_count: matchedDocs.length,
        categories_count: Object.keys(byCategory).length,
        byCategory: byCategory,
        // 扁平列表
        docs: matchedDocs.map(doc => ({
            id: doc.id,
            path: doc.path,
            categoryPath: doc.categoryPath,
            summary: doc.loop1 ? doc.loop1.summary : '',
            // v3.0.0: 返回二进制向量，零文本token
            vector: doc._vector || new Array(21).fill(0),
            // _keywords_text 仅调试用，不用于token计算
            _debug_keywords: doc._keywords_text
        }))
    };
}

/**
 * ===== Loop2 接口 =====
 * 按ID加载完整文档原文（按需读取）
 * 
 * @param {string|Array} docIds - 单个ID或ID数组
 * @returns {Object} Loop2 格式输出
 */
function loadForLoop2(docIds) {
    const index = loadIndex();
    const allDocs = flattenDocs(index.categories || index);
    const ids = Array.isArray(docIds) ? docIds : [docIds];
    
    const results = [];
    const errors = [];
    
    for (const id of ids) {
        const doc = allDocs.find(d => d.id === id);
        if (!doc) {
            errors.push({ id, error: '文档ID不存在' });
            continue;
        }
        
        const fullPath = path.join(__dirname, '..', doc.path);
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            results.push({
                id: doc.id,
                path: doc.path,
                categoryPath: doc.categoryPath,
                content: content,
                summary: doc.loop1 ? doc.loop1.summary : ''
            });
        } catch (e) {
            errors.push({ id, path: doc.path, error: `文件读取失败: ${e.message}` });
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
 * 辅助：按类别加载全部文档目录
 * @param {string} category - categories 下的直接子类（如 'identity', 'rules'）
 */
function loadCategory(category) {
    return loadForLoop1(category + '/*');
}

/**
 * 辅助：搜索含有关键词的文档
 */
function searchByKeyword(keyword) {
    return loadForLoop1('*' + keyword + '*');
}

/**
 * 辅助：获取索引结构概览（不含详情）
 */
function getIndexOverview() {
    const index = loadIndex();
    
    function extractStructure(node, path = '') {
        if (node._type === 'category' || node._type === 'subcategory') {
            const result = { _type: node._type, path: path };
            if (node.subcategories) {
                result.subcategories = {};
                for (const [name, sub] of Object.entries(node.subcategories)) {
                    if (!name.startsWith('_')) {
                        result.subcategories[name] = extractStructure(sub, path ? `${path}/${name}` : name);
                    }
                }
            }
            if (node.docs) {
                result.doc_count = node.docs.length;
            }
            return result;
        }
        return { doc_count: 1 };
    }
    
    const overview = {};
    for (const [name, cat] of Object.entries(index.categories || {})) {
        if (!name.startsWith('_')) {
            overview[name] = extractStructure(cat, name);
        }
    }
    
    return {
        format: 'overview',
        version: index.version,
        last_updated: index.last_updated,
        structure: overview
    };
}

// ===== 缓存层 =====
let _cache = null;

/**
 * 预热：加载索引到内存缓存
 * 启动时调用一次，后续所有操作走缓存
 */
function warmUp() {
    _cache = {
        index: loadIndex(),
        allDocs: flattenDocs(loadIndex().categories),
        loadedAt: new Date().toISOString()
    };
    console.log('[doc-loader] 缓存预热完成 at', _cache.loadedAt);
    return _cache;
}

/**
 * 获取单文档向量
 */
function getDocVector(docId) {
    if (!_cache) warmUp();
    const doc = _cache.allDocs.find(d => d.id === docId);
    return doc ? doc._vector : null;
}

/**
 * 融合多个文档向量（OR逻辑）
 * 用于生成场景指纹
 */
function fuseVectors(docIds) {
    if (!_cache) warmUp();
    const DIM = 21;
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
 * 获取所有文档的扁平向量列表（用于模型推理输入）
 */
function getAllDocVectors() {
    if (!_cache) warmUp();
    return _cache.allDocs.map(doc => ({
        id: doc.id,
        path: doc.path,
        categoryPath: doc.categoryPath,
        vector: doc._vector || new Array(21).fill(0)
    }));
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
    getAllDocVectors
};

// 调试/测试
if (require.main === module) {
    console.log('=== doc-loader v3.0.0 测试 ===\n');
    
    // Test 1: 索引概览
    console.log('--- getIndexOverview() ---');
    const overview = getIndexOverview();
    console.log(`version: ${overview.version}, last_updated: ${overview.last_updated}`);
    console.log('structure keys:', Object.keys(overview.structure));
    console.log('');
    
    // Test 2: 按类别加载 - identity
    console.log('--- loadForLoop1("identity/*") ---');
    const identity = loadForLoop1('identity/*');
    console.log(`matched: ${identity.matched_count}`);
    const soulDoc = identity.docs.find(d => d.id === 'SOUL_md');
    if (soulDoc) {
        console.log('SOUL_md vector:', soulDoc.vector);
        console.log('SOUL_md _debug_keywords:', soulDoc._debug_keywords);
    }
    console.log('');
    
    // Test 3: 按路径加载 - rules/execution
    console.log('--- loadForLoop1("rules/execution/*") ---');
    const rules = loadForLoop1('rules/execution/*');
    console.log(`matched: ${rules.matched_count}`);
    console.log('docs:', rules.docs.map(d => d.id));
    console.log('');
    
    // Test 4: 业务模型
    console.log('--- loadForLoop1("business/models/*") ---');
    const models = loadForLoop1('business/models/*');
    console.log(`matched: ${models.matched_count}`);
    console.log('docs:', models.docs.map(d => d.id));
    console.log('');
    
    // Test 5: 关键词搜索（调试用）
    console.log('--- searchByKeyword("需求") ---');
    const kw = searchByKeyword('需求');
    console.log(`matched: ${kw.matched_count}`);
    console.log('docs:', kw.docs.map(d => d.id));
    console.log('');
    
    // Test 6: Loop2 加载原文
    console.log('--- loadForLoop2("SOUL_md") ---');
    const loop2 = loadForLoop2('SOUL_md');
    console.log(`loaded: ${loop2.loaded_count}`);
    console.log(`content length: ${loop2.docs[0]?.content.length}`);
    console.log('');
    
    // Test 7: 全部
    console.log('--- loadForLoop1(ALL) ---');
    const all = loadForLoop1('ALL');
    console.log(`total matched: ${all.matched_count}`);
    console.log('total vector tokens (21 dims x N docs):', all.matched_count * 21);
    console.log('vs old text tokens: 显著减少');
    console.log('');
    
    // Test 8: warmUp + getDocVector
    console.log('--- warmUp() + getDocVector() ---');
    warmUp();
    const soulVec = getDocVector('SOUL_md');
    console.log('SOUL_md vector:', soulVec);
    console.log('');
    
    // Test 9: fuseVectors
    console.log('--- fuseVectors([SOUL_md, USER_md]) ---');
    const fused = fuseVectors(['SOUL_md', 'USER_md']);
    console.log('fused vector:', fused);
    console.log('active dims:', fused.reduce((acc, v, i) => { if(v) acc.push(i); return acc; }, []));
    console.log('');
    
    // Test 10: getAllDocVectors
    console.log('--- getAllDocVectors() ---');
    const allVecs = getAllDocVectors();
    console.log(`total docs: ${allVecs.length}`);
    console.log('all vectors sum check:', allVecs.reduce((acc, d) => acc + d.vector.reduce((a,b) => a+b, 0), 0), 'ones');
}
