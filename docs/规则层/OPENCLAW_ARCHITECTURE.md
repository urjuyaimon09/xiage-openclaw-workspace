# OpenClaw 架构文档

**版本：** v0.1（2026-04-05）
**来源：** OpenClaw 官方文档 + `node_modules/openclaw/docs` 源码

---

## 第 1 章：Gateway 架构

### 概述

一个长驻的 **Gateway** 守护进程拥有所有消息接入层（WhatsApp 通过 Baileys、Telegram 通过 grammY、Slack、Discord、Signal、iMessage、WebChat）。控制面客户端（macOS 应用、CLI、Web 管理界面、自动化脚本）通过 **WebSocket** 连接到 Gateway，连接到所配置的发信主机（默认 `127.0.0.1:18789`）。

**Node**（macOS/iOS/Android/无头节点）也通过 WebSocket 连接，但声明 `role: node` 并携带明确的 capabilities/commands。每台主机只有一个 Gateway；它是唯一打开 WhatsApp session 的地方。

**Canvas host** 由 Gateway 的 HTTP 服务器提供服务，路径为：
- `/__openclaw__/canvas/` — Agent 可编辑的 HTML/CSS/JS
- `/__openclaw__/a2ui/` — A2UI host

两者与 Gateway 共用同一端口（默认 `18789`）。

### 组件与流程

#### Gateway（守护进程）
- 维护 provider 连接
- 对外暴露带类型的 WS API（请求、响应、服务端推送事件）
- 对入站帧进行 JSON Schema 校验
- 发出事件：`agent`、`chat`、`presence`、`health`、`heartbeat`、`cron`

#### 客户端（mac 应用 / CLI / Web 管理界面）
- 每个客户端一个 WS 连接
- 发送请求：`health`、`status`、`send`、`agent`、`system-presence`
- 订阅事件：`tick`、`agent`、`presence`、`shutdown`

#### Node（macOS / iOS / Android / 无头节点）
- 以 `role: node` 连接同一个 WS 服务器
- 在 `connect` 中提供设备身份；配对采用**设备级别**授权，审批结果保存在设备配对存储中
- 暴露命令：`canvas.*`、`camera.*`、`screen.record`、`location.get`

#### WebChat
- 静态 UI，通过 Gateway WS API 获取聊天记录和发送消息
- 在远程部署模式下，通过与其他客户端相同的 SSH/Tailscale 隧道连接

### 连接生命周期

```
Client → Gateway:  req:connect
Gateway → Client:  res (ok)  [或 res error + close]
                  payload=hello-ok, snapshot: presence + health

Gateway → Client:  event:presence
Gateway → Client:  event:tick

Client → Gateway:  req:agent
Gateway → Client:  res:agent, ack {runId, status:"accepted"}
Gateway → Client:  event:agent (streaming)
Gateway → Client:  res:agent, final {runId, status, summary}
```

### 通信协议（概要）

- **传输层：** WebSocket，文本帧，JSON 载荷
- **首帧必须为 `connect`**
- 握手完成后：
  - 请求：`{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - 事件：`{type:"event", event, payload, seq?, stateVersion?}`
- 若设置了 `OPENCLAW_GATEWAY_TOKEN`（或 `--token`），则 `connect.params.auth.token` 必须匹配，否则 socket 关闭
- **幂等键**（Idempotency keys）对有副作用的方法（`send`、`agent`）是必需的；服务端保留短期去重缓存
- Node 必须在 `connect` 中包含 `role: "node"` 以及 caps/commands/permissions

### 配对与本地信任

- 所有 WS 客户端（操作者 + Node）在 `connect` 时都携带**设备身份**
- 新设备 ID 需要配对授权；Gateway 为后续连接颁发**设备令牌**
- **本地**连接（loopback 或 gateway 主机自身 tailnet 地址）可自动批准
- 所有连接都必须对 `connect.challenge` nonce 进行签名
- 签名载荷 `v3` 还需绑定 `platform` + `deviceFamily`；gateway 在重连时固定配对元数据
- **非本地**连接仍需显式授权
- Gateway 鉴权（`gateway.auth.*`）适用于**所有**连接，本地和远程一视同仁

### 远程访问

- **首选：** Tailscale 或 VPN
- **备选：** SSH 隧道
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- 隧道内同样执行握手和 auth token 验证；远程 WS 部署支持 TLS + 可选证书固定

### 运维

- **启动：** `openclaw gateway`（前台运行，日志输出到 stdout）
- **健康检查：** 通过 WS 发送 `health`（也包含在 `hello-ok` 中）
- **进程管理：** 使用 launchd/systemd 实现自动重启

### 不变式

- 每台主机有且仅有一个 Gateway 控制单一 Baileys session
- 握手是强制要求；首帧若非 JSON 或非 connect 帧，直接硬关闭
- 事件不重放；客户端在出现间隙时必须刷新状态

---

## 第 2 章：Agent Loop

### 概述

**Agent Loop** 是 Agent 一次完整的"真实"运行：摄入 → 上下文组装 → 模型推理 → 工具执行 → 流式回复 → 持久化。它是将消息转化为行动和最终回复的权威路径，同时保持 session 状态一致性。

在 OpenClaw 中，一个 loop 是每个 session 的一次序列化运行，模型在思考、调用工具、流式输出过程中持续发出生命周期和流事件。

### 入口点

- Gateway RPC：`agent` 和 `agent.wait`
- CLI：`agent` 命令

### 高层流程

1. `agent` RPC 校验参数、解析 session（`sessionKey`/`sessionId`）、持久化 session 元数据，立即返回 `{runId, acceptedAt}`
2. `agentCommand` 运行 agent：
   - 解析 model 和 thinking/verbose 默认值
   - 加载 skills 快照
   - 调用 `runEmbeddedPiAgent`（pi-agent-core 运行时）
   - 若内嵌 loop 未发出生命周期结束/错误事件，则由外部发出
3. `runEmbeddedPiAgent`：
   - 通过 per-session + 全局队列序列化运行
   - 解析 model + auth profile 并构建 pi session
   - 订阅 pi 事件并流式转发 assistant/tool deltas
   - 强制超时 → 超出则中止运行
   - 返回载荷和使用元数据
4. `subscribeEmbeddedPiSession` 将 pi-agent-core 事件桥接到 OpenClaw `agent` 流：
   - tool 事件 → `stream: "tool"`
   - assistant deltas → `stream: "assistant"`
   - 生命周期事件 → `stream: "lifecycle"`（`phase: "start" | "end" | "error"`）
5. `agent.wait` 使用 `waitForAgentJob`：
   - 等待 `runId` 对应的**生命周期 end/error**
   - 返回 `{status: ok|error|timeout, startedAt, endedAt, error?}`

### 队列与并发控制

- 运行按 session key（session lane）序列化，并可选择性经过全局 lane
- 这样避免了 tool/session 竞争并保持 session 历史一致性
- 消息渠道可选择队列模式（collect/steer/followup），这些模式均接入 lane 系统

### Session 与 Workspace 准备

- Workspace 被解析和创建；沙盒运行可能重定向到沙盒 workspace root
- Skills 被加载（或从快照复用）并注入 env 和 prompt
- Bootstrap/上下文文件被解析并注入 system prompt report
- 获取 session 写锁；在流式传输前打开并准备好 `SessionManager`

### Prompt 组装与 System Prompt

- System prompt 由 OpenClaw 基础 prompt、skills prompt、bootstrap 上下文和 per-run 覆盖组成
- 强制执行 model 特定限制和压缩预留 token

### Hook 接入点

OpenClaw 有**两套 Hook 系统**：

#### 内部 Hook（Gateway hooks）
- **`agent:bootstrap`**：在构建 bootstrap 文件时运行，system prompt 定稿之前
- **命令 Hook**：`/new`、`/reset`、`/stop` 等命令事件

#### 插件 Hook（agent + gateway 生命周期）

| Hook | 时机 | 用途 |
|------|------|------|
| `before_model_resolve` | Session 前（无 `messages`） | 在解析前覆盖 provider/model |
| `before_prompt_build` | Session 加载后（有 `messages`） | 注入 `prependContext`、`systemPrompt`、`prependSystemContext` 或 `appendSystemContext` |
| `before_agent_start` | 兼容性保留 | 可能在任一阶段运行 |
| `before_agent_reply` | 内联操作之后、LLM 调用之前 | 让插件获取本轮对话或静默它 |
| `agent_end` | 完成后 | 检查最终消息列表和运行元数据 |
| `before_compaction` / `after_compaction` | 压缩周期 | 观察或注解 |
| `before_tool_call` / `after_tool_call` | Tool 生命周期 | 拦截参数/结果 |
| `before_install` | 安装扫描 | 检查发现项并可选阻止 |
| `tool_result_persist` | 同步 | 在写入 transcript 前转换 tool 结果 |
| `message_received` / `message_sending` / `message_sent` | 消息生命周期 | 入站 + 出站 hook |
| `session_start` / `session_end` | Session 边界 | Session 生命周期 |
| `gateway_start` / `gateway_stop` | Gateway 生命周期 | Gateway 生命周期 |

**Hook 决策规则（terminal = 停止执行优先级更低的处理器）：**
- `before_tool_call`：`{block: true}` → terminal；`{block: false}` → no-op
- `before_install`：`{block: true}` → terminal；`{block: false}` → no-op
- `message_sending`：`{cancel: true}` → terminal；`{cancel: false}` → no-op

### 流式传输与部分回复

- Assistant deltas 以 `assistant` 事件从 pi-agent-core 流式发出
- Block streaming 可在 `text_end` 或 `message_end` 时发出部分回复
- Reasoning 流可以作为独立流或 block 回复发出

### 回复塑形与抑制

- 最终载荷由以下部分组装：assistant 文本（+ 可选 reasoning）、内联 tool 摘要（verbose 模式时）、assistant 错误文本
- `NO_REPLY` 从出站载荷中过滤
- 消息渠道工具的重复项从最终载荷列表中移除
- 若没有可渲染的载荷且有 tool 报错，发出一个兜底的 tool error 回复（除非消息渠道工具已发送过回复）

### 压缩与重试

- 自动压缩发出 `compaction` 流事件，并可触发重试
- 重试时，内存缓冲区和 tool 摘要会重置以避免重复输出

### 事件流

- `lifecycle`：由 `subscribeEmbeddedPiSession` 发出（并由 `agentCommand` 兜底）
- `assistant`：从 pi-agent-core 流式发出的 deltas
- `tool`：从 pi-agent-core 流式发出的 tool 事件

### 超时

- `agent.wait` 默认：30s；`timeoutMs` 参数可覆盖
- Agent 运行时：`agents.defaults.timeoutSeconds` 默认 172800s（48 小时）；在 `runEmbeddedPiAgent` abort timer 中强制执行

### 提前终止路径

- Agent 超时（abort）
- AbortSignal（cancel）
- Gateway 断开或 RPC 超时
- `agent.wait` 超时（仅等待，不停止 agent）

---

## 第 3 章：Context Engine

### 概述

**Context Engine** 控制 OpenClaw 如何为每次运行构建模型上下文。它决定包含哪些消息、如何对较旧的历史进行摘要，以及如何管理跨 subagent 边界的上下文。OpenClaw 内置了一个 `legacy` 引擎。插件可以注册替代引擎来替换活动的 context-engine 生命周期。

### 生命周期接入点

每次 OpenClaw 运行模型 prompt 时，context engine 在**四个生命周期点**介入：

1. **Ingest** — 当新消息添加到 session 时调用；引擎可存储/索引该消息
2. **Assemble** — 每次模型运行前调用；返回在 token 预算内的有序消息集
3. **Compact** — 当上下文窗口满或用户执行 `/compact` 时调用；对较旧历史进行摘要
4. **After turn** — 运行完成后调用；引擎可持久化状态或触发后台压缩

### Subagent 生命周期

OpenClaw 当前调用一个 subagent 生命周期 hook：
- **`onSubagentEnded`** — 当 subagent session 完成或被清理时执行

`prepareSubagentSpawn` 是面向未来使用的接口，但运行时当前尚未调用它。

### System Prompt 附加内容

`assemble` 方法可返回 `systemPromptAddition` 字符串。OpenClaw 将其 prepend 到运行的 system prompt 前面。这使得引擎可以在不依赖静态 workspace 文件的情况下注入动态召回指导、检索指令或上下文感知提示。

### Legacy 引擎

内置的 `legacy` 引擎保留了 OpenClaw 的原始行为：

- **Ingest：** 空操作
- **Assemble：** 直通（现有的 sanitize → validate → limit 管道）
- **Compact：** 委托给内置摘要压缩（将较早的消息汇总为单一摘要，近期消息保持完整）
- **After turn：** 空操作

Legacy 引擎不注册工具，也不提供 `systemPromptAddition`。

### ContextEngine 接口

**必需成员：**

| 成员 | 类型 | 用途 |
|------|------|------|
| `info` | 属性 | 引擎 id、名称、版本、`ownsCompaction` 标志 |
| `ingest(params)` | 方法 | 存储单条消息 |
| `assemble(params)` | 方法 | 为模型运行构建上下文（返回 `AssembleResult`） |
| `compact(params)` | 方法 | 摘要/精简上下文 |

`assemble` 返回 `AssembleResult`：
- `messages` — 要发送给模型的有序消息列表
- `estimatedTokens`（必需，`number`）— 引擎的 token 估算值，用于压缩决策
- `systemPromptAddition`（可选，`string`）— prepend 到 system prompt

**可选成员：**

| 成员 | 类型 | 用途 |
|------|------|------|
| `bootstrap(params)` | 方法 | 初始化 session 的引擎状态 |
| `ingestBatch(params)` | 方法 | 将一个完成的 turn 作为批次摄入 |
| `afterTurn(params)` | 方法 | 运行后生命周期工作 |
| `prepareSubagentSpawn(params)` | 方法 | 为子 session 设置共享状态 |
| `onSubagentEnded(params)` | 方法 | Subagent 结束后的清理 |
| `dispose()` | 方法 | 在 gateway 关闭或插件重载时释放资源 |

### ownsCompaction

- `true` — 引擎自行负责压缩；OpenClaw 禁用 Pi 内置的自动压缩；引擎的 `compact()` 负责处理 `/compact`、溢出恢复和主动压缩
- `false` 或未设置 — Pi 内置的自动压缩可能在 prompt 执行期间运行，但引擎的 `compact()` 仍会在 `/compact` 和溢出恢复时被调用

**两种有效的插件模式：**
- **自主模式：** 实现自己的压缩算法，设置 `ownsCompaction: true`
- **委托模式：** 设置 `ownsCompaction: false`，让 `compact()` 调用 `delegateCompactionToRuntime(...)`（来自 `openclaw/plugin-sdk/core`）

### 与压缩和内存的关系

- **压缩（Compaction）** 是 context engine 的职责之一
- **内存插件**（`plugins.slots.memory`）与 context engine 是分开；内存插件提供搜索/检索；context engine 控制模型看到什么——二者可以协同工作
- **Session 剪枝**（在内存中裁剪旧的 tool 结果）无论使用哪个 context engine 都会运行

---

## 第 4 章：Plugin 系统

### 架构概述

OpenClaw 的插件系统分为四层：

1. **Manifest + 发现** — 从配置的路径、workspace root、全局扩展 root 和捆绑扩展中找到候选插件
2. **启用 + 校验** — 决定发现的插件是启用、禁用、阻止还是入选独占槽位
3. **运行时加载** — 原生插件通过 jiti 加载到进程内，向中央注册表注册能力；兼容 bundle 被规范化为注册表记录，但不导入运行时代码
4. **表面消费** — OpenClaw 其他部分读取注册表以暴露工具、渠道、provider 配置、hook、HTTP 路由、CLI 命令和服务

### 公共能力模型

每个原生 OpenClaw 插件注册到一种或多种能力类型：

| 能力 | 注册方法 | 示例插件 |
|------|---------|---------|
| 文本推理 | `api.registerProvider(...)` | `openai`、`anthropic` |
| CLI 推理后端 | `api.registerCliBackend(...)` | `openai`、`anthropic` |
| 语音 | `api.registerSpeechProvider(...)` | `elevenlabs`、`microsoft` |
| 媒体理解 | `api.registerMediaUnderstandingProvider(...)` | `openai`、`google` |
| 图片生成 | `api.registerImageGenerationProvider(...)` | `openai`、`google` |
| 网页搜索 | `api.registerWebSearchProvider(...)` | `google` |
| 渠道/消息 | `api.registerChannel(...)` | `msteams`、`matrix` |

注册零能力但提供 hook、工具或服务的插件是**纯 hook 插件**——完全受支持。

### 插件形态

OpenClaw 将每个加载的插件分类为一种形态：

- **plain-capability** — 只注册一种能力类型
- **hybrid-capability** — 注册多种能力类型（例如 `openai` 同时拥有 text + speech + media + image）
- **hook-only** — 只注册 hook，不注册能力、工具、命令或服务
- **non-capability** — 注册工具、命令、服务或路由，但不注册能力

### 能力所有权模型

OpenClaw 将原生插件视为公司或功能的**所有权边界**：

- 公司插件应拥有该公司所有面向 OpenClaw 的表面
- 功能插件应拥有它引入的完整功能表面
- 渠道应消费共享的核心能力，而不是临时重新实现 provider 行为

**关键区分：**
- **plugin** = 所有权边界
- **capability** = 核心契约，多个插件可以实现或消费

### 执行模型

原生插件在 Gateway 进程内**同进程**运行。它们不隔离。与核心代码一样，加载的原生插件具有相同的进程级信任边界。兼容 bundle 默认更安全（目前作为元数据/内容包处理，主要为捆绑的 skills）。

### 注册模型

加载的插件不直接修改随机核心全局变量。它们注册到一个**中央插件注册表**，该表跟踪：
- 插件记录（身份、来源、来源路径、状态、诊断）
- 工具、遗留 hook、类型化 hook
- 渠道、provider
- Gateway RPC 处理器、HTTP 路由、CLI 注册器
- 后台服务、插件自有命令

核心功能从注册表读取。加载是单向的：插件模块 → 注册表注册 → 核心运行时 → 注册表消费。

### Hook 系统

**Provider 运行时 hook（按执行顺序 24 个）：**

| # | Hook | 用途 |
|---|------|------|
| 1 | `catalog` | Provider 在 `models.json` 生成期间将配置发布到 `models.providers` |
| 2 | `resolveDynamicModel` | 同步回退，用于尚未在本地注册表中的 provider 自有 model id |
| 3 | `prepareDynamicModel` | 异步预热，然后再次运行 `resolveDynamicModel` |
| 4 | `normalizeResolvedModel` | 内嵌 runner 使用解析后 model 前的最终重写 |
| 5 | `capabilities` | Provider 自有的 transcript/工具元数据，供共享核心逻辑使用 |
| 6 | `prepareExtraParams` | 通用流选项包装器之前的请求参数规范化 |
| 7 | `wrapStreamFn` | 通用包装器应用后的流包装器 |
| 8 | `formatApiKey` | Auth profile 格式化器：存储的 profile 变为运行时 `apiKey` 字符串 |
| 9 | `refreshOAuth` | 自定义刷新端点或失败策略的 OAuth 刷新覆盖 |
| 10 | `buildAuthDoctorHint` | OAuth 刷新失败时附加的修复提示 |
| 11 | `isCacheTtlEligible` | 代理/回程 provider 的 prompt 缓存策略 |
| 12 | `buildMissingAuthMessage` | 替代通用 missing-auth 恢复消息 |
| 13 | `suppressBuiltInModel` | 过时上游 model 抑制 + 可选的用户可见提示 |
| 14 | `augmentModelCatalog` | 发现后追加的合成/最终 catalog 行 |
| 15 | `isBinaryThinking` | 二值思维 provider 的开/关推理开关 |
| 16 | `supportsXHighThinking` | 选定 model 对 `xhigh` 推理的支持 |
| 17 | `resolveDefaultThinkingLevel` | 特定 model 家族的默认 `/think` 级别 |
| 18 | `isModernModelRef` | 实时 profile 过滤器和冒烟选择的现代 model 匹配器 |
| 19 | `prepareRuntimeAuth` | 在推理前将配置的凭证兑换为实际运行时 token |
| 20 | `resolveUsageAuth` | 为 `/usage` 及相关界面解析用量/计费凭证 |
| 21 | `fetchUsageSnapshot` | 获取并规范化 provider 特定的用量/配额快照 |
| 22 | `buildReplayPolicy` | 返回 replay policy，控制该 provider 的 transcript 处理方式 |
| 23 | `sanitizeReplayHistory` | 通用 transcript 清理后重写 replay 历史 |
| 24 | `validateReplayTurns` | 内嵌 runner 前的最终 replay-turn 校验或重塑 |

### Agent 生命周期 Hook

参见第 2 章：Agent Loop — Hook 接入点一节。

### SDK 导入路径

使用 SDK 子路径而非单体 `openclaw/plugin-sdk` 导入：
- `openclaw/plugin-sdk/plugin-entry` — 插件注册原语
- `openclaw/plugin-sdk/core` — 通用共享插件面向契约
- 领域子路径：`channel-setup`、`channel-pairing`、`channel-contract`、`channel-feedback`、`channel-inbound`、`channel-lifecycle`、`channel-reply-pipeline`、`command-auth`、`secret-input`、`webhook-ingress`、`agent-runtime`、`infra-runtime`、`routing`、`runtime-store` 等

### 加载管道

启动时：
1. 发现候选插件根目录
2. 读取原生或兼容 bundle 的 manifest 和包元数据
3. 拒绝不安全的候选
4. 规范化插件配置（`plugins.enabled`、`allow`、`deny`、`entries`、`slots`、`load.paths`）
5. 为每个候选决定启用状态
6. 通过 jiti 加载启用的原生模块
7. 调用原生 `register(api)` hook；将注册收集到插件注册表
8. 将注册表暴露给命令/运行时表面

安全门检查在**运行时执行前**完成。当条目逃逸出插件 root、路径全局可写，或非捆绑插件的路径所有权可疑时，候选会被阻止。

---

## 第 5 章：Multi-Agent

### 概述

目标：多个**隔离**的 Agent（独立 workspace + `agentDir` + sessions），以及一个运行中 Gateway 内的多个渠道账号。入站消息通过 **bindings** 路由到 Agent。

### 什么是"一个 Agent"？

一个 **Agent** 是一个完整作用域的大脑，拥有自己的：
- **Workspace** — 文件、`AGENTS.md`/`SOUL.md`/`USER.md`、本地笔记、人设规则
- **状态目录**（`agentDir`）— Auth profile、model 注册表、per-agent 配置
- **Session 存储** — 聊天历史 + 路由状态，位于 `~/.openclaw/agents/<agentId>/sessions`

Auth profile 是**per-agent**的。每个 agent 从自己的 `auth-profiles.json` 读取。Skills 通过各 workspace 的 `skills/` 文件夹实现 per-agent，并通过 `~/.openclaw/skills` 共享。

### 路径速查

| 内容 | 路径 |
|------|------|
| 配置 | `~/.openclaw/openclaw.json`（或 `OPENCLAW_CONFIG_PATH`） |
| 状态目录 | `~/.openclaw`（或 `OPENCLAW_STATE_DIR`） |
| Workspace | `~/.openclaw/workspace`（或 `~/.openclaw/workspace-<agentId>`） |
| Agent 目录 | `~/.openclaw/agents/<agentId>/agent` |
| Sessions | `~/.openclaw/agents/<agentId>/sessions` |

### 单 Agent 模式（默认）

- `agentId` 默认为 **`main`**
- Session 以 `agent:main:<mainKey>` 为键
- Workspace 默认为 `~/.openclaw/workspace`
- 状态默认为 `~/.openclaw/agents/main/agent`

### 路由规则（消息如何选择 Agent）

Bindings 是**确定性**的，**最具体优先**：

1. `peer` 匹配（精确 DM/group/channel id）
2. `parentPeer` 匹配（thread 继承）
3. `guildId + roles`（Discord 角色路由）
4. `guildId`（Discord）
5. `teamId`（Slack）
6. 渠道的 `accountId` 匹配
7. 渠道级别匹配（`accountId: "*"`）
8. 回退到默认 agent（`agents.list[].default`，否则为列表第一项，默认为 `main`）

若同一层级有多个 bindings 匹配，按配置顺序第一个生效。若一个 binding 设置了多个匹配字段，则所有指定字段均需匹配（`AND` 语义）。

### 跨 Agent QMD 记忆搜索

`agents.list[].memorySearch.qmd.extraCollections` 下的额外集合使一个 Agent 能够搜索另一个 Agent 的 QMD session transcript。

### Per-Agent 沙盒和工具配置

每个 Agent 可以拥有自己的沙盒和工具限制：

```json
{
  "sandbox": {
    "mode": "all",     // "off" = 无沙盒，"all" = 始终沙盒化
    "scope": "agent"   // 每个 agent 一个容器
  },
  "tools": {
    "allow": ["exec", "read"],
    "deny": ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"]
  }
}
```

- `tools.elevated` 是**全局**且基于发送者的；不支持 per-agent 配置
- 若需更严格的 gating，使用 `agents.list[].groupChat.mentionPatterns`

---

## 第 6 章：OpenClaw vs Claude Code — 架构对比

### 概述

OpenClaw 和 Claude Code（Anthropic 官方 CLI Agent）都是 AI Agent 框架，都在循环中运行模型并调用工具。然而，它们的架构反映了根本不同的设计哲学。

### 架构对比表

| 维度 | **OpenClaw** | **Claude Code** |
|------|-------------|-----------------|
| **架构类型** | 长驻守护进程 + WebSocket Gateway | 单进程临时调用 |
| **消息集成** | 内置（WhatsApp、Telegram、Discord、Slack、Signal、iMessage 等） | 无原生渠道集成；面向终端设计 |
| **Multi-agent** | 原生 multi-agent，隔离 workspace + bindings | 每次调用单一 agent；无原生 multi-agent 路由 |
| **Plugin 系统** | 完整原生插件系统，包含能力模型、类型化 hook（24+ provider hooks）和槽位架构 | 无公共插件系统；通过外部脚本扩展 |
| **Context Engine** | 可插拔 context engine（legacy + 通过 `plugins.slots.contextEngine` 自定义） | 固定压缩；无公共 context engine API |
| **工具执行** | 通过插件注册表 + agent loop hooks | 模型思考期间使用工具；无插件架构 |
| **渠道/传输** | Gateway 拥有所有消息接入层；Node 通过 WebSocket 连接 | 仅限终端；stdin/stdout |
| **远程访问** | 原生 Tailscale/VPN + SSH 隧道；设备配对 | SSH 到远程机器 |
| **Session 管理** | 按 agentId 的持久化 session + session lane + `SessionManager` | 每次调用临时；对话状态存在磁盘 |
| **压缩** | 内置摘要压缩；通过 context engine 可插拔 | 接近上下文上限时自动压缩 |
| **Hook 系统** | 双 Hook 系统：Gateway hooks + 12+ agent 生命周期插件 hook | 无对应 hook 系统 |
| **能力所有权模型** | 插件作为公司/功能的所有权边界；类型化能力契约 | 不适用 |
| **Subagent 支持** | `sessions_spawn` + `onSubagentEnded` 生命周期 | `claude -0 --dangerously-skip-permissions` 一次性生成进程 |
| **Provider 模型** | 原生 provider 插件（Anthropic、OpenAI、OpenRouter、Google 等） | 直接使用 Anthropic API |

### 关键架构差异

#### 1. Gateway vs 临时进程

**OpenClaw** 以长驻 `Gateway` 守护进程运行，维护持久状态（WhatsApp session、设备配对、渠道连接）。多个客户端通过 WebSocket 连接。守护进程不会因新对话而重启。

**Claude Code** 每次调用作为单一进程运行。每次 `claude` 命令都是全新的开始。长期对话通过写入磁盘上的 `.claude/` 目录来维持。

#### 2. 渠道集成

OpenClaw 的决定性架构选择是**拥有消息接入层**。Gateway 同时连接到 WhatsApp（Baileys）、Telegram（grammY）、Discord、Slack 等。一个 WhatsApp 消息和一个 Telegram 消息可以在同一个 Gateway 进程中路由到不同的 Agent。

Claude Code **没有渠道集成**。它纯粹是一个终端应用。没有等价于 Gateway WebSocket API 的程序化控制接口。

#### 3. Multi-Agent 隔离

OpenClaw 的 multi-agent 系统提供**强隔离**：
- 独立 workspace、auth profile、session store
- 通过确定性 bindings 路由
- Per-agent 沙盒和工具配置

Claude Code **没有 multi-agent 概念**。运行两次 `claude` 得到两个独立进程，除非显式配置（共享项目文件、`.claude/` 状态），否则互不共享。

#### 4. 插件 vs 扩展

OpenClaw 有**正式的插件系统**：
- 类型化能力注册（`registerProvider`、`registerSpeechProvider`、`registerChannel` 等）
- 插件形态（plain-capability、hybrid-capability、hook-only、non-capability）
- 注册模型（中央注册表、单向加载）
- 24+ provider 运行时 hook，实现细粒度控制
- Context engine 槽位，支持自定义 session 管理
- 捆绑插件所有权的契约测试

Claude Code **没有插件系统**。Anthropic 可以添加工具，但外部开发者无法通过公共 API 扩展 Claude Code。Claude Code 的 `--dangerously-skip-permissions` 和 `ALLOWED_PROMPTS` 是配置选项，不是扩展机制。

#### 5. Context Engine

OpenClaw 的 **Context Engine** 是一个可插拔接口，具有四个生命周期点（`ingest`、`assemble`、`compact`、`afterTurn`）加上可选的 subagent 生命周期。第三方引擎可以实现 `ownsCompaction: true` 来完全替换内置摘要。`assemble` 的 `systemPromptAddition` 支持动态 prompt 注入。

Claude Code 的上下文管理是**固定的**：接近上下文限制时自动压缩，`/compact` 作为手动覆盖。没有用于替代上下文策略的公共 API。

#### 6. 设计哲学

| | OpenClaw | Claude Code |
|--|----------|-------------|
| **哲学** | 平台 — 从消息到模型推理，掌控完整技术栈 | 工具 — 成为最好的 CLI 编程助手 |
| **范围** | 广泛：从 WhatsApp 到模型推理 | 狭窄：代码编辑和终端任务 |
| **可扩展性** | 每层都面向可扩展性设计 | 固执己见；Anthropic 控制表面 |
| **目标用户** | 想要跨聊天平台实现自动化的强力用户 | 想要 AI 结对编程的开发人员 |

### 总结

OpenClaw 是一个**AI 消息平台**，恰好使用了 Agent Loop。Claude Code 是一个**AI 编程工具**，恰好使用了 Agent Loop。两者的 Agent Loop 概念上相似（prompt → model → tools → reply），但 OpenClaw 将其包裹在守护进程、多渠道消息总线、正式插件系统和可插拔 context engine 之中——而 Claude Code 保持轻量、专注于终端、并由 Anthropic 直接控制。

---

*来源：`node_modules/openclaw/docs/` 中的 OpenClaw 官方文档*
