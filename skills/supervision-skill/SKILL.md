# supervision-skill — 监督巡检执行器

**技能作者：** 虾哥
**当前版本：** v1.0.0
**更新日期：** 2026-03-29
**落地状态：** Pending → supervision-skill

---

## 🎯 功能描述

执行 L3 监督层的日常巡检工作，包括：
- **自动化通道**：扫描执行日志，对比规则文档检查一致性
- **对话通道**：生成 Rule 规则探针问题，等待坚果回复
- **报告发送**：每日报告发送至 webchat + 飞书群

---

## 🔄 核心函数

### 主执行：`supervision-skill.js`

```bash
node skills/supervision-skill/supervision-skill.js [mode]

Modes:
  report   # 生成并发送每日监督报告（默认）
  check   # 仅扫描执行日志，不发报告
  probe   # 仅生成对话探针
```

### 输出结构

```javascript
{
  "report": "【监督巡检报告】2026-03-29\n📊 ...",
  "execResult": { "pass": 5, "fail": 1, "total": 6, "issues": [...] },
  "probes": [{ "rule": "...", "question": "..." }]
}
```

---

## 📋 触发方式

**Cron 定时任务**：每日 09:00（Asia/Shanghai）

Job ID：`52abc7de-2371-4c97-9122-6a0ff30fc83a`

---

## 📁 相关文件

- 执行脚本：`skills/supervision-skill/supervision-skill.js`
- 执行日志：`~/.openclaw/workspace/rules-execution-log.jsonl`
- 监督问题日志：`~/.openclaw/workspace/supervision-issues.jsonl`
- 规则文档：`SUPERVISION.md`

---

## ⚙️ 设计说明

1. 监督 skill 不监督自身；自身执行由 cron 定时任务保证
2. 对话探针每次随机选 2 条，避免千篇一律
3. 坚果回复后，记录入 `supervision-issues.jsonl` 归档
