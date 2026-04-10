# parallel-tool-executor - 并行工具执行器

**技能作者:** 虾哥
**当前版本:** 0.4.0
**更新日期:** 2026-04-05
**落地状态:** Live

---

## 🎯 功能描述

将多个独立的工具调用分发给并行的子 agent 执行，模拟进程级并发。

**本质：** 用 OpenClaw 的 `sessions_spawn` 架构做「工具级并发」。

---

## 📋 触发方式

当需要并行执行≥2个独立的 read-only 工具调用时，**必须**调用此 skill。

```
skill: parallel-tool-executor

input:
{
  "tools": [
    { "tool": "Read", "params": { "path": "fileA.txt" } },
    { "tool": "Read", "params": { "path": "fileB.txt" } }
  ],
  "description": "读取配置文件A和B"
}
```

---

## 🔄 执行流程

```
1. 主 Agent 判断「需要并行读取≥2个文件」
2. 主 Agent 调用 parallel-tool-executor skill
3. executor.js 验证工具列表，按并发安全性分区
4. executor.js 输出可直接执行的 sessions_spawn 指令
5. 主 Agent 按指令并行 spawn 子 agent（不多想，直接执行）
6. 主 Agent 收集结果，汇总返回
7. 主 Agent 主动 kill 已完成的子 session
```

---

## 📦 executor.js 输出格式

executor.js 输出可直接执行的 sessions_spawn 指令列表，主 agent **照做即可**，不需要二次理解：

```json
{
  "type": "parallel-execution",
  "description": "读取配置文件A和B",
  "maxConcurrency": 5,
  "instructions": [
    {
      "taskId": "tool-0",
      "sessions_spawn": {
        "task": "请执行工具 Read(path: \"fileA.txt\")，只返回执行结果，不需要解释。",
        "label": "tool-0",
        "mode": "run"
      }
    },
    {
      "taskId": "tool-1",
      "sessions_spawn": {
        "task": "请执行工具 Read(path: \"fileB.txt\")，只返回执行结果，不需要解释。",
        "label": "tool-1",
        "mode": "run"
      }
    }
  ],
  "aggregation": {
    "type": "merge-results",
    "description": "等待所有子 agent 完成后，按 taskId 匹配汇总结果，返回结构化输出"
  }
}
```

**主 agent 执行规则：**
1. 严格按照 `instructions` 列表并行 spawn，所有 spawn 完成后才继续
2. 结果按 `taskId` 匹配，汇总为结构化输出
3. **所有子 session 使用完毕后必须主动 kill 释放**
4. 如果任何子 session 执行失败，在汇总中标注 `taskId: error`

---

## ⚠️ 限制与注意事项

1. **强制执行**：触发条件满足时必须调用，不得跳过
2. **子 session 必须释放**：结果返回后立即 `subagents kill`，不积累 zombie session
3. **只用于 read-only**：写操作（Edit/Write/Delete/Move）禁止使用此 skill
4. **结果顺序不确定**：按 taskId 匹配，不依赖返回顺序

---

## 🔧 并发安全工具定义（可并行）

| 工具 | 是否可并行 |
|------|-----------|
| Read | ✅ |
| Glob | ✅ |
| Grep | ✅ |
| WebSearch | ✅ |
| WebFetch | ✅ |
| Bash（读命令） | ✅ |
| Edit | ❌ |
| Write | ❌ |
| Bash（写命令） | ❌ |
| Move | ❌ |
| Delete | ❌ |

---

## 🧹 Session 清理工具

**用途：** 清理 zombie subagent sessions，释放 sessions.json 和 subagents/runs.json

```
skill: parallel-tool-executor
action: cleanup
```

**清理内容：**
1. 从 `sessions.json` 删除所有含 `subagent:` 的 entry
2. 清空 `subagents/runs.json`（下次 gateway 重启后生效）

**Dry-run 预览（不实际修改）：**
```
skill: parallel-tool-executor
action: cleanup
dryRun: true
```

**触发时机：**
- **每次并行任务收尾时**（强制）：子 session 全部完成并 kill 后，主 agent 必须调用 cleanup
- 子 session 累积超过 10 个时（兜底检查）

**注意：** `subagents/runs.json` 清空需要 `openclaw gateway restart` 才能让 in-memory subagentRuns Map 刷新。只清理 sessions.json 时无需重启，立即生效。

---

## 📌 设计原则

1. **主 agent 零理解成本**：executor 输出直接可执行，主 agent 照做即可
2. **强制触发**：≥2个 read-only 并行时必须调用，写操作禁止
3. **用完即释放**：子 session 完成后 → kill → 调用 cleanupSessions 清理 sessions.json

---

*最后更新：2026-04-05*
