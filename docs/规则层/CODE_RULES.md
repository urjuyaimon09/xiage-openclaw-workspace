落地：Live（code-manager executor 已建立并通过 git 验证）
当前版本：v1.4.5
最后更新：2026-04-05

---

# CODE_RULES - 代码管理规则

本文档定义所有新建和修改代码的管理规则，所有代码修改都必须遵守本文档。
本文档遵循 DOC_RULES.md 的所有规则（修改必须坚果确认并回复「同意变更并升级版本」）。

---

## 第一部分：审核存档流程

---

### 第一章：总则

#### 1.1 目的

为代码建立系统化的管理机制：**审核存档流程** + **代码规范内涵**，确保代码可审查、可回滚、可追溯，且每条触发词都对应真实的执行函数。

#### 1.2 协作逻辑

**文档定规则 → 按规则执行 → 按规则演进**，CODE_RULES 是代码修改的最高约定，所有执行必须对齐本文档。

#### 1.3 落地执行状态

| 执行状态 | 含义 | 标注格式 |
|----------|------|----------|
| **Live** | 代码已写死，严格执行 | `落地：Live` |
| **Rule** | 文档约束，自觉执行，待代码验证 | `落地：Rule` |
| **Pending** | 方案确认，待 code-manager skill 落地 | `落地：Pending → {函数}` |
| **Reference** | 仅供查阅，不主动执行 | `落地：Reference` |

#### 1.4 核心原则

- **坚果主权**：所有核心代码的最终修改权永远在坚果，没有「同意，生效」绝对不能写
- **commit 必审**：每次 commit 前必须跑 preCommitCheck，五项检查全部通过才能提交
- **触发词即契约**：触发词的效果由 code-manager executor 保证实现
- **知错就改**：错了立即回滚，不找借口，不硬扛
- **双层执行规范**：
  - **Prompt 层**（约束）：规则写进文档，告诉模型"应该怎么做"，靠模型自觉执行
  - **代码层**（兜底）：工具脚本实际执行检查，fail-closed，错了就拦截
  - 有代码实现的规则，状态标注 Live；纯文档约束的规则，状态标注 Rule

#### 1.5 触发词管理

#### 1.5.1 代码触发词定义

落地：Rule

本文档定义的触发词（CODE_TRIGGERS）：

| 触发词 | 效果 | 执行函数 |
|--------|------|----------|
| 「跑一下」 | 运行完整代码 | `executor.runFull(file)` |
| 「跑XX环节」 | 定位并运行某个具体函数 | `executor.runPartial(file, fn)` |
| 「测下语法」 | 执行 `node -c` 语法检查 | `executor.syntax(file)` |
| 「跑示例」 | 跑 SKILL.md 里的 bash 示例 | `executor.example(skillDir)` |
| 「改一下XX的逻辑」 | 创建待处理变更记录 | `executor.pr(message)` |
| 「同意，生效」 | preCommitCheck → edit → execCommit | `executor.execCommit(file, desc)` |

#### 1.5.2 新增触发词规则

落地：Rule

新增或变更触发词，必须：
1. 在本文档 1.5.1 触发词表里新增条目（格式：触发词 | 效果 | 执行函数）
2. 说明新增理由和对应的 executor 函数
3. 等坚果「同意变更并升级版本」
4. 同步更新 AGENTS.md 触发词总表

---

#### 1.5.3 中长期优化方向——以 Claude Code 为师

落地：Reference + Evolving

权威参考文档：`docs/core/CLAUDE_CODE_ARCHITECTURE.md`（v0.7，持续研究中）

**方向性共识（坚果 2026-04-05 确认）：**

虾哥引擎探索的是「比 Claude Code 更多高维的自动思考需求并自动实现」。没有代码能力，虾哥的愿景无法落地。Claude Code 源码是虾哥进化的核心学习对象，需要彻底研究。

**学习原则：**
- **原理和功能：不打折扣，全部实现**
- **实现方式：参考 OpenClaw 架构 + 结合自身能力，量力而行**
- **Claude Code 代码优先：代码优先参考 Claude Code 源码；如果 Claude Code 代码和 OpenClaw 不适配，必须提出来讨论，明确落地方案后再执行，不做无效实现**

**改造路线图（坚果 2026-04-05 确认）：**

**阶段一：能力基础（决定上限）**

| 优先级 | 模块 | 目标 | 对应 Claude Code |
|--------|------|------|-----------------|
| P0 | **Tool Orchestration** | Skill 层子 agent 并发（sessions_spawn 模拟分区） | `toolOrchestration.ts` |
| P0 | **工具结果大小控制** | 超限存磁盘，替换为路径引用 | truncateResult.ts |

**阶段二：记忆与压缩（已有积累）**

| 优先级 | 模块 | 目标 | 对应 Claude Code |
|--------|------|------|-----------------|
| P1 | **compact 完善** | fork 子 agent 生成摘要 + PTL 重试 | `compact.ts` |
| P1 | **Session Memory 自动提取** | 三重阈值触发，固定10 section 模板 | `sessionMemory.ts` |
| P1 | **autoDream 跨会话整合** | 多 session 整合为长期记忆 | `autoDream.ts` |

**阶段三：多 agent 与安全**

| 优先级 | 模块 | 目标 | 对应 Claude Code |
|--------|------|------|-----------------|
| P2 | **Sub-agent 机制** | fork 子 agent（共享 prompt cache） | `forkSubagent.ts` |
| P2 | **权限体系** | bypass-immune 安全区 + 渐进拒绝 | `permissions.ts` |
| P2 | **Hook 系统** | 24 种事件分类的钩子机制 | `postSamplingHooks.ts` |

**阶段四：高级能力**

| 优先级 | 模块 | 目标 | 对应 Claude Code |
|--------|------|------|-----------------|
| P3 | **Team Memory Sync** | 多成员记忆同步 + 冲突处理 | `teamMemorySync.ts` |
| P3 | **Skills 生命周期** | forked skill + invokedSkills 保留 | `SkillTool.ts` |
| P3 | **MCP 协议** | 外部工具接入 | `MCPConnectionManager.tsx` |

**当前最需要补的短板（P0）：**

Tool Orchestration（并发控制）— 这个不解决，虾哥没法高效处理多步骤任务，其他所有能力都建立在这个基础上。

---

#### 1.5.4 工具并发设计原则

落地：Rule + 实现路线

**核心目标：** 所有工具调用经过 Orchestrator 层，实现 read-only 并行、write 串行的批次执行。

**Claude Code 参考：** `toolOrchestration.ts` 的 isConcurrencySafe 分区策略。

**并发安全工具定义（read-only，可并行）：**
```
Read / Glob / Grep / WebSearch / WebFetch / Bash(仅读命令)
```

**非并发安全工具（写操作，串行）：**
```
Edit / Write / Bash(写命令) / Move / Delete
```

**Orchestrator 执行流程：**
```
1. 接收工具调用请求列表
2. 按 isConcurrencySafe 分区：
   ├─ 批次A（并发安全）：最多10个并行执行
   └─ 批次B（非并发安全）：逐个串行执行
3. Context modification 队列按顺序应用
4. 批次内单工具失败不中断其他工具
```

**并发安全 Bash 命令白名单（免确认）：**
```
ls / dir / git status / git log / git diff / find / pwd / echo / cat
```

**当前实现状态：** Skill 层验证中（2026-04-05 讨论决定）

> ⚠️ OpenClaw 工具编排黑盒耦合，无独立接口。Plugin/Hook 层无法实现 Claude Code 分区策略。
> 
> **落地路径：** 实现 `parallel-tool-executor` skill，用 `sessions_spawn` 模拟进程级并发。
> - 局限：依赖 LLM 显式调用 Skill，Hook 拦截方案更隐蔽但更脆弱
> - 优势：不改核心代码，升级兼容，可维护

---

### 第二章：代码库范围

#### 2.1 管辖范围

落地：Rule

凡**新建或修改**的以下代码文件，均受本规则约束：

- `skills/*.js`（所有 skill 的入口 JS）
- `skills/*/executor.js`（各 skill 执行器）
- `skills/*/preCommitCheck.js`（各 skill 审查器）
- `skills/supervision-skill/*`（监督 skill 相关代码）
- 根目录自定义工具脚本（`beforeWrite.js`、`xiage-skills.js` 等）
- 任何 `*.js` 配置文件
- `docs/core/*.md`（核心文档）

> 第三方 `node_modules` 内的代码除外。

#### 2.2 代码库位置

`C:\Users\Administrator\.openclaw\workspace\.git`

#### 2.3 架构约束

落地：Rule

代码分层依赖必须遵守单向约束，禁止反向依赖：

```
types/ → config/ → repo/ → service/ → runtime/ → ui/
```

| 违规 | 正确 |
|------|------|
| ui/ 层直接引用 repo/ 层 | 通过 runtime/ 暴露的接口访问 |
| repo/ 层引用 service/ 层 | 使用接口（interface）解耦，依赖注入 |
| 组件直接调数据库 | 通过 service 层访问 |

**违反分层依赖方向 = 架构违规**，preCommitCheck 应能检测并拒绝。

---

### 第三章：变更流程

#### 3.1 变更步骤（强制执行）

1. **发起**：不管是你提需求还是我发现需要同步，先在当日 `memory/YYYY-MM-DD.md` 记好「待同步变更」
2. **方案**：把变更内容和执行方案发给你
3. **确认**：必须等你说「同意，生效」，我才执行代码修改
4. **检查**：收到「同意，生效」后，**先跑 `node -c` 语法检查**，通过后执行 edit
5. **归档**：edit 完成后执行 git commit + git push（代码和规则同步到 GitHub）

#### 3.2 报错规范（三要素）

落地：Rule（文档规范，坚果监督自觉执行）

所有自定义报错必须包含三要素：

```
❌ [什么错了] — 简洁描述问题
✅ FIX: [怎么改，给出代码片段] — 可直接照抄的修复方案
📖 See: [哪个文档有详细说明] — 指向具体文档链接
```

**反面例子**：
```
Error: file not found
```

**正面例子**：
```
❌ 文件 xxx.js 不在保护清单但未走触发词
✅ FIX: 先确认坚果已回复「同意，生效」，再执行 edit
📖 See: CODE_RULES.md 3.1 变更步骤
```

#### 3.3 触发词约定

落地：Live（`code-manager.executor.js` 已实现）

| 触发词 | 效果 | 执行函数 | 状态 |
|--------|------|----------|------|
| 「跑一下」 | 运行完整代码 | `runFull(file)` | Live |
| 「跑XX环节」 | 定位并运行某个具体函数 | `runPartial(file, fnName)` | Live |
| 「测下语法」 | 执行 `node -c` 语法检查 | `syntax(file)` | Live |
| 「跑示例」 | 跑 SKILL.md 里的 bash 示例 | `example(skillDir)` | Live |
| 「改一下XX的逻辑」 | 创建待处理变更记录 | `pr(message)` | Live |
| 「同意，生效」 | preCommitCheck → edit → git commit → git push | `execCommit(file, desc)` | Live |

#### 3.4 执行约束

收到「同意，生效」后、**edit 执行前**，必须先跑对应检查：
- 工具代码：先跑 `preCommitCheck`（`node skills/code-manager/preCommitCheck.js`）
- 检查失败必须停止，不得绕过 edit 先行

**「同意，生效」执行路径（强制）：**
```
1. preCommitCheck 检查（node preCommitCheck.js）
2. 调用 edit 工具执行文件修改
3. 调用 executor.execCommit() 完成 git 提交
   → node skills/code-manager/executor.js exec-commit <文件路径> <变更描述>
   → 自动完成 git add + commit + push
```

---

### 第四章：执行规范

#### 4.1 Git Safety Protocol

落地：Live（prompt 层约束，坚果监督执行）

```
- NEVER update the git config
- NEVER skip hooks (--no-verify, --no-gpg-sign)  除非坚果明确要求
- NEVER use git commit --amend  除非坚果明确要求
- NEVER push --force  除非坚果明确要求
- Do not commit .env / credentials.json 等含 secrets 的文件
- Never use git -i commands (rebase -i, add -i)  因为需要交互输入
```

#### 4.2 Shell 执行安全

落地：Live（beforeCode.js Layer 2 检测）

禁止执行的 shell 危险模式（检测范围：所有 shell 脚本 `.sh/.bash/.zsh/.fish/.ksh`）：

| 危险模式 | 说明 | 检测文件 |
|---------|------|---------|
| `$(...)` | 命令替换，可执行任意命令 | 全部文件 |
| `<()` | 进程替换，可绕过命令白名单 | 全部文件 |
| `` `...` `` | 反引号命令替换，等价于 `$(...)` | 仅 shell 脚本 |
| `zmodload` | Zsh 模块加载，可引入文件读写/网络能力 | 全部文件 |
| `emulate` | Zsh 模拟模式，eval 等价 | 全部文件 |
| `$( ( ... ))` | 嵌套命令替换 | 全部文件 |

#### 4.3 文件尺度规范（from Harness Engineering）

落地：Rule（参照 Harness Engineering）

| 文件类型 | 行数上限 | 超出处理 |
|----------|---------|---------|
| skill 入口 JS（`*.js`） | 300 行 | 拆分为 `utils/` 辅助函数 + 主文件 |
| 脚本工具（`*.js`） | 300 行 | 拆分为子模块 |
| 配置文件（`*.json` 等） | 500 行 | 拆分为多文件或分层配置 |

> 超过 300 行的文件，Agent 理解和修改的出错率显著上升（Harness Engineering 经验数据）。

#### 4.4 自检查机制

落地：Rule（文档规范，部分已有代码实现）

| 检查项 | 阈值 | 不通过 | 实现状态 |
|--------|------|--------|---------|
| 语法检查 | 0 错误 | ❌ 拒绝 | Live（`node -c`） |
| 调试代码 | 0 处 console.log / debugger | ❌ 拒绝 | Live（`preCommitCheck.js` Layer 3） |
| 敏感信息 | 0 处明文 key/token | ❌ 拒绝 | Live（`preCommitCheck.js` Layer 3） |
| Shell 危险 token | 0 处 | ❌ 拒绝 | Live（`beforeCode.js` Layer 2） |
| 文件行数 | ≤ 300 行/文件 | ⚠️ 警告 | Rule |
| 变更范围 | ≤ 200 行/次 | ⚠️ 警告 | Rule |
| 架构依赖方向 | 无反向依赖 | ❌ 拒绝 | Rule |
| 保护清单授权 | 清单内文件需触发词 | ❌ 拒绝 | Live（`beforeCode.js` Layer 1） |

#### 4.5 提交信息规范

落地：Live

| type | 使用场景 |
|------|---------|
| `feat:` | 新增功能 |
| `fix:` | 修复问题 |
| `chore:` | 工具/依赖/配置调整 |
| `refactor:` | 重构（不改变功能） |
| `docs:` | 文档更新 |
| `test:` | 测试相关 |

提交信息应聚焦"为什么"，而非"做了什么"。

#### 4.6 分支管理

落地：Rule

新功能开发流程：
1. `git checkout -b feat/xxx` — 从 main 开新分支
2. 在新分支开发、测试
3. 确认无误后 `git checkout main` 切回主分支
4. `git merge feat/xxx` — 合并到 main

#### 4.7 回滚机制

落地：Rule

改坏了立即回滚，不讨论：
- 回到某个 commit：`git checkout <commit-hash>`
- 撤销最后一次 commit：`git reset --hard HEAD~1`

---

### 第五章：版本与维护

#### 5.1 版本号规则（严格三级）

落地：Rule

遵循 SemVer 语义化版本：
- **Major（第一位）**：代码架构变化 → `1.0.0` → `2.0.0`
- **Minor（第二位）**：新增执行器或重大规则 → `1.0.0` → `1.1.0`
- **Patch（第三位）**：规则修正、细节补充 → `1.0.0` → `1.0.1`

#### 5.2 定时清理规范

落地：Pending（待 cron 任务支持）

| 任务 | 频率 | 动作 |
|------|------|------|
| skills 目录归档 | 每日 | 目录数超过 150 时，自动归档最早 30 个到 `skills-archive/` |
| orphan transcript 归档 | 每日 | session 外不再引用的 `.jsonl` 文件重命名为 `*.deleted.<timestamp>` |
| doc 新鲜度扫描 | 每周 | 扫描 `docs/design/` 中超过 60 天未更新的文档并报告 |

#### 5.3 违规处理

落地：Rule

违反修改拦截规则（未获授权就调用 write/exec）= 严重违规，立即回滚并记录经验教训。

---

## 第二部分：代码规范内涵

---

### 第六章：Claude Code 最佳实践索引

落地：Reference

以下 Claude Code 源码实践可直接参照，无需重复造轮子：

| Claude Code 实践 | 对应本文档章节 | 状态 |
|---|---|---|
| Git Safety Protocol | 4.1 | Live |
| bashSecurity 危险模式 | 4.2 | Live |
| SSRF Guard | 7.2 | Rule |
| Hook Exit Code 语义 | 第八章 | Reference |
| Skill Improvement Hook | 参考 4.4 自检查 | Rule |
| 分层架构约束 | 2.3 | Rule |

---

### 第七章：HTTP 安全规范（from Claude Code ssrfGuard）

#### 7.1 SSRF Guard

落地：Rule

HTTP 请求必须检查目标地址，禁止到达：

| 地址段 | 说明 |
|--------|------|
| `10.0.0.0/8` | 私有网络 |
| `172.16.0.0/12` | 私有网络 |
| `192.168.0.0/16` | 私有网络 |
| `169.254.0.0/16` | 云元数据地址 |
| `100.64.0.0/10` | CGNAT 共享地址 |

允许：loopback（`127.0.0.0/8`）用于本地开发。

---

### 第八章：Hook 事件模型（from Claude Code）

落地：Reference（OpenClaw 可参考实现）

Claude Code 的 Hook 事件模型（可迁移到 OpenClaw 的 beforeCode/beforeWrite 体系）：

| 事件 | 时机 | Exit code 0 | Exit code 2 | 其他 |
|------|------|-------------|-------------|------|
| PreToolUse | 工具执行前 | 正常执行 | 阻断并报给模型 | 仅通知用户 |
| PostToolUse | 工具执行后 | 在 transcript 显示 | 立即显示 stderr 给模型 | 仅通知用户 |
| PostToolUseFailure | 工具失败后 | 在 transcript 显示 | 立即显示 stderr | 仅通知用户 |

**OpenClaw 对照**：
- `beforeCode.js` = PreToolUse
- `beforeWrite.js` = PreToolUse
- `postCommitCheck` = PostToolUse

---

## 版本历史

**当前版本：v1.4.0**

| 版本 | 日期 | 更新层级 | 详细变更 | 更新人 |
|------|------|----------|----------|--------|
| v1.0.0 | 2026-03-24 | 一级 | 初始版本，建立代码修改管理规则 | 虾哥（坚果确认） |
| v1.1.1 | 2026-04-02 | 二级 | 触发词管理升为 Live；3.3 新增执行路径三步 | 虾哥（坚果确认） |
| v1.2.1 | 2026-04-02 | 二级 | commit+push 同步 GitHub；触发词效果列更新 | 虾哥（坚果确认） |
| v1.3.0 | 2026-04-04 | 二级 | 新增第二部分「代码规范内涵」（Claude Code Git安全/Shell安全/SSRF Guard/Hook模型）；新增第一部分：架构约束(2.3)/报错三要素(3.2)/文件尺度(4.3)/自检查(4.4)/定时清理(5.2)；新增1.4核心原则 Claude Code 双层规范 | 虾哥（坚果确认） |
| v1.4.0 | 2026-04-05 | 二级 | 4.1 Git Safety Protocol 升为 Live；4.2 Shell 安全升为 Live（beforeCode.js Layer 2）；4.4 自检查更新实现状态（语法/调试/敏感信息/Shell token/保护清单均已 Live）；1.4 核心原则展开双层执行规范；3.2 报错规范状态更新为 Rule | 虾哥（坚果确认） |
| v1.4.1 | 2026-04-05 | 二级 | 1.5.1/1.5.2 补落地标注；新增 1.5.3「中长期优化方向——以 Claude Code 为师」，明确虾哥进化学习路径和核心模块优先级 | 虾哥（坚果确认） |
| v1.4.2 | 2026-04-05 | 二级 | 1.5.3 升级为「改造路线图」，新增四阶段优先级表格（P0/P1/P2/P3），明确当前最需补短板为 Tool Orchestration | 虾哥（坚果确认） |
| v1.4.3 | 2026-04-05 | 二级 | 新增 1.5.4「工具并发设计原则」，Orchestrator 分区策略、并发安全定义、白名单、执行流程 | 虾哥（坚果确认） |
| v1.4.4 | 2026-04-05 | 二级 | P0 实现路径更新：Tool Orchestration 改为 Skill 层子 agent 并发（sessions_spawn 模拟进程级并发）；路线图 P0 描述更新；1.5.4 增加落地路径说明和局限性分析 | 虾哥（坚果确认） |
| v1.4.5 | 2026-04-05 | 二级 | 1.5.3 学习原则新增：Claude Code 代码优先；不适配时必须讨论落地方案，不做无效实现 | 虾哥（坚果确认） |

---

*最后更新：2026-04-05*
*版本：v1.4.5*
