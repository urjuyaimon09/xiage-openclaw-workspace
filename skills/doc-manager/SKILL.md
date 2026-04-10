# doc-manager - 文档管理触发词执行器

**技能作者:** 虾哥
**当前版本:** 1.0.0
**更新日期:** 2026-03-27
**落地状态:** Live

---

## 🎯 功能描述

文档管理触发词的**代码执行层**。DOC_RULES.md 中定义的触发词，对应真实可执行的 Node.js 函数，文档不再是"自觉遵守"，而是代码强制执行。

执行器：`skills/doc-manager/executor.js`

---

## 🔄 触发词映射表

### 查询类

| 触发词 | 执行函数 | 说明 |
|--------|----------|------|
| 「看XX文档」 | `query(docName, level=partial)` | 展示一级+二级目录 |
| 「看X.Y」 | `query(docName, level=X.Y)` | 展开对应二级的三级明细 |
| 「看X.Y.Z」 | `query(docName, level=X.Y.Z)` | 给出该条款的具体内容 |
| 「看整个文档」 | `query(docName, level=full)` | 展示全部内容 |

### 修改类

| 触发词 | 执行函数 | 说明 |
|--------|----------|------|
| 「要改XX文档」 | `todo(docName, content)` | 写待办到当日 memory |
| 「同意变更并升级版本」 | `beforeWrite.js` | 执行检查+存档+写入+版本+1+历史追加（write/edit 通用） |
| 版本历史追加 | `append-vh(file, version, date, level, change, author)` | 自动追加版本历史行 |

### 维护类

| 触发词 | 执行函数 | 说明 |
|--------|----------|------|
| 每年3/9月清理 | `cleanup` | 删除旧版本，只保留各主版本最新次版本 |

---

## 📋 使用说明

### CLI 调用方式

```bash
node skills/doc-manager/executor.js <command> [args...]

# 示例
node skills/doc-manager/executor.js query DOC_RULES.md partial
node skills/doc-manager/executor.js query DOC_RULES.md 3.1
node skills/doc-manager/executor.js query DOC_RULES.md 3.1.2
node skills/doc-manager/executor.js query DOC_RULES.md full
node skills/doc-manager/executor.js todo DOC_RULES.md "修订触发词表"
node skills/doc-manager/executor.js append-vh DOC_RULES.md v1.0.8 2026-03-27 二级 "新增XX规则" "虾哥"
node skills/doc-manager/executor.js cleanup
```

### 调用层级说明

```
触发词 → doc-manager.executor.js → 底层 fs/path 操作
                    ↓
            DOC_RULES.md 落地状态标注
                    ↓
            我（虾哥）调用 read/edit 工具完成实际 IO
```

> 注意：executor.js 负责**解析和逻辑**，实际的 read/edit 文件 IO 仍由我（虾哥）通过工具执行。executor.js 输出结构化结果，告诉我下一步该读什么、该写什么。

---

## 📐 query 返回格式

```javascript
// level=partial（一级+二级目录）
{ type: 'partial', docName: 'DOC_RULES.md', headers: ['# 标题', '## 一、总则', ...] }

// level=X.Y（展开某二级下的三级）
{ type: 'sub', docName: 'DOC_RULES.md', level: '3.2',
  items: [{ line: '### 3.2.1 xxx', index: 123, lines: [...] }] }

// level=X.Y.Z（只读某三级条款）
{ type: 'item', docName: 'DOC_RULES.md', level: '3.2.1',
  lines: ['### 3.2.1 xxx', '...', '...'], start: 123, end: 145 }

// level=full（全文）
{ type: 'full', docName: 'DOC_RULES.md', content: '...' }
```

---

## 🔗 与 DOC_RULES.md 的对应关系

| DOC_RULES 条款 | 落地函数 | 状态 |
|----------------|----------|------|
| 4.2.1 查询触发词 | `query()` | **Live** |
| 4.2.2 「要改XX文档」 | `todo()` | **Live** |
| 4.2.2 「同意变更并升级版本」 | `beforeWrite.js` | **Live** |
| 3.3 版本历史附入规则 | `append-vh()` | **Live** |
| 5.3 过期清理 | `cleanup()` | **Live** |

---

## 📌 设计原则

1. **文档是契约，代码是执行** — 文档写的触发词效果，由 executor.js 保证实现
2. **无验证不落地** — executor.js 跑不通，触发词效果就无法保证
3. **简单优先** — 复杂的文档解析（如三级条款边界判断）由 executor.js 处理，结果结构化输出给我

---

*最后更新：2026-03-27*
