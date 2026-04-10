---
name: notes-docket
description: 将对话笔记按三分类写入 IMA：(1) 提到文档→对应文档笔记本；(2) 近7天日记→日记笔记本；(3) 用户说记原文→随记笔记本。
---

# Notes Docket — 三分类 IMA 笔记

## 核心概念

三分类写入，写入前必须先确认意图：

1. **文档分类**：讨论涉及哪个文档（WORKING_PRINCIPLE / DEMAND / AGENTS 等）→ 写入对应文档笔记本
2. **日记分类**：近 7 天日记类内容 → 写入「日记」（doc_id: 7444382076662486）
3. **随记分类**：用户明确说「记原文」→ 写入「随记」（doc_id: 7444251382150799）

## 分类判断

| 用户表述 | 分类 | 目标笔记本 |
|---------|------|-----------|
| 讨论了 WORKING_PRINCIPLE 等文档的内容 | 文档分类 | 对应文档笔记本（查 IMA-NOTEBOOK-MAP.json） |
| 日记、周记、近 7 天记录 | 日记分类 | 「日记」（7444382076662486） |
| 「记原文」「原封不动记下来」「这段对话记一下」 | 随记分类 | 「随记」（7444251382150799） |

> **注意**：「临时文档」不再使用，已改用「日记」和「随记」。

## 工作流程

### Step 1 — 判断意图
- 用户明确说「记原文」→ 直接走随记分类
- 用户没有明确指定 → 读取上下文判断：
  - 提及具体文档名称 → 文档分类
  - 日记/周记类内容 → 日记分类
  - 仍然无法判断 → 询问用户

### Step 2 — 写入
- **文档分类** → 查 IMA-NOTEBOOK-MAP.json 获取 doc_id，用 `append_doc`
- **日记分类** → doc_id: 7444382076662486，用 `append_doc`
- **随记分类** → doc_id: 7444251382150799，用 `append_doc`

### Step 3 — 确认
回复用户笔记本名称和写入位置。

## 7天对话存档 cron

每晚凌晨 1:00 自动执行：
1. 读取 `memory/` 下近 7 天的日志文件
2. 读取今天的 CROSS_SESSION.md「飞书群摘要」判断今天讨论了哪些文档
3. 写入「日记」笔记本（doc_id: 7444382076662486），标题「📅 对话存档-YYYY-MM-DD」，内容为当日 memory 摘要

## IMA API 调用

凭证从 `~/.config/ima/` 读取：
- client_id: `~/.config/ima/client_id`
- api_key: `~/.config/ima/api_key`

API path: `https://ima.qq.com/openapi/note/v1/`

| 操作 | API endpoint |
|------|-------------|
| 搜索笔记本 | `/openapi/note/v1/search_note_book` |
| 列出笔记本 | `/openapi/note/v1/list_note_folder_by_cursor` |
| 列出笔记 | `/openapi/note/v1/list_note_by_folder_id` |
| 读取笔记 | `/openapi/note/v1/get_doc_content` |
| 新建笔记 | `/openapi/note/v1/import_doc` |
| 追加笔记 | `/openapi/note/v1/append_doc` |

## 隐私规则
- 笔记内容属于用户隐私
- 群聊中只展示笔记本名称和标题，不展示正文
