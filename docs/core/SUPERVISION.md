落地：Live（supervision-skill.js 已落地，cron 定时任务已建立）
当前版本：v1.0.0
最后更新：2026-03-29

---

# SUPERVISION.md — 监督执行手册

> 本文档是监督 skill 的操作手册，定义如何执行 L3 监督层的日常巡检工作。
> 属于 L3 监督层的执行文档，负责监督 DOC_RULES / CODE_RULES / LEGISLATION / CAPABILITY_LIFE 四个规则文档的执行情况。
> 本文档由 supervision-skill 执行，不监督自身；自身执行保障依赖 cron 定时任务 + 坚果外部验收（L4 元治理约束）。

---

## 一、监督通道

### 1.1 自动化通道（Live 规则）

- **触发**：执行函数运行后自动触发
- **方式**：扫描 `~/.openclaw/workspace/rules-execution-log.jsonl`，对比规则文档，检查一致性
- **记录**：不一致项写入监督问题日志（见 3.1）
- **报告**：异常项实时刷新至 rules-dashboard.md「监督反馈记录」

### 1.2 对话通道（Rule 规则）

- **触发**：监督 skill 定期主动发起（非 AI 自述）
- **方式**：生成对话探针问题，随机抽检 + 针对性提问
- **发送渠道**：webchat + 飞书群
- **记录**：坚果回复后写入监督日志（见 3.2）

---

## 二、执行频率

- **每日定时**：每天执行一次（cron 定时任务触发）
- **报告发送**：每日监督报告发送至 webchat + 飞书群
- **超时保障**：若坚果连续 3 天未收到报告，触发 L4 元治理提醒

---

## 三、存储格式

### 3.1 监督问题日志

文件：`~/.openclaw/workspace/supervision-issues.jsonl`（append-only）

```json
{
  "timestamp": "2026-03-29T10:00:00+08:00",
  "type": "supervision_issue",
  "rule": "核心文档修改必须先授权",
  "issue": "描述问题",
  "source": "live_log|rule_probe",
  "session": "main"
}
```

### 3.2 对话探针记录

```json
{
  "timestamp": "2026-03-29T10:00:00+08:00",
  "type": "dialogue_probe",
  "rule": "SOUL.md 规则X",
  "probe_question": "最近有没有违反这条？",
  "user_reply": "...",
  "conclusion": "pass|fail|uncertain",
  "session": "main"
}
```

---

## 四、每日监督报告格式

```
【监督巡检报告】YYYY-MM-DD

📊 自动化通道
- 近7天执行日志：X条通过，X条异常
- 异常项：[列表]（刷新至 rules-dashboard.md）

🎯 对话通道
- 今日探针：[问题列表]
- 等待坚果回复后记录

🟠 监督问题（来自 rules-dashboard.md）
- [列表]
```

---

## 五、职责边界

- 监督 DOC_RULES.md / CODE_RULES.md / LEGISLATION.md / CAPABILITY_LIFE.md 的执行情况
- 不监督 SUPERVISION.md 自身（自身执行由 cron + L4 外部保障）
- 所有监督记录归档至 memory/YYYY-MM-DD.md

---

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2026-03-29 | 首次建立，定义监督通道、执行频率、存储格式、报告格式 |
