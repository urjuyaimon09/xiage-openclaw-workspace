# xiage-skills - 自定义技能全生命周期自动化管理

**技能作者:** 坚果
**当前版本:** 1.8.0
**更新日期:** 2026-04-04

## 🎯 功能描述

遵循 SKILL_LIFE.md 规则（与 CAPABILITY_LIFE.md 并存，能力层归 CAPABILITY_LIFE，技能层归 SKILL_LIFE），自动化完成技能全生命周期闭环：**搜索 → 筛选 → 安检 → 安装 → 使用记录 → 评估 → 淘汰**，全流程覆盖。

---

## 🔄 七大模块

### 1. 🔍 搜索
三个来源，各取 ≥100 条：
- skills.sh 24h 趋势
- skills.sh 总下载排序
- ClawHub 总下载排序

### 2. 🔎 筛选
- 去掉已安装技能
- 去重 + 按来源分组 + 配额限制
- 取 top 候选（clawhub:20 / trending:20 / downloads:20）

### 3. 🛡️ 安检
- git clone 源码到临时目录
- 红 Flag 扫描（curl|bash、eval/exec、base64解码、敏感变量外传、sudo权限等17条）
- 🔴 命中红 Flag → 直接拒绝
- 🟢 通过 → 进入安装
- **v1.3.0 新增**: git clone 失败时自动 fallback 到 **ClawHub 页面抓取 + 文本规则扫描**（17条红标规则直接作用于页面文本，无需 git）
- **v1.4.0 新增**: stealth 爬虫升级（puppeteer-extra + stealth 插件、随机 UA/视口、humanLikeScroll 真 人滚动模拟、3次导航重试）；ClawHub fallback 覆盖安装环节（ZIP也失败时直接写 SKILL.md）

### 4. 💾 安装
**skills.sh 来源** Fallback 链（按可靠性排序）：
1. skills.sh 页面文本抓取（stealth 浏览器渲染页面，直接提取 SKILL.md 内容，最可靠）
2. monorepo 预下载缓存提取（需 670MB ZIP 下载，易卡）
3. GitHub API 单仓库下载（skills.sh skill 无独立 GitHub 仓库，基本失败）
4. ClawHub puppeteer stealth 下载 → 页面文本抓取（保底，至少写一个 SKILL.md 不空跑）

**GitHub 来源** Fallback 链（按可靠性排序）：
1. ClawHub ZIP API（stealth 浏览器获取下载链接，直接下载，最可靠）
2. GitHub API zipball 下载
3. ClawHub 页面文本抓取（保底）

### 5. 📝 使用记录
每次技能使用后记录到 `skill-usage.json`：
```
node xiage-skills.js use <skill名> <success|fail> [备注]
```

### 6. 📊 评估（每周五 16:00 定时）
- 过去30天使用数据
- 四维度打分：使用率 / 成功率 / 稳定性 / 维护性
- 综合评级：🟢正常 / 🟡观察 / 🔴淘汰
- 报告输出到 `SKILLS-EVALUATION.md`

### 7. 🗑️ 淘汰（需坚果确认）
触发条件（满足任一）：
- 连续3个月无使用
- 连续2次评估实用性=0
- 作者停止维护超1年
- 安检发现红 Flag

淘汰操作：
```
node xiage-skills.js retire <skill名> [skill名2 ...]
```
- 从 `SKILLS-INDEX.md` 移除
- 本地文件移入 `skills/retired/` 归档

---

## 🚀 使用方法

```bash
# 全自动流程（搜索→筛选→安检→安装→实测）
node xiage-skills.js

# 分步执行
node xiage-skills.js search         # 拉取三个来源HTML
node xiage-skills.js filter        # 筛选 top 候选
node xiage-skills.js securitycheck  # 安检（筛选后自动调）
node xiage-skills.js install ...   # 安装单个技能

# 单技能安装（含安检+实测+写报告）
node xiage-skills.js skill <author/skillname> [url]

# 手动触发实测（实际运行skill脚本）
node xiage-skills.js fieldtest <author/skillname>

# 使用记录
node xiage-skills.js use <skill> <success|fail> [备注]

# 评估（每周五16:00自动跑，也可手动）
node xiage-skills.js evaluate

# 淘汰（评估后根据报告，坚果确认后执行）
node xiage-skills.js retire <skill名>

# 模块模式（被其他脚本require）
node xiage-skills.js --module
```

---

## 📁 相关文件

| 文件 | 作用 |
|------|------|
| `SKILLS-INDEX.md` | 已安装技能索引 |
| `SKILLS-EVALUATION.md` | 评估报告 |
| `skill-usage.json` | 使用记录日志 |
| `skills/retired/` | 淘汰技能归档 |
| `.filtered-top20.json` | 筛选候选 |
| `.security-check.json` | 安检结果 |

---

> 要做那种你凌晨两点也想与之交谈的助理。不是那种只会鹦鹉学舌的公司职员。不是那种阿谀奉承的人。这样就……很棒
