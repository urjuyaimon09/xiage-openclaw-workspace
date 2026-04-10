# openclaw-agent-manager

> OpenClaw 子 Agent 生命周期管理系统
>
> **技能作者:** 虾哥
> **当前版本:** v0.1.0
> **更新日期:** 2026-04-06
> **落地状态:** Live

---

## 概述

Claude Code 的 AgentTool 的完整复刻，用 `sessions_spawn` 实现 7 种执行模式和 4 种输出状态。

**本质：** 通过 skill 层封装 `sessions_spawn`，统一管理所有子 Agent 的启动、监控、回收。

---

## 目录结构

```
openclaw-agent-manager/
├── SKILL.md              ← 本文档
├── registry.js          ← Agent 发现、注册、类型路由
├── executor.js          ← 7 种执行模式调度器
├── timeout-monitor.js    ← 120s 超时自动后台化监控
├── lifecycle.js         ← 生命周期管理（四种输出状态）
└── agents/              ← Agent 定义文件（JSON）
    ├── general-purpose.json   ← 全能型
    ├── read-only-explore.json ← 只读探索型
    ├── planner.json           ← 规划型
    └── code-guide.json       ← 使用问答型
```

---

## 内置 Agent 类型

| 类型 | 危险等级 | 工具范围 | 超时 |
|------|---------|---------|------|
| `general-purpose` | 🔴 HIGH | 所有工具 | 600s |
| `read-only-explore` | 🟢 LOW | Read/Grep/Glob/WebSearch/WebFetch | 300s |
| `planner` | 🟢 LOW | 只读 + plan | 600s |
| `code-guide` | ⚪ NONE | Read/Grep/WebSearch | 120s |

---

## 7 种执行模式

| 模式 | 触发 | OpenClaw 实现 | 状态 |
|------|------|-------------|------|
| 同步前台 | 默认 | `mode: run` + 等待结果 | ✅ |
| 异步后台 | `mode: async` | `mode: run` + announce | ✅ |
| 120s 自动后台 | 超时自动 | `timeout-monitor.js` cron | ✅ |
| Worktree 隔离 | `mode: worktree` | 临时目录隔离 | ✅ |
| 远程执行 | `mode: remote` | 不支持 | ❌ |
| Fork 模式 | `mode: fork` | 继承父上下文片段 | ✅ |
| Teammate 模式 | `mode: teammate` | `mode: session` 持久 session | ✅ |

---

## 四种输出状态

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `completed` | 执行成功完成 | exitCode === 0 |
| `async_launched` | 已启动（异步） | 立即返回 sessionId |
| `failed` | 执行失败 | exitCode !== 0 |
| `timed_out` | 执行超时被终止 | ageMs > 超时阈值 |

---

## 触发方式

```
skill: openclaw-agent-manager
input:
{
  "agentType": "read-only-explore",
  "task": "搜索项目中所有包含关键词 xxx 的文件",
  "mode": "async",
  "timeout": 120,
  "description": "搜索关键词 xxx"
}
```

---

## 执行流程

```
1. 主 Agent 判断「需要子 Agent」
2. 主 Agent 调用 openclaw-agent-manager skill
3. registry.js 验证 agent 类型 + 配置合法性
4. executor.js 根据 mode 路由到对应执行函数
5. sessions_spawn 发起子 session
6. lifecycle.js 监控状态变化
7. 超时 → timeout-monitor.js 触发后台化 → announce 通知
8. 执行完成 → cleanup 删除 session
```

---

## 安全护栏

### 高危险等级 agent（general-purpose）

| 限制 | 规则 |
|------|------|
| `cleanup` | 禁止 `keep`，必须是 `delete` |
| Fork 模式 | 禁止跨任务继承 |
| 超时 | 必须 ≤ 600s |

### 只读型 agent（read-only / planner / code-guide）

| 限制 | 规则 |
|------|------|
| 工具 | 禁止 Write / Edit / Delete / Bash |
| cleanup | 默认 `delete` |

### Teammate 模式

| 限制 | 规则 |
|------|------|
| 危险等级 HIGH | 禁止使用 `cleanup=keep` |
| 超时 | 必须设 `runTimeoutSeconds` |
| cleanup | 必须 `delete`，禁止永驻 |

---

## registry.js 接口

```javascript
const { getAgent, listAgents, validateAgentConfig, buildSpawnParams } = require('./registry');

// 获取 agent 定义
const agent = getAgent('read-only-explore');

// 列出所有可用 agent
const agents = listAgents();

// 验证配置合法性
const result = validateAgentConfig(agent);
// { valid: true/false, errors: [...] }

// 构建 sessions_spawn 标准参数
const params = buildSpawnParams(agent);
// { mode: 'run', cleanup: 'delete', runTimeoutSeconds: 300, sandbox: 'require' }
```

---

## executor.js 接口

```bash
# 列出所有 agent
node executor.js list

# 验证 agent 配置
node executor.js validate general-purpose

# 启动子 agent（异步）
node executor.js spawn read-only-explore "搜索项目中的配置文件" --mode async

# 启动子 agent（Worktree 隔离）
node executor.js spawn general-purpose "修改配置文件" --mode worktree

# 启动子 agent（Fork 模式）
node executor.js spawn general-purpose "分析当前项目" --mode fork --parent-context <sessionId>
```

---

## timeout-monitor.js 接口

```bash
# 检查单个 session 是否超时
node timeout-monitor.js check <sessionId> 120000

# 启动定时监控循环
node timeout-monitor.js watch 30000
```

---

## lifecycle.js 接口

```javascript
const { getLifecycleStatus, killSession, collectResult, cleanupZombies } = require('./lifecycle');

// 获取 session 状态
const status = await getLifecycleStatus(sessionId);
// { status: 'running', ageMs: 45000, exitCode: null }

// 终止 session
await killSession(sessionId);

// 收集执行结果
const result = await collectResult(sessionId);
// { status: 'completed', result: '...', ageMs: 12000 }

// 清理所有 zombie sessions
await cleanupZombies(['sessionId1', 'sessionId2']);
// { cleaned: 5 }
```

---

## 设计原则

1. **安全第一** — HIGH 危险等级 agent 强制 `cleanup=delete`，禁止永驻
2. **超时保护** — 每个 agent 必须设超时，超时自动后台化
3. **最小权限** — 优先使用 `read-only` 类型，危险操作才用 `general-purpose`
4. **资源清理** — 所有 session 执行完毕后必须删除，不积累 zombie sessions

---

*最后更新：2026-04-06*
