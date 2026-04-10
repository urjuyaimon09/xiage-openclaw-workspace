# demand-review SKILL

落地：Rule
当前版本：v1.2.0

---

## 概述

需求模型执行 Skill。按 DEMAND_MODEL.md 定义的规则，从输入到输出完整运行需求生成流程。

**核心流程（v1.1.0 新版）：**

```
坚果周五晚上 → 更新输入（USER.md / 现状）
  → 周六凌晨 → demand-review run --base
    → 生成 DEMAND-YYYY-MM-DD.md（未审批状态）
    → 头部增加「本次更新说明」章节
    → 标注：需审批 / 告知 / 不审批
  → 坚果审批 → 状态改为「已审批」
  → 进入下一模型（Phase 3）
```

---

## 使用方式

```bash
node demand-review.js run          # 完整模式（首次使用，不基于旧版）
node demand-review.js run --base   # 增量模式（基于上一版，生成变更说明）
node demand-review.js dry-run       # 预演，不写入文件
node demand-review.js validate     # 验证当前 DEMAND.md 字段完整性
node demand-review.js summary      # 打印当前需求统计
```

---

## 输入

| 文件 | 位置 | 说明 |
|------|------|------|
| `USER.md` | `docs/core/` | 坚果客观信息，由坚果周五晚上更新 |
| `CAPABILITY_LIFE.md` | `docs/core/` | 虾哥能力现状 |
| 当前需求清单 | `docs/business/DEMAND.md` | 参考已有需求状态 |
| skill-usage | `skills/xiage-skills/metadata/` | 近期技能使用情况 |
| SKILL-FIELD-TESTS | `skills/xiage-skills/metadata/` | 近期实测边界变化 |

---

## 输出

| 文件 | 说明 |
|------|------|
| `DEMAND-INPUT-YYYY-MM-DD.md` | 输入存档（每次运行新建，不覆盖） |
| `DEMAND-YYYY-MM-DD.md` | 需求清单（带日期版本，未审批状态） |
| `DEMAND.md` | 当前生效版本（覆盖写入） |

---

## 增量模式详解

`run --base` 是推荐的标准执行方式：

1. 查找最新一版 `DEMAND-YYYY-MM-DD.md`
2. 对比新旧需求条目，生成变更说明
3. 在头部自动写入「本次更新说明」章节，包含：
   - 新增条目
   - 重要度变更条目
4. 标注审批状态

---

## 审批状态

| 状态 | 含义 |
|------|------|
| 需审批 | 有重要变更，需要坚果确认后生效 |
| 告知 | 已更新，坚果知晓即可 |
| 不审批 | 例行更新，无需干预 |

坚果审批后，需求清单进入下一模型的正式输入。

---

## 依赖

- Node.js（内置模块，无外部依赖）
