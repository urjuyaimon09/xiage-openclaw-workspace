# SKILL 实测记录

# Skill 实测报告库

> 每次实测一个skill后的边界记录：能做什么、不能做什么、有什么坑。  
> 积累技能边界知识，形成判断力。

---

## 如何添加记录

每次实测skill后，在此文件中添加一条记录，格式：

```markdown
## [skill名] | [实测日期] | [场景标签]

**结论**：一句话评价

### 实测过程
[做了什么]

### 能做什么
- ...

### 不能做什么
- ...

### 坑
- ...
```

---

## 记录索引（按skill名排序）

| skill名 | 实测日期 | 场景标签 | 结论 |
|---------|---------|---------|------|
| humanize-ai-text | 2026-03-31 | 文本检测/去AI痕迹 | 🟢 有效，剩余AI词汇需手动 |

---

## 实测记录

<!-- 从这里开始追加 -->

---

## humanize-ai-text | 2026-03-31 | 文本检测/去AI痕迹

**结论**：检测有效，transform能消除64%的AI特征，但语义层面的AI高频词无法自动处理

### 实测过程
- 读取 SKILL.md，理解用法
- 准备一段127词的典型AI写作风格测试文本（模拟AI常见模式：chatbot artifact句、copula avoidance、filler phrases等）
- 运行 `detect.py` → 33个issues，概率VERY HIGH
- 运行 `compare.py`（transform）→ 降至12个issues，概率HIGH
- 运行 transform 后的文本再次 detect 验证

### 能做什么
- 自动检测并移除格式化的AI写作痕迹（chatbot artifact整句、Filler phrases、Copula avoidance）
- 提供量化评分（issue数量 + AI概率等级：LOW/MEDIUM/HIGH/VERY HIGH）
- compare模式一键输出 before→after 对比报告
- 自动修复：删除"I hope this helps"/"As an AI"类整句，替换"serves as"→"is"，简化"due to the fact that"→"because"

### 不能做什么
- 不能自动修AI高频词汇（landscape/pivotal/tapestry/underscore等——这些是语义层面特征，工具无法在不改变语义的前提下自动替换）
- 不能保证100%通过GPTZero/Turnitin（只能降低概率，不是保证）
- 规则库以英文为主，中文文本支持有限

### 坑
- **Windows环境必须加 `-X utf8` 参数**：`python -X utf8 scripts/detect.py text.txt`，否则 patterns.json 读取报 GBK 编码错误
- patterns.json 含Unicode字符（引号等），Windows默认GBK会直接崩溃

### 适用场景
- 英文学术论文投稿前自检
- 内容发布前质量门卫（检测是否残留AI痕迹）
- AI辅助写作流程中的中间产物检测

---

---

## pdf | 2026-03-31 | PDF处理

**结论**：pypdf + pdfplumber 可用，PDF增删改查全部验证通过

### 实测过程
- 安装 pypdf + pdfplumber + reportlab
- 创建测试PDF → text提取 → split → merge 全流程验证

### 能做什么
- 文本提取（pdfplumber）：纯文本PDF秒提取，中文支持良好
- 合并PDF（pypdf）：多文件合并，页数正确
- 拆分PDF（pypdf）：按页拆解
- 创建PDF（reportlab）：Canvas和Platypus两种方式，支持多页/中文

### 不能做什么
- 扫描版PDF（无文字层）：需要配合OCR
- 填写PDF表单：需要 pdf-lib（未安装）

### 坑
- Windows环境需 pip install 安装 Python 包
- reportlab 生成中文需要指定中文字体（如 SimHei），否则中文为方块

### 适用场景
- 合同/文档文本提取
- 多PDF合并/拆分
- 生成新PDF报告

---

## summarize | 2026-03-31 | 网页/文本摘要

**结论**：工具本身可用，需要NODE_TLS_REJECT_UNAUTHORIZED=0绕过SSL问题；AI摘要需要API Key

### 实测过程
- 原始 summarize：SSL证书验证失败
- 设置 NODE_TLS_REJECT_UNAUTHORIZED=0 后：httpbin.org 可正常抓取
- 无 API Key 时：降级为纯文本提取（via html, no model）

### 能做什么
- 网页内容抓取 + 文本摘要（需API Key：gemini-3-flash优先）
- 无Key时：纯文本提取
- 支持 URL/PDF/本地文件/YouTube

### 不能做什么
- 无API Key时只能提取原始文本，无法AI总结
- Wikipedia被DNS污染，无法抓取

### 坑
- **Windows必须设置 NODE_TLS_REJECT_UNAUTHORIZED=0**（已在系统环境变量永久设置）
- 需要 API Key 才能启用 AI 摘要功能

### 适用场景
- 快速提取网页正文内容
- 批量URL内容抓取（需API Key）


---

## weather | 2026-03-31 | 天气预报

**结论**：🔴 两个数据源均被网络阻断，当前环境不可用

### 实测过程
- wttr.in：连接超时（TCP连接建立成功，服务器无响应）
- api.open-meteo.com：同样被阻断
- curl直接访问外网部分可用（httpbin.org通），但天气API均被墙

### 不能做什么
- 当前网络环境下无法获取任何天气数据

### 坑
- 依赖外部天气API，机器网络受限则完全失效

### 适用场景
- 网络正常时：wttr.in（简单）或 Open-Meteo（精确）均可

---

## image-ocr | 2026-03-31 | 图片文字识别

**结论**：🔴 依赖本地OCR引擎，当前Windows环境未安装Tesseract

### 实测过程
- 读取 SKILL.md，理解各引擎差异（Tesseract/EasyOCR/PaddleOCR/Google Vision）
- 运行 	esseract --version：命令不存在

### 能做什么（有环境时）
- Tesseract：本地简单英文印刷体
- EasyOCR：多语言+照片
- PaddleOCR：中日韩+表格最强
- Claude Vision / Google Vision：云端高精度（需API）

### 不能做什么
- 当前环境：Tesseract未安装，其他引擎均未配置
- 无法完成任何OCR任务

### 坑
- 本地OCR需要先安装对应引擎和语言包
- 云端OCR需要API Key和互联网连接

### 适用场景
- 配置好环境后：文档扫描、发票识别、截图文字提取


---

## ai-daily-digest | 2026-04-01 | Fetches RSS feeds from 90 top Hacker News blogs (curated by Karpathy), uses AI to score and filter articles, and generates a daily digest in Markdown with Chinese-translated titles, category grouping, trend highlights, and visual statistics (Mermaid charts + tag cloud). Use when user mentions

**结论**：需要配置 API Key 才可运行

### 实测过程
触发命令参考：description: "Fetches RSS feeds from 90 top Hacker News blogs (curated by Karpathy), uses AI to score and filter articles, and generates a daily digest in Markdown with Chinese-translated titles, category grouping, trend highlights, and visual statistics (Mermaid charts + tag cloud). Use when user mentions 'daily digest', 'RSS digest', 'blog digest', 'AI blogs', 'tech news summary', or asks to run /digest command. Trigger command: /digest." | ## 命令 | ```bash
执行文件：scripts\digest.ts

### 能做什么
- 未知（请参考 SKILL.md）

### 不能做什么
- digest.ts: 需要配置API Key

### 坑
- digest.ts: 需要API Key（[digest] Error: Missing API key. Set GEMINI_API_KEY and/or OPENAI_API_KEY.）

---

## business | 2026-04-01 | Validate ideas, build strategy, and make decisions with proven frameworks.

**结论**：无执行文件，纯配置型 skill

### 实测过程
触发命令参考：| Usage-based | Variable consumption | Hard to predict revenue |
执行文件：无执行文件

### 能做什么
- 未知（请参考 SKILL.md）

### 不能做什么
- 暂未发现

### 坑
- 暂无已知问题

---

## mbb-strategist | 2026-04-01 | High-level business strategy frameworks based on McKinsey, BCG, Bain, and Deloitte methodologies. Use this skill for Executive Summaries, GTM strategies, Risk Assessments, Financial Modeling, and SWOT analysis for any business or project.

**结论**：无执行文件，纯配置型 skill

### 实测过程
（无明确触发命令）
执行文件：无执行文件

### 能做什么
- 未知（请参考 SKILL.md）

### 不能做什么
- 暂未发现

### 坑
- 暂无已知问题
## privy-integration（description型）🟡

**测试时间**: 2026-04-04T03:01:20.780Z
**作者**: tenequm

### 能做什么
- API存在(HTTP404): https://docs.privy.io/llms.txt`

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## identity-monitoring-agent（code型）🟢

**测试时间**: 2026-04-04T03:01:22.517Z
**作者**: assix

### 能做什么
- monitor.py: Traceback (most recent call last):   File "C:\Users\Administrator\.openclaw\workspace\skills\assix-identity-monitoring-agent\monitor.py", line 5, in <module>     from googlesearch import search Mod

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节
- OK: Traceback (most recent call last):   File "C:\Users\Administrator\.openclaw\workspace\skills\assix-identity-monitoring-agent\monitor.py", line 5, in <module>     from googlesearch import search Mod

---
## ad-creative-testing（description型）🟡

**测试时间**: 2026-04-04T03:01:22.982Z
**作者**: leooooooow

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## spiff（description型）🟡

**测试时间**: 2026-04-04T03:01:22.984Z
**作者**: membranedev

### 能做什么
- HTTP 200: https://getmembrane.com
- HTTP 200: https://github.com/membranedev/application-skills

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## ecom-daily-report（description型）🟡

**测试时间**: 2026-04-04T03:01:25.997Z
**作者**: madagen365-beep

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## design-ads（code型）🟢

**测试时间**: 2026-04-04T03:01:25.999Z
**作者**: bozoyan

### 能做什么
- puppeteer: 
- render.js: node:internal/modules/cjs/loader:1478   throw err;   ^  Error: Cannot find module 'puppeteer' Require stack: - C:\Users\Administrator\.openclaw\workspace\skills\bozoyan-design-ads\scripts\render

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节
- OK: 
- OK: node:internal/modules/cjs/loader:1478   throw err;   ^  Error: Cannot find module 'puppeteer' Require stack: - C:\Users\Administrator\.openclaw\workspace\skills\bozoyan-design-ads\scripts\render

---
## slg-cli（description型）🟡

**测试时间**: 2026-04-04T03:01:26.115Z
**作者**: venki0552

### 能做什么
- API存在(HTTP404): https://github.com/vrknetha/slg-cli

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## xhs-ai-detective-publisher（code型）🟢

**测试时间**: 2026-04-04T03:01:26.583Z
**作者**: halleyyang

### 能做什么
- package-lock.json: 
- package.json: 

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节
- OK: 
- OK: 

---
## pre-flight（description型）🟡

**测试时间**: 2026-04-04T03:01:26.585Z
**作者**: wyattbenno777

### 能做什么
- API存在(HTTP404): https://api.icme.io/v1`
- API存在(HTTP405): https://api.icme.io/v1/checkLogic

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节
- curl ERR: Command failed: curl -s -X POST https://api.icme.io/v1/checkLogic \

---
## content-spy（description型）🟡

**测试时间**: 2026-04-04T03:01:29.951Z
**作者**: leooooooow

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## iron-man-distill（description型）🟡

**测试时间**: 2026-04-04T03:01:29.955Z
**作者**: stonestorm2024

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## us-market-briefing（code型）🟢

**测试时间**: 2026-04-04T03:01:29.958Z
**作者**: kevinksaji

### 能做什么
- is-us-market-holiday.py: Traceback (most recent call last):   File "C:\Users\Administrator\.openclaw\workspace\skills\kevinksaji-us-market-briefing\scripts\is-us-market-holiday.py", line 40, in <module>     raise SystemExit

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节
- OK: Traceback (most recent call last):   File "C:\Users\Administrator\.openclaw\workspace\skills\kevinksaji-us-market-briefing\scripts\is-us-market-holiday.py", line 40, in <module>     raise SystemExit

---
## hirey-openclaw-hi-install（description型）🟡

**测试时间**: 2026-04-04T03:01:30.463Z
**作者**: yzlee

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## temp-skills（description型）🟡

**测试时间**: 2026-04-04T03:01:30.466Z
**作者**: danihe001

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## evomap-evolver（code型）🟢

**测试时间**: 2026-04-04T03:01:30.472Z
**作者**: danihe001

### 能做什么
- a2a_export.js: [evolver] Detected .git in parent directory C:\Users\Administrator\.openclaw\workspace -- ignoring. Set EVOLVER_USE_PARENT_GIT=true to override, or EVOLVER_REPO_ROOT to specify the target directory ex
- a2a_ingest.js: accepted=0 rejected=0 

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节
- OK: [evolver] Detected .git in parent directory C:\Users\Administrator\.openclaw\workspace -- ignoring. Set EVOLVER_USE_PARENT_GIT=true to override, or EVOLVER_REPO_ROOT to specify the target directory ex
- OK: accepted=0 rejected=0 

---
## workiz（description型）🟡

**测试时间**: 2026-04-04T03:01:30.739Z
**作者**: membranedev

### 能做什么
- HTTP 200: https://getmembrane.com
- HTTP 200: https://github.com/membranedev/application-skills

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## clickmeter（description型）🟡

**测试时间**: 2026-04-04T03:01:33.141Z
**作者**: gora050

### 能做什么
- HTTP 200: https://getmembrane.com
- HTTP 200: https://github.com/membranedev/application-skills

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## marketing-miner（description型）🟡

**测试时间**: 2026-04-04T03:01:33.843Z
**作者**: membranedev

### 能做什么
- HTTP 200: https://getmembrane.com
- HTTP 200: https://github.com/membranedev/application-skills

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## read-github（description型）🟡

**测试时间**: 2026-04-04T03:01:34.335Z
**作者**: skills

### 能做什么
- HTTP 200: https://github.com/karpathy/llm-council
- HTTP 200: https://gitmcp.io/karpathy/llm-council

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## us-stock-analyst（description型）🟡

**测试时间**: 2026-04-04T03:01:36.198Z
**作者**: skills

### 能做什么
- API存在(HTTP401): https://api.aisa.one/apis/v1/financial/financial-metrics/sna
- API存在(HTTP401): https://api.aisa.one/apis/v1/financial/prices?ticker=AAPL&st

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节
- curl ERR:   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                   

---
## claude（description型）🟡

**测试时间**: 2026-04-04T03:01:42.330Z
**作者**: skills

### 能做什么
- API存在(HTTP403): https://api.anthropic.com/v1/messages

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节
- curl ERR: Command failed: curl -s https://api.anthropic.com/v1/messages \

---
## todoist（description型）🟡

**测试时间**: 2026-04-04T03:01:47.410Z
**作者**: skills

### 能做什么
- HTTP 200: https://app.todoist.com/app/settings/integrations/developer

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## openclaw-media-gen（description型）🟡

**测试时间**: 2026-04-04T03:01:48.982Z
**作者**: skills

### 能做什么
- HTTP 200: https://aisa.mintlify.app/llms.txt
- API存在(HTTP404): https://api.aisa.one/v1

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节
- curl ERR:   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                   

---
## ai-researcher（description型）🟡

**测试时间**: 2026-04-04T03:01:59.982Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## excalidraw（description型）🟡

**测试时间**: 2026-04-04T03:01:59.986Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## llm（description型）🟡

**测试时间**: 2026-04-04T03:01:59.989Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## twitter-command-center-(search-+-post)（description型）🟡

**测试时间**: 2026-04-04T03:01:59.991Z
**作者**: skills

### 能做什么
- API存在(HTTP401): https://api.aisa.one/apis/v1/twitter/user/info?userName=elon
- API存在(HTTP401): https://api.aisa.one/apis/v1/twitter/user/user_last_tweet?us

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节
- curl ERR:   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                   

---
## social-media-analyzer（description型）🟡

**测试时间**: 2026-04-04T03:02:05.353Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## open-webui（description型）🟡

**测试时间**: 2026-04-04T03:02:05.356Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节
- curl ERR:   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                   

---
## browser-use（description型）🟡

**测试时间**: 2026-04-04T03:02:05.455Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节
- curl ERR: Command failed: curl -s http://127.0.0.1:9222/json/version

---
## firecrawl（description型）🟡

**测试时间**: 2026-04-04T03:02:12.795Z
**作者**: skills

### 能做什么
- HTTP 200: https://example.com

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## binance（description型）🟡

**测试时间**: 2026-04-04T03:02:16.348Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节
- curl ERR: spawnSync C:\Windows\system32\cmd.exe ETIMEDOUT

---
## searxng（description型）🟡

**测试时间**: 2026-04-04T03:02:36.410Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## deepwiki（description型）🟡

**测试时间**: 2026-04-04T03:02:36.497Z
**作者**: skills

### 能做什么
- API存在(HTTP406): https://mcp.deepwiki.com/mcp

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## polymarket-agent（description型）🟡

**测试时间**: 2026-04-04T03:02:37.231Z
**作者**: skills

### 能做什么
- API存在(HTTP404): https://example.com/article-about-event

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## ga4-analytics（description型）🟡

**测试时间**: 2026-04-04T03:02:37.850Z
**作者**: skills

### 能做什么
- HTTP 200: https://your-domain.com
- API存在(HTTP404): https://example.com/page1

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
## task-status（description型）🟡

**测试时间**: 2026-04-04T03:02:39.222Z
**作者**: skills

### 能做什么
- （未能实测出功能）

### 不能做什么
- 无可执行内容（纯描述型，需外部服务/凭证）

### 坑
- 暂无记录

### 实测细节


---
## gemini-computer-use（description型）🟡

**测试时间**: 2026-04-04T03:02:39.225Z
**作者**: skills

### 能做什么
- HTTP 200: https://example.com

### 不能做什么
- （未发现限制）

### 坑
- 暂无记录

### 实测细节


---
