# CLAUDE_CODE_ARCHITECTURE.md

> 版本：v0.6（2026-04-05）
> 来源：claude-code-leak 源码 + Ai迷思录（微信）+ 炼钢AI（微信）
> 状态：持续研究

---

## 一、核心认知框架：Agent ≠ Chatbot

> 来源：Ai迷思录「五个核心发现」，补充自源码验证

Claude Code 不是一个"更聪明的聊天工具"，而是一个能**主动规划 + 真正执行 + 对结果负责**的系统。

| 维度 | 聊天机器人 | Agent |
|------|-----------|-------|
| **输出** | 文本 | 动作 + 结果 |
| **能力** | 只能建议 | 可以执行 |
| **边界** | 被动响应 | 主动规划 |
| **责任** | 用户提供答案 | 对结果负责 |

**延伸维度（源码体现）：**

| 维度 | 说明 | 源码对应 |
|------|------|---------|
| **系统提示构建** | 如何把工具定义、权限规则、用户偏好注入 prompt | query.ts / systemPrompt.ts |
| **Memory 系统** | CLAUDE.md 配置、自动提取、相关性搜索 | Session Memory / autoDream |
| **上下文压缩** | 触发机制、摘要策略、遗忘的艺术 | compact.ts |
| **Token 经济学** | 如何在有限窗口内最大化有效信息 | tokenCountWithEstimation |

**Agent 的三个本质特征（对应虾哥进化方向）：**
1. **执行大于建议** — 不只是回答，而是调用工具落地
2. **主动规划** — 多步任务自动拆解执行，不需要用户一步步指挥
3. **对结果负责** — 记忆自己的行为，压缩后能恢复上下文

---

## 二、整体架构总图

```
用户输入
  ↓
QueryEngine（query.ts）
  ↓
Agent Loop（主循环）
  ├─ 工具调用（Tool Use）
  │    └─ ToolOrchestration（runTools）
  │         ├─ 并发批次（read-only 工具并行，最大10并发）
  │         └─ 串行批次（危险操作顺序执行）
  │
  ├─ Agent 分支
  │    ├─ Plan Agent（规划）
  │    ├─ General Agent（通用任务）
  │    ├─ Verification Agent（验证）
  │    └─ Explore Agent（探索）
  │
  ├─ 压缩模块（Compact）
  │    ├─ PreCompact Hooks
  │    ├─ Summarization（forked agent 或 streaming）
  │    ├─ PostCompact Hooks
  │    └─ 附件重建（文件/技能/计划）
  │
  └─ 权限系统（Permissions）
       ├─ PreToolUse Hook
       ├─ PostToolUse Hook
       └─ 危险命令 gate

```

---

## 二、Compact 压缩模块（compact.ts）

**优先级：高（xiage-context-engine 已打底）**

### 2.1 两种压缩模式

| 模式 | 函数 | 说明 |
|------|------|------|
| 完整压缩 | `compactConversation()` | 压缩全部历史消息，保留最近对话窗口 |
| 部分压缩 | `partialCompactConversation()` | 从选定消息位置压缩（from/up_to 两个方向） |

### 2.2 压缩流程（完整压缩）

```
compactConversation(messages, context, ...)
  │
  ├─ 1. 执行 PreCompact Hooks（自定义指令注入）
  │
  ├─ 2. stripImagesFromMessages()  — 去掉图片/文档（节省 token）
  │
  ├─ 3. stripReinjectedAttachments() — 去掉重复注入的附件
  │
  ├─ 4. streamCompactSummary() — 调用模型生成摘要
  │    │
  │    ├─ 路径A：Forked Agent（prompt cache 复用，默认启用）
  │    │    → runForkedAgent({ promptMessages: [summaryRequest], ... })
  │    │    → 共享主会话的 system prompt + tools cache
  │    │
  │    └─ 路径B：Streaming Fallback（cache miss 时）
  │         → queryModelWithStreaming() 直接调用 API
  │
  ├─ 5. PTL 重试逻辑 — 如果摘要请求本身触发 prompt-too-long
  │    → truncateHeadForPTLRetry() 丢弃最老的 API round，重试（最多3次）
  │
  ├─ 6. 写回文件状态（readFileState.clear()）
  │
  ├─ 7. 创建 PostCompact 附件
  │    ├─ createPostCompactFileAttachments() — 重建最近读取的文件（最多5个）
  │    ├─ createSkillAttachmentIfNeeded() — 保留调用的 skill 内容
  │    ├─ createPlanAttachmentIfNeeded() — 保留计划模式状态
  │    ├─ createPlanModeAttachmentIfNeeded() — plan mode 继续
  │    ├─ createAsyncAgentAttachmentsIfNeeded() — 后台 agent 状态
  │    └─ getDeferredToolsDeltaAttachment() — 工具列表重播
  │
  ├─ 8. 执行 SessionStart Hooks（压缩后初始化）
  │
  ├─ 9. 执行 PostCompact Hooks
  │
  └─ 10. 返回 CompactionResult（含 boundaryMarker + summaryMessages）
```

### 2.3 Token 预算

| 常量 | 值 | 说明 |
|------|-----|------|
| `POST_COMPACT_TOKEN_BUDGET` | 50,000 | post-compact 文件总 token 上限 |
| `POST_COMPACT_MAX_TOKENS_PER_FILE` | 5,000 | 单文件截断上限 |
| `POST_COMPACT_MAX_FILES_TO_RESTORE` | 5 | 最多重建5个最近文件 |
| `POST_COMPACT_MAX_TOKENS_PER_SKILL` | 5,000 | 单 skill 截断上限 |
| `POST_COMPACT_SKILLS_TOKEN_BUDGET` | 25,000 | skill 总上限（约5个 skill） |
| `COMPACT_MAX_OUTPUT_TOKENS` | ? | 摘要输出上限 |

### 2.4 Partial Compact（部分压缩）

支持从指定位置定向压缩两个方向：

- **direction='from'**：从 pivotIndex 往后压缩，**保留**前面的消息（prompt cache 友好）
- **direction='up_to'**：从开头到 pivotIndex 压缩，**保留**后面的消息（需要重建 cache）

### 2.5 Prompt Cache 优化

- Forked agent 路径：复用主会话的 prompt cache（前缀相同则命中）
- 实验数据：关闭时 98% cache miss，开启时大部分命中
- PTL 重试会破坏 cache prefix，但仍需继续（用户不能被卡住）

### 2.6 与 xiage-context-engine 的对比

| 特性 | Claude Code compact | xiage-context-engine |
|------|-------------------|---------------------|
| 触发方式 | 自动（阈值）+ 手动 | 自动（阈值）+ 手动 |
| 摘要方式 | 调用模型生成 | 待实现 |
| PTL 处理 | truncateHeadForPTLRetry | 待实现 |
| 文件重建 | createPostCompactFileAttachments | 待实现 |
| Skill 保留 | createSkillAttachmentIfNeeded | 待实现 |
| 权限 hook | PreCompact/PostCompact Hooks | 待实现 |
| 异步 agent 保留 | createAsyncAgentAttachmentsIfNeeded | 待实现 |

---

## 三、Tool Orchestration（toolOrchestration.ts）

**优先级：高（虾哥当前最弱，决定能力上限）**

### 3.1 核心函数

```typescript
async function* runTools(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void>
```

### 3.2 分区策略（Partition）

Claude Code 把工具调用分成两类：

| 类型 | 处理方式 | 示例 |
|------|---------|------|
| **非并发安全**（non-read-only） | 串行执行，每次一个 | Bash（写文件、改系统）、Edit |
| **并发安全**（read-only） | 并行执行，最多10并发 | Read、Grep、Glob |

**分区算法**：
```
遍历 toolUseMessages：
  判断 isConcurrencySafe(tool)：
    - 如果当前批次是并发安全 且 下一个也是 → 加入当前批次
    - 否则 → 开新批次
```

### 3.3 并发控制

```typescript
function getMaxToolUseConcurrency(): number {
  return parseInt(process.env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY || '', 10) || 10
}
```

默认最大 10 个并发 read-only 工具。

### 3.4 Context 传播

工具执行后的 context modification 会排队，按顺序应用到 currentContext：
```
tool[0] → modify context → 队列
tool[1] → modify context → 队列（合并）
tool[2]（非并发安全）→ 等队列全部应用后，再执行
```

### 3.5 关键类型

```typescript
type MessageUpdate = {
  message?: Message        // 工具执行结果消息
  newContext: ToolUseContext  // 更新后的上下文
}

type Batch = {
  isConcurrencySafe: boolean
  blocks: ToolUseBlock[]
}
```

---

### 3.6 OpenClaw 对比与 Plugin/Skill 实现路径

**架构差异：**

| 维度 | Claude Code | OpenClaw |
|------|-------------|----------|
| 工具编排模块 | 独立文件 `toolOrchestration.ts` | 耦合在 `runEmbeddedPiAgent` 黑盒内 |
| 工具 hook | `before_tool_call`（单工具级） | 只有 `before_tool_call`，无批次级 |
| 分区并发 | 支持（read/write 分流，最多10并发） | 不支持（session 内完全串行） |
| 编排接口开放性 | 代码开源，可替换 | 无独立接口，无法从外部替换 |

**关键发现：OpenClaw 的工具编排没有统一接口。**

`before_tool_call` 只能看到单个工具调用，无法实现「收集一批 → 判断类型 → 分区调度」的编排逻辑。工具批次和 session 排队完全在 `pi-agent-core` 内部黑盒处理。

**Plugin/Skill 实现路径分析：**

| 方案 | 可行性 | 限制 |
|------|--------|------|
| `before_tool_call` hook | ❌ | 只拦截单个工具，无法改变执行顺序 |
| `after_tool_call` hook | ❌ | 同上，且是事后拦截 |
| `before_agent_reply` hook | ⚠️ 可行但 hack | LLM 回复后拦截，可收集工具列表，但需自己实现并发调度 |
| Plugin 内部修改 agent-core | ❌ | plugin 无法访问 agent-core 运行时 |
| 改 OpenClaw 核心代码 | ✅ 理论可行 | 高风险：chunk 文件名随机、API 不稳定、无测试环境 |

**结论：Plugin/Skill 层无法实现 Claude Code 的工具编排分区。**

唯一可行路径是在 `before_agent_reply` hook 中拦截 LLM 的工具调用列表，自己实现并发调度（用 `Promise.all` 或 `sessions_spawn`），但这需要把工具调用的「执行权」从 OpenClaw 手里抢过来再做二次分发，工程上非常复杂且脆弱。

**更实际的路线：**
1. 在 Skill 层对「可并行的批量任务」做手动并发优化（如批量读取多个文件时，用 `sessions_spawn` 并行）
2. 等 OpenClaw 官方支持工具批次级 hook（最稳）
3. 参与 OpenClaw 开源贡献，推动工具编排接口化

---

## 四、Agent System（AgentTool）

**优先级：中（多步并行任务的基础）**

### 4.1 核心架构

```
用户/父Agent
  ↓
AgentTool（/agent 命令）
  ├─ 解析 subagent_type
  ├─ 加载 Agent 定义（builtInAgents / 自定义）
  ├─ forkSubagent 检查（隐式 fork vs 显式子 agent）
  └─ runAgent() 执行
       ├─ 初始化 Agent 专属 context
       ├─ 初始化 Agent 专属 MCP servers（可选）
       ├─ 预加载 agent frontmatter skills
       ├─ query() 主循环（与父共享相同的 query 引擎）
       └─ yield 结果给父
```

### 4.2 工具类型定义

```typescript
type BuiltInAgentDefinition = {
  agentType: string
  whenToUse: string              // 描述何时用这个 agent
  tools: string[] | ['*']        // 可用工具列表，['*']=全部
  model?: 'inherit' | 'sonnet' | 'opus' | 'haiku'  // 模型选择
  permissionMode?: PermissionMode  // 权限模式
  maxTurns?: number              // 最大回合数
  getSystemPrompt(): string      // 系统 prompt 生成器
  disallowedTools?: string[]      // 禁用工具（Plan Agent 用）
  omitClaudeMd?: boolean         // 是否省略 CLAUDE.md（节省 token）
  mcpServers?: MCPServerSpec[]   // agent 专属 MCP 服务器
  skills?: string[]               // 预加载的 skills
  hooks?: Hook[]                 // frontmatter hooks
}
```

### 4.3 内置 Agent 类型

| Agent | 用途 | 工具限制 | 模型 |
|-------|------|---------|------|
| `general-purpose` | 通用任务、研究、多步执行 | `['*']`（全部） | 继承 |
| `Plan` | 架构规划、实施方案设计 | 禁用所有写工具（Read-only） | 继承 |
| `Explore` | 代码探索、搜索、分析 | `['*']`（全部） | 继承 |
| `Verification` | 结果验证 | 待查 | 待查 |
| `fork`（隐式） | 无 subagent_type 时的默认 fork | 继承父工具池 | 继承父 |

**Plan Agent 严格限制：**
```
禁用：AgentTool, ExitPlanMode, Edit, Write, NotebookEdit
可用：Read, Glob, Grep, Bash（仅 ls/git status 等读操作）
```

### 4.4 两种子 Agent 触发方式

#### 显式子 Agent（subagent_type）
```
AgentTool({ subagent_type: 'Plan', prompt: '设计XX方案' })
→ runAgent(PLAN_AGENT, ...)
→ 完全独立的 context 和 system prompt
```

#### 隐式 Fork（无 subagent_type + fork 功能开启）
```
AgentTool({ prompt: '调查XX' })
→ 检测到无 subagent_type + forkSubagentEnabled
→ FORK_AGENT 接管
→ 构建 fork context：buildForkedMessages()
→ 复用父的完整对话历史 + tool pool（prompt cache 友好）
```

### 4.5 Fork 机制（forkSubagent.ts）

**为什么需要 fork：**
- 共享主会话的 prompt cache（前缀相同 = 缓存命中）
- 子 agent 继承父的完整上下文，不丢信息

**Fork 的消息构建：**
```
[...parent_history, assistant(all_tool_uses), user(placeholder_results + directive)]
                                                         ↑
                                         每个子 agent 的 directive 不同
                                         但前面的消息完全相同 → 最大化 cache 命中
```

**工作树隔离（worktree）：**
```
isolation: 'worktree'
→ 创建临时 git worktree（独立工作副本）
→ 子 agent 在隔离环境工作，不影响父的代码
→ buildWorktreeNotice() 注入路径转换说明
```

**Fork 子 Agent 的 10 条铁律（buildChildMessage）：**
1. 不对话、不提问、不建议下一步
2. 不编辑、不评论元内容
3. 直接使用工具（Bash/Read/Write）
4. 修改文件必须先 commit
5. 工具调用之间不输出文字
6. 报告 ≤500 字
7. 必须以 "Scope:" 开头
8. 最后必须 stop

### 4.6 runAgent 执行流程

```
1. resolveAgentModel() — 确定 agent 使用的模型
2. createSubagentContext() — 创建隔离的 ToolUseContext
3. resolveAgentTools() — 根据 agent 定义过滤工具池
4. initializeAgentMcpServers() — 连接 agent 专属 MCP
5. 预加载 skills（from agent frontmatter）
6. 注册 frontmatter hooks
7. query() 主循环 → yield messages 给父
8. 清理：MCP cleanup、hooks cleanup、fileStateCache、perfetto 注册
```

### 4.7 七种 Sub-Agent 执行模式

> 来源：炼钢AI《两万字详解Claude Code源码核心机制》

| 执行模式 | 触发条件 | 特点 |
|---------|---------|------|
| **同步前台** | `run_in_background: false`（默认） | 阻塞等待结果，结果直接返回给父 |
| **异步后台** | `run_in_background: true` | 立即返回 agent ID，父通过 `TaskOutput` 轮询 |
| **自动转后台** | 运行超过 120 秒 | 自动切换，通知用户，避免长时间阻塞 |
| **Worktree 隔离** | `isolation: 'worktree'` | 创建临时 git worktree，Agent 在独立副本上操作 |
| **远端执行** | `isolation: 'remote'` | 在云端远程环境运行，始终后台（内部功能） |
| **Fork 模式** | `subagent_type` 省略（实验性） | 继承父完整对话历史和 system prompt |
| **Teammate 模式** | `agent swarms` 功能开启 + 指定 `name` | 在独立 tmux session 中运行，可通过 `SendMessage` 双向通信 |

### 4.8 与 OpenClaw subagent 的对比

| 特性 | Claude Code Agent | OpenClaw subagent |
|------|------------------|-------------------|
| 触发方式 | /agent 命令 + fork | sessions_spawn |
| 工具池 | 可精确控制（disallowedTools） | 继承父工具 |
| 上下文共享 | fork 实现 prompt cache 复用 | 独立上下文 |
| 隔离机制 | git worktree | 无（同一 workspace） |
| 内置 Agent 类型 | Plan/Explore/General/Verification | 无内置 |
| 权限模式 | bubble/plan/bypass | 无 |
| 后台运行 | run_in_background=true | thread=true |

### 4.9 与 xiage-context-engine 对接思路

xiage-context-engine 的 `compact()` 触发后，可通过 `createAsyncAgentAttachments()` 机制通知父上下文有子 agent 在运行。这个模式可以借鉴来追踪后台任务状态。

---

## 五、Permissions System

**优先级：中（危险操作 gate）**

### 5.1 权限模式（PermissionMode）

| 模式 | 说明 | 用户交互 |
|------|------|---------|
| `default` | 标准模式，每次危险操作询问 | 每次询问 |
| `plan` | 计划模式，只读规划 | 不询问（只读） |
| `acceptEdits` | 自动放行文件编辑 | 无询问 |
| `bypassPermissions` | 完全绕过权限检查 | 无限制 |
| `dontAsk` | 静默拒绝所有 ask | 全部拒绝 |
| `auto` | ANT专有，AI分类器自动决策 | 无询问 |

### 5.2 权限决策流水线（hasPermissionsToUseToolInner）

```
工具调用请求
  │
  ├─ 1a. 工具级 Deny 规则 → 直接拒绝
  ├─ 1b. 工具级 Ask 规则 → 直接询问
  ├─ 1c. 工具自身 checkPermissions() 检查
  ├─ 1d. 工具实现拒绝 → 直接拒绝
  ├─ 1e. 工具需要用户交互 → 询问
  ├─ 1f. 内容级 Ask 规则（content-specific）
  ├─ 1g. 安全检查（.git/、.claude/、.vscode/等）→ 询问
  │
  ├─ 2a. 模式检查：bypassPermissions / plan+bypass可用 → 直接放行
  ├─ 2b. 工具级 Allow 规则 → 直接放行
  │
  └─ 3. 剩余 → 转为 ask，等待用户确认
```

**关键设计：安全检查（1g）是 bypass-immune** — 即使在 bypassPermissions 模式下，`.git/`、`.claude/`、`.vscode/`、shell 配置文件仍然要询问。

### 5.3 规则体系

**规则来源（8个）：**
```
localSettings / userSettings / projectSettings   ← 用户配置文件
policySettings / flagSettings                    ← 企业策略
cliArg                                          ← 命令行参数
command                                         ← 会话内命令
session                                         ← 会话内存
```

**规则匹配三种粒度：**
```
工具级：       Bash          → 整个 Bash 工具
内容级：       Bash(npm publish:*)  → 特定命令模式
MCP服务器级：  mcp__server1  → 服务器上所有工具
```

### 5.4 Auto Mode（AI 分类器决策）

ANT专有功能，用 AI 模型代替用户做危险操作决策：

```
用户说"总是允许" → 规则自动生成
用户说"总是拒绝" → 规则自动生成

模型学习：       denyTracking（连续/累计追踪）
  → 3次连续拒绝 或 20次累计拒绝 → 退回人工确认
```

**快速通道（避免昂贵的分类器调用）：**
- `acceptEdits` 模式直接放行 → 节省 API 调用
- 安全工具白名单 → 跳过分类
- PowerShell 默认需要用户确认（不信任）

**分类器失败策略：**
- `tengu_iron_gate_closed=true` → fail closed（拒绝）
- `tengu_iron_gate_closed=false` → fail open（退回人工）

### 5.5 拒绝追踪（Denial Tracking）

```typescript
DENIAL_LIMITS = {
  maxConsecutive: 3,   // 3次连续拒绝 → 退回询问
  maxTotal: 20        // 20次累计拒绝 → 退回询问
}
```

成功使用一次工具 → 连续计数清零（防止误判）

### 5.6 Headless/Async Agent 的权限处理

后台 agent 无法显示 UI 提示：

```
shouldAvoidPermissionPrompts = true
  → 运行 PermissionRequest Hooks（自动化批准）
  → Hook 无法决策 → 自动拒绝
  → 拒绝累积 → AgentAbortError
```

### 5.7 与 OpenClaw beforeCode.js 的对比

| 特性 | Claude Code Permissions | OpenClaw beforeCode |
|------|----------------------|-------------------|
| 决策方式 | 规则 + AI 分类器 | 正则模式匹配 |
| 粒度 | 工具级 + 内容级 + 服务器级 | 内容级（命令模式） |
| 安全目录保护 | 内置（.git/.claude/.vscode） | Shell层检测 |
| 用户交互 | 实时询问 + Auto Mode | 执行前检查 |
| 后台 agent | Hook 机制自动批准/拒绝 | 不支持 |

### 5.8 对虾哥的启发

1. **bypass-immune 安全区域**：OpenClaw 可以借鉴，对 `.claude/`、`memory/` 等目录设置 bypass-immune 规则
2. **Auto Mode 思路**：对于高频低风险的命令（read/search），可以学习 Claude Code 的白名单逻辑减少不必要的确认
3. **拒绝追踪**：连续拒绝后自动退回人工，是防止"分类器误判用户被困"的好机制

---

## 六、Skills System

**优先级：中（skill 生命周期管理）**

## 六、Skills System

**优先级：中（skill 生命周期管理）**

### 6.1 Skill 两种执行模式

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| **Inline（内联）** | skill 内容直接注入 prompt | 简单、单次任务 |
| **Forked（分支）** | skill 在独立子 agent 运行 | 复杂、多步骤、需要工具 |

**判断逻辑：**
```
skill 内容 + args
  → prepareForkedCommandContext()
  → fork: 包含工具调用 / 复杂逻辑
  → inline: 纯文本 prompt
```

### 6.2 SkillTool 核心流程

```
用户调用 /skill <name>
  → SkillTool.validateInput()
       ├─ 检查 skill 是否存在
       ├─ 检查是否可被模型调用（disableModelInvocation）
       ├─ 检查类型是否为 prompt
       └─ 远程 skill 处理（ANT专有）
  → SkillTool.checkPermissions()
       ├─ 查询权限规则（deny/ask）
       └─ 查找对应 command 对象
  → 执行（call()）
       ├─ inline: 注入 skill 内容到 prompt
       └─ forked: runAgent() 在独立 agent 执行
  → 结果写入 invokedSkills（压缩时保留）
```

### 6.3 Skill 注册与加载

```
Skills 来源：
  ├─ 内置 skill（bundled）— 固定不可删
  ├─ 项目 skill（.claude/commands/）
  ├─ 插件 skill（plugins/）
  ├─ MCP skill（MCP server prompts）
  └─ 远程 skill（ANT专有，Skill Search）

加载时机：
  → getCommands(cwd)
  → getSkillToolCommands()
  → SkillTool prompt 注入（按预算截断）
```

**Prompt 预算控制：**
```
SKILL_BUDGET_CONTEXT_PERCENT = 0.01（1% 的 context window）
DEFAULT_CHAR_BUDGET = 8000
MAX_LISTING_DESC_CHARS = 250（单条描述上限）
```

### 6.4 InvokedSkills（压缩保留机制）

```typescript
STATE.invokedSkills: Map<`${agentId}:${skillName}`, InvokedSkillInfo>

// 压缩时：
createSkillAttachmentIfNeeded()
  → 读取 invokedSkills
  → 保留 skill 内容（最多5个，共25K token上限）
  → 压缩后恢复 skill 上下文
```

**设计亮点：** skill 内容在压缩后可以完整恢复，不会因为 context 压缩丢失 skill 的执行上下文。

### 6.5 Skill 与 MCP 的边界

```
MCP prompts
  → 在 AppState.mcp.commands 中
  → 可被 SkillTool 发现和调用
  → 通过 getAllCommands(context) 合并到 skill 列表

Agent 专属 MCP servers
  → 在 runAgent() 时独立初始化
  → 与父 session 的 MCP 完全隔离
```

### 6.6 Skill 执行权限

```
SkillTool.checkPermissions()
  → 查找 Skill(commandName) 规则
  → 支持前缀匹配：Skill(review:*) 匹配所有 review 相关 skill
  → deny → 拒绝
  → ask → 询问用户
  → 无规则 → 放行
```

### 6.7 Skill 前端提示（prompt.ts）

**系统提示（注入给模型）：**
```
当用户请求任务时，先检查可用 skills
当用户引用 "/<something>" 时，识别为 skill 调用
必须：调用 SkillTool 才能生成其他响应
禁止：提到 skill 但不实际调用
```

### 6.8 与 OpenClaw skills 的对比

| 特性 | Claude Code Skill | OpenClaw Skill |
|------|-----------------|----------------|
| 执行模式 | inline + forked（独立 agent） | 在主 agent 内执行 |
| 注册方式 | commands.js 集中管理 | skill 目录 + SKILL.md |
| 权限控制 | Skill(commandName) 规则 | 无精细权限控制 |
| 压缩保留 | invokedSkills 自动保留 | memory 层手动管理 |
| MCP 集成 | 通过 getAllCommands 暴露给 SkillTool | 无 MCP 集成 |

### 6.9 对虾哥的启发

1. **forked skill 执行模式** — OpenClaw 的 skill 目前在主 agent 执行，如果 skill 需要复杂多步操作，可以借鉴 forked agent 模式
2. **Skill 命令权限规则** — 可以给 skill 添加 deny/ask 规则，而不只是工具层
3. **压缩保留 invokedSkills** — 这是个很好的设计，skill 执行上下文可以在压缩后恢复，虾哥可以考虑在 memory 层实现类似机制

---

## 七、Session Memory

**优先级：中（长期记忆参考）**

### 7.1 核心设计理念

Session Memory 是 Claude Code 的「自动笔记系统」——在后台周期性运行一个 forked 子 agent，从对话历史中提取关键信息，写入 `.claude/session_memory/<session-id>.md` 文件。

**与压缩的关系：**
```
压缩触发
  → 读取 session_memory.md
  → 作为附件注入 prompt
  → 压缩后上下文能感知"之前在做什么"
```

### 7.2 触发机制（三个条件）

```
初始化阈值：context 总 token ≥ minimumMessageTokensToInit（默认 10000）

更新阈值（需同时满足）：
  ├─ Token 增长：距上次更新，context 增长 ≥ minimumTokensBetweenUpdate（默认 5000）
  ├─ 工具调用数：距上次更新，工具调用 ≥ toolCallsBetweenUpdates（默认 3）
  └─ 安全提取点：上一轮 assistant 消息没有工具调用（确保在自然停顿点提取）
```

### 7.3 执行流程

```
registerPostSamplingHook(extractSessionMemory)
  ↓
shouldExtractMemory() — 三重阈值检查
  ↓
setupSessionMemoryFile()
  ├─ 创建 .claude/session_memory/ 目录（mode 0o700）
  ├─ 读取当前 session_memory.md（如存在）
  └─ 返回文件路径 + 当前内容
  ↓
buildSessionMemoryUpdatePrompt()
  ├─ 加载 prompt 模板（可自定义 ~/.claude/session-memory/config/prompt.md）
  ├─ 分析各 section 长度
  └─ 超限时追加截断警告
  ↓
runForkedAgent({ promptMessages: [userPrompt] })
  └─ 子 agent 只能 Edit session_memory.md（其他工具全部拒绝）
```

### 7.4 笔记模板结构（DEFAULT_SESSION_MEMORY_TEMPLATE）

```markdown
# Session Title
_5-10词描述性标题_

# Current State
_当前正在做什么？未完成的挂起任务？下一步？_

# Task specification
_用户要求做什么？设计决策？_

# Files and Functions
_重要文件及作用_

# Workflow
_常用 bash 命令及顺序_

# Errors & Corrections
_遇到的错误及修复方式_

# Codebase and System Documentation
_重要系统组件及工作原理_

# Learnings
_什么有效/无效，需要避免什么？_

# Key results
_用户要求的精确输出结果（表格/答案/文档）_

# Worklog
_每一步尝试了什么，做了什么（极简）_
```

### 7.5 严格的模板保护机制

子 agent 的 Edit 操作有严格限制：
- **禁止删除/修改 section header**（`# Session Title` 等）
- **禁止删除/修改 italic description**（`_5-10词描述性标题_` 这种模板说明）
- **只能更新 content 部分**
- **只允许 Edit session_memory.md 这一个文件**

### 7.6 Token 预算控制

| 常量 | 值 | 说明 |
|------|-----|------|
| `MAX_SECTION_LENGTH` | 2000 tokens | 单 section 上限 |
| `MAX_TOTAL_SESSION_MEMORY_TOKENS` | 12000 tokens | 文件总上限 |

压缩时如果 session memory 超出预算，触发 `truncateSessionMemoryForCompact()` 强制截断。

### 7.7 权限模型（createMemoryFileCanUseTool）

```typescript
// 唯一的权限规则：只能 Edit 这一个文件
only FILE_EDIT_TOOL_NAME on ${memoryPath} is allowed
deny all other tools and all other files
```

### 7.8 与 OpenClaw memory 层的对比

| 特性 | Claude Code Session Memory | OpenClaw memory |
|------|-------------------------|-----------------|
| 存储位置 | `.claude/session_memory/<id>.md` | `memory/YYYY-MM-DD.md` |
| 更新方式 | forked agent 自动提取 | 手动记录 |
| 触发机制 | 三重阈值自动触发 | 手动或 cron |
| 内容结构 | 固定模板（10个 section） | 自由格式 |
| 压缩时 | 自动截断并注入 prompt | 启动时读取 |
| 模板保护 | 严格的 section 结构保护 | 无 |

### 7.9 对虾哥的启发

1. **自动提取机制** — 虾哥的 memory 层可以借鉴这个模式，在 context 增长到一定程度后自动调用一个 mini agent 来总结当前状态，而不是依赖手动记录
2. **固定模板的好处** — 结构化模板让信息易于检索，虾哥的 daily log 可以参考这个 section 结构
3. **严格的编辑边界** — 防止子 agent 破坏模板结构，这个设计可以用在虾哥的后台任务里

---

## 八、autoDream（自动记忆整合）

**优先级：中（多 session 跨会话记忆整合）**

### 8.1 核心设计理念

autoDream 是 Claude Code 的「跨会话记忆整合器」——定期（默认24小时）把所有 session 的对话摘要聚合成一份长期记忆，写入 `.claude/memory/` 目录。

**与 Session Memory 的关系：**
```
Session Memory → 每个会话的实时笔记（.claude/session_memory/）
autoDream      → 多会话整合的长期记忆（.claude/memory/）
```

### 8.2 三重 Gate 机制

```
触发条件（三个都必须满足）：
  ├─ 时间 Gate：距上次整合 ≥ minHours（默认24小时）
  ├─ Session Gate：距上次 mtime 有 ≥ minSessions 个 session（默认5个）
  └─ 锁 Gate：没有其他进程正在整合（避免并发冲突）
```

### 8.3 执行流程

```
initAutoDream() → registerPostSamplingHook(executeAutoDream)
  ↓
executeAutoDream() — 每次 API 调用后检查 gate
  ├─ readLastConsolidatedAt() — 读锁文件时间戳
  ├─ listSessionsTouchedSince() — 扫描新 session
  ├─ tryAcquireConsolidationLock() — 抢锁
  └─ runForkedAgent({ querySource: 'auto_dream' })
       ├─ 只能 Bash（read-only）：ls/find/grep/cat/stat/wc/head/tail
       ├─ 只能 Edit/Write：memory 目录下的文件
       └─ onMessage → 实时更新 DreamTask UI
```

### 8.4 整合锁机制（consolidationLock）

```
锁文件：.claude/.dream_consolidation_lock

tryAcquireConsolidationLock():
  → touch 锁文件，记录 mtime
  → 成功后返回 priorMtime（用于回滚）
  → 失败（文件已存在）→ 返回 null，跳过

rollbackConsolidationLock(priorMtime):
  → 把锁文件 mtime 改回 priorMtime
  → 下次 gate 检查能重新触发
```

### 8.5 DreamTask（后台任务 UI）

forked agent 默认是「无界面」的，DreamTask 把整合过程显示在 footer pill 和 Shift+Down 对话框：

```typescript
type DreamTaskState = {
  type: 'dream'
  phase: 'starting' | 'updating'  // 首次 Edit/Write 时从 starting 切到 updating
  sessionsReviewing: number        // 多少个 session 待整合
  filesTouched: string[]           // 实际修改的文件
  turns: DreamTurn[]               // agent 的文字输出（工具调用折叠成计数）
  abortController?: AbortController
  priorMtime: number              // 用于 kill 时的锁回滚
}
```

### 8.6 对虾哥的启发

1. **跨 session 整合** — 虾哥的 memory 层目前只有每日日志，没有跨会话整合机制，autoDream 是很好的参考
2. **锁机制** — 多进程并发整合时用文件锁避免冲突，这个模式可以用在虾哥的 cron 任务里
3. **后台任务 UI** — 让用户能看到后台任务进度，而不是黑盒运行

---

## 九、Hooks System（钩子系统）

**优先级：中（模块间解耦机制）**

### 9.1 核心机制

Claude Code 的钩子系统允许在特定时机注入自定义逻辑，不需要修改核心代码。

**两种 Hook 类型：**

| 类型 | 触发时机 | 使用场景 |
|------|---------|---------|
| **PostSampling Hook** | 模型采样完成后 | Session Memory、autoDream |
| **PreToolUse Hook** | 工具执行前 | 权限检查、上下文修改 |
| **Stop Hook** | 对话结束时 | autoDream 执行 |

### 9.2 PostSampling Hooks

```typescript
type PostSamplingHook = (context: REPLHookContext) => Promise<void> | void

// 注册
registerPostSamplingHook(hook: PostSamplingHook)

// 执行（在 API 响应后、工具结果返回前）
await executePostSamplingHooks(messages, systemPrompt, userContext, systemContext, toolUseContext, querySource)
```

**REPLHookContext：**
```typescript
{
  messages,          // 完整消息历史（含 assistant 响应）
  systemPrompt,       // 系统 prompt
  userContext,        // 用户上下文
  systemContext,      // 系统上下文
  toolUseContext,     // 工具执行上下文
  querySource        // repl_main_thread / session_memory / auto_dream / ...
}
```

### 9.3 Hook 的执行顺序

```
API 采样完成
  → executePostSamplingHooks()
       ├─ Hook[0] 执行（顺序注册）
       ├─ Hook[1] 执行（顺序注册）
       └─ Hook[n] 执行（顺序注册）
  → 返回结果给用户
```

**错误处理：** 单个 hook 报错不影响其他 hook，继续执行。

### 9.3 24种 Hook 事件分类（来源：炼钢AI）

| 类别 | 事件 |
|------|------|
| **生命周期** | `SessionStart` / `SessionEnd` / `Setup` / `Stop` / `StopFailure` |
| **工具** | `PreToolUse` / `PostToolUse` / `PostToolUseFailure` |
| **权限** | `PermissionRequest` / `PermissionDenied` |
| **Sub-Agent** | `SubagentStart` / `SubagentStop` / `TeammateIdle` |
| **用户交互** | `UserPromptSubmit` / `Notification` |
| **压缩** | `PreCompact` / `PostCompact` |
| **任务** | `TaskCreated` / `TaskCompleted` |
| **系统** | `ConfigChange` / `CwdChanged` / `FileChanged` / `InstructionsLoaded` |
| **MCP** | `Elicitation` / `ElicitationResult` |

### 9.4 与 OpenClaw 的对比

| 特性 | Claude Code Hooks | OpenClaw |
|------|-----------------|----------|
| 触发时机 | 明确的 hook 点（采样后/工具前/停止时） | 无等价机制 |
| 注册方式 | registerXxxHook() | 无 |
| 上下文传递 | 完整的 REPLHookContext | 无 |

---

## 十、MCP System（Model Context Protocol）

**优先级：低（OpenClaw 暂无 MCP 支持）**

### 10.1 核心设计

MCP 是一个开放协议，允许第三方服务作为「工具/资源提供者」接入 Claude Code。

**支持的传输协议：**

| 传输方式 | 说明 |
|---------|------|
| `stdio` | 子进程模式，通过 stdin/stdout 通信 |
| `sse` | Server-Sent Events over HTTP |
| `sse-ide` | IDE 扩展专用 SSE |
| `http` / `ws` | HTTP/WebSocket |
| `sdk` | IDE 扩展 SDK 内部 |
| `claudeai-proxy` | Claude.ai 代理服务器 |

### 10.2 配置作用域（ConfigScope）

| 作用域 | 说明 |
|--------|------|
| `local` | 本地配置 |
| `user` | 用户级配置 |
| `project` | 项目级配置 |
| `dynamic` | 动态配置 |
| `enterprise` | 企业策略 |
| `managed` | 托管配置 |

### 10.3 服务器连接状态

```
Connected   → 正常运行
Failed      → 连接失败
NeedsAuth   → 需要认证（OAuth/XAA）
Pending     → 连接中（可重连）
Disabled    → 被禁用
```

### 10.4 MCP 与 Skill 的集成

```
MCP Server
  → 暴露 tools + resources + prompts
  → AppState.mcp.commands（含 loadedFrom === 'mcp'）
  → SkillTool.getAllCommands(context)
       → 合并到 skill 列表
       → 模型可通过 SkillTool 调用 MCP tool
```

### 10.5 Agent 专属 MCP

runAgent() 支持初始化 agent 专属的 MCP 服务器：
- 与父 session 的 MCP 完全隔离
- agent 结束 时清理（cleanup）

### 10.6 OAuth / XAA 支持

```
McpOAuthConfig:
  clientId / callbackPort
  authServerMetadataUrl
  xaa: true  → Cross-App Access（SEP-990）
```

### 10.7 对虾哥的启发

MCP 对虾哥的优先级低，因为 OpenClaw 已有 skill 机制。但如果未来需要接入外部服务（GitHub API、数据库等），MCP 是一个标准化的方式。

## 十一、Team System（多 Agent 协作 + 团队记忆同步）

**优先级：中（虾哥多会话协作能力）**

### 11.1 多 Agent 协作体系

Claude Code 的多 Agent 通过 Team 机制实现：

**四个核心工具：**

| 工具 | 功能 |
|------|------|
| `Agent` | 创建子 agent（主 agent 模式） |
| `TeamCreate` | 创建一个团队，定义成员 |
| `SendMessage` | 向团队成员发消息 |
| `Cron` | 定时触发 agent |

### 11.2 两种 teammate 运行模式

| 模式 | 说明 |
|------|------|
| **In-Process Teammate** | 运行在同一 Node.js 进程，用 AsyncLocalStorage 隔离，支持 plan mode 审批流程 |
| **LocalAgentTask** | 后台 agent，独立进程 |

**In-Process Teammate 特性：**
```typescript
// 身份格式：agentName@teamName
// 支持 idle / active 状态
// 可以接收注入的用户消息（injectUserMessageToTeammate）
// 支持 shutdown 请求（requestTeammateShutdown）
```

### 11.3 Team Memory Sync（团队记忆同步）

**核心能力：** 多成员共享的团队记忆库，存储在 `.claude/team_memory/` 目录，跨成员同步。

**同步协议（REST API）：**
```
GET  /api/claude_code/team_memory?repo={owner/repo}     → 获取团队记忆
PUT  /api/claude_code/team_memory?repo={owner/repo}     → 上传（upsert 语义）
GET  ?view=hashes                                       → 仅获取哈希（冲突检测）
```

**双向同步语义：**
```
Pull（拉）：Server → Local
  → 服务器内容覆盖本地（server wins per-key）
  → 删除本地文件不传播到服务器（下次 pull 会恢复）

Push（推）：Local → Server
  → Delta 上传：只上传内容哈希变化的文件
  → 乐观锁：If-Match / ETag
  → 冲突处理：412 → 获取哈希 → 重算 delta → 重试（最多2次）
```

**安全机制：**
- 上传前扫描 secrets（PSR M22174）：检测到凭证的文件跳过不上报
- 路径遍历防护（PathTraversalError）
- 单文件上限：250KB
- PUT body 上限：200KB（超限自动分批）

### 11.4 对虾哥的启发

1. **Team Memory Sync** — 虾哥目前没有团队级记忆同步，只有个人 memory 层。Team Memory 可以实现跨 session 的记忆共享
2. **Cron 工具** — 定时触发 agent，这个虾哥已经有类似的 cron 能力，可以对比完善
3. **In-Process Teammate** — 同进程内用 AsyncLocalStorage 隔离，比 fork 子进程更轻量，适合需要高频通信的场景
4. **冲突处理** — push 时的 412 + hash probe + delta retry 是一个很好的「最终一致」思路

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-05 | 初始版本：compact.ts 完整解析 + toolOrchestration.ts 完整解析 |
| v0.2 | 2026-04-05 | 新增 Agent System（forkSubagent + runAgent）、Permissions System（pipeline + auto mode）、Skills System（SkillTool + invokedSkills）、Session Memory（自动提取 + 固定模板） |
| v0.3 | 2026-04-05 | 新增 autoDream（跨会话记忆整合 + DreamTask UI）、Hooks System（PostSampling Hooks + 执行机制） |
| v0.4 | 2026-04-05 | 新增 MCP System（多传输协议 + 连接状态机 + OAuth/XAA + Skill 集成） |
| v0.5 | 2026-04-05 | 新增第一章「核心认知框架：Agent ≠ Chatbot」，含维度对比表 + Token经济学 + 三个Agent本质特征 |
| v0.6 | 2026-04-05 | 新增 Team System（TeamCreate/SendMessage/Cron 多Agent协作 + Team Memory Sync 双向同步 + 冲突处理 + secrets扫描） |
| v0.7 | 2026-04-05 | 新增 4.7 七种执行模式表格（来源：炼钢AI）；补充 9.3 24种Hook事件分类表（来源：炼钢AI） |

---

*本文档随研究持续更新*
