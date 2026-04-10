# code-manager - 代码管理触发词执行器

**技能作者:** 虾哥
**当前版本:** 1.0.0
**更新日期:** 2026-03-27
**落地状态:** Live

---

## 🎯 功能描述

代码管理触发词的**代码执行层**。CODE_RULES.md 中定义的触发词，对应真实可执行的 Node.js 函数，代码审查不再是"自觉遵守"，而是 preCommitCheck 强制执行。

执行器：`skills/code-manager/executor.js`
审查器：`skills/code-manager/preCommitCheck.js`

---

## 🔄 触发词映射表

### 查询类

| 触发词 | 执行函数 | 说明 |
|--------|----------|------|
| 「跑一下」 | `executor.runFull()` | 运行完整代码 |
| 「跑XX环节」 | `executor.runPartial()` | 定位并运行指定函数 |
| 「测下语法」 | `executor.syntax()` | 执行 `node -c` 语法检查 |
| 「跑示例」 | `executor.example()` | 跑 SKILL.md 里的 bash 示例 |

### 修改类

| 触发词 | 执行函数 | 说明 |
|--------|----------|------|
| 「改一下XX的逻辑」 | `executor.pr()` | 创建待处理变更记录 |
| 「同意，生效」 | `executor.execCommit()` | 执行变更 + git commit |

---

## 📋 preCommitCheck 检查项（5项）

每次 `git commit` 前必须通过：

| # | 检查项 | 规则 | 不通过处理 |
|---|--------|------|----------|
| 1 | 语法检查 | `node -c` 无报错 | 拒绝 commit |
| 2 | 调试代码 | 无 `console.log`/`debugger`（行首/行尾有 `//` 除外） | 拒绝 commit |
| 3 | 敏感信息 | 无明文 API key / token / password | 拒绝 commit |
| 4 | 函数注释 | 主要函数有 `// 注释` 或 `/** */` | ⚠️ 警告（不阻断） |
| 5 | 变更范围 | 单次变更建议 ≤200 行新增 | ⚠️ 警告（不阻断） |

---

## 📐 executor 返回格式

```javascript
// syntax / run-full / run-partial
{ success: true|false, output: "...", error: "...", stderr: "..." }

// pr
{ success: true, id: 1774621111267, file: "pr-xxx.json", message: "..." }

// exec-commit
{ success: true, file: "xxx.js", commitMessage: "feat: ...", hash: "abc123" }
```

---

## 🔗 与 CODE_RULES.md 的对应关系

| CODE_RULES 条款 | 落地函数 | 状态 |
|----------------|----------|------|
| 7.「跑一下」 | `runFull()` | **Live** |
| 7.「跑XX环节」 | `runPartial()` | **Live** |
| 7.「测下语法」 | `syntax()` | **Live** |
| 7.「跑示例」 | `example()` | **Live** |
| 7.「同意，生效」 | `execCommit()` | **Live** |
| 4.2 测试要求 | `preCommitCheck()` | **Live** |

---

*最后更新：2026-03-27*
