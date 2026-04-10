# 技能库索引 - 虾哥

## 能力地图字段说明

本文件为虾哥技能能力地图，记录所有已安装技能的**结构化能力信息**。

### 主索引表字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 短名 | 调用时的简称 | `pdf` |
| 完整目录 | skills/ 下的目录名 | `pdf` |
| 作者 | 技能作者 | `steipete` |
| 能力类型 | 核心能力：提取/生成/分析/执行/转换/监控 | `提取` |
| 触发场景 | 遇到什么问题时该用 | `PDF内容提取/表单填写` |
| 能力边界 | 不能处理什么 | `不支持手写体`、`需要API Key` |
| 组合推荐 | 适合与哪些skill串联 | `→ocr→summarize` |
| 实测状态 | 最近一次实测时间+结果 | `2026-03-31 🟢` |
| 可用性 | 🟢正常/🟡待测/🔴失效 | `🟢` |
| 描述 | 原始描述（来自SKILL.md） | `PDF Processing Guide` |

> **新增字段**：能力类型/触发场景/能力边界/组合推荐/实测状态/可用性——随每日实测逐步填充。

---

## 主索引表

| 短名 | 完整目录 | 作者 | 能力类型 | 触发场景 | 能力边界 | 组合推荐 | 实测状态 | 可用性 | 描述 |
|------|---------|------|---------|---------|---------|---------|---------|---------|------|
| humanizer | openclaw-humanizer | openclaw | 转换 | AI文本去检测痕迹 | 不修语义层面AI词汇 | - | - | 🟡 | AI 文本人类化 skill |
| todo | openclaw-todo | openclaw | 执行 | 待办事项管理 | - | - | - | 🟡 | Todo 待办管理 |
| senior-backend | openclaw-senior-backend | openclaw | 生成 | 后端架构设计 | - | - | - | 🟡 | Senior backend developer skill |
| senior-devops | openclaw-senior-devops | openclaw | 生成 | DevOps架构设计 | - | - | - | 🟡 | Senior DevOps engineer skill |
| calendar | openclaw-calendar | openclaw | 提取 | 日历事件管理 | - | - | - | 🟡 | 日历管理 skill |
| senior-architect | openclaw-senior-architect | openclaw | 生成 | 系统架构设计 | - | - | - | 🟡 | Senior software architect skill |
| ui-ux-pro-max | openclaw-ui-ux-pro-max | openclaw | 生成 | UI/UX设计 | - | - | - | 🟡 | UI/UX design skill |
| senior-fullstack | openclaw-senior-fullstack | openclaw | 生成 | 全栈开发设计 | - | - | - | 🟡 | Senior fullstack developer skill |
| youtube-summarizer | openclaw-youtube-summarizer | openclaw | 提取 | YouTube视频摘要 | - | - | - | 🟡 | YouTube 视频摘要 |
| web-search | openclaw-web-search | openclaw | 提取 | 联网信息检索 | - | - | - | 🟡 | Web search skill |
| proactive-agent | openclaw-proactive-agent | openclaw | 执行 | 主动工作流编排 | - | - | - | 🟡 | Proactive Agent，主动工作流 |
| mcporter | openclaw-mcporter | openclaw | 执行 | npm包发布 | - | - | - | 🟡 | mcporter CLI，npm 发布工具 |
| tavily-search | openclaw-tavily-search | openclaw | 提取 | AI友好联网搜索 | 需要API Key | - | - | 🟡 | Tavily Python版，RAG友好，AI搜索 |
| tavily | openclaw-tavily | openclaw | 提取 | AI友好联网搜索 | 需要API Key | - | - | 🟡 | AI 搜索，Tavily API，联网搜索利器 |
| yahoo-finance | skills-yahoo-finance | skills | 提取 | 股票/加密货币数据 | 需要Python环境 | - | - | 🟡 | Yahoo Finance CLI (Python)，股票/加密/外汇数据 |
| skill-creator | openclaw-skill-creator | openclaw | 生成 | 创建新skill指引 | - | - | - | 🟡 | 创建新skill的指引工具 |
| notes-docket | iampennyli-ima-skills | iampennyli | 执行 | 笔记分类管理 | 依赖ima知识库 | - | - | 🟡 | IMA笔记按文档分类，写入对应笔记本 |
| brainstorming | brainstorming | - | 生成 | 需求头脑风暴 | - | - | - | 🟡 | Brainstorming Ideas Into Designs |
| byterover | byteroverinc-byterover | byteroverinc | 提取 | 知识管理检索 | - | - | - | 🟡 | ByteRover Knowledge Management |
| api-gateway | byungkyu-api-gateway | byungkyu | 执行 | 第三方API集成 | 需要OAuth配置 | - | - | 🟡 | API Gateway |
| Skill Creator | chindden-Skill Creator | chindden | 生成 | 创建新skill | - | - | - | 🟡 | Skill Creator |
| manager | code-manager | code | 执行 | 代码触发词执行 | - | - | - | 🟡 | code-manager - 代码管理触发词执行器 |
| manager | doc-manager | doc | 执行 | 文档触发词执行 | - | - | - | 🟡 | doc-manager - 文档管理触发词执行器 |
| documentation | documentation | - | 生成 | 技术文档编写 | - | - | - | 🟡 | Technical Documentation |
| multi-search-engine | gpyAngyoujun-multi-search-engine | gpyAngyoujun | 提取 | 多引擎联网搜索 | - | - | - | 🟡 | Multi Search Engine v2.0.1 |
| Proactive Agent | halthelobster-Proactive Agent | halthelobster | 执行 | 主动工作流 | - | - | - | 🟡 | Proactive Agent |
| rea-baidu-search | ide-rea-baidu-search | ide | 提取 | 百度搜索 | - | - | - | 🟡 | Baidu Search |
| ocr | image-ocr | image | 提取 | 图片文字识别 | Tesseract未安装；EasyOCR/PaddleOCR需额外配置 | →pdf→summarize | - | 🟡 | Image OCR Expert |
| self-improving | ivangdavila-self-improving | ivangdavila | 执行 | 自我反思改进 | - | - | - | 🟡 | Self-Improving Agent |
| Self-Improving + Proactive Agent | ivangdavila-Self-Improving + Proactive Agent | ivangdavila | 执行 | 主动+自我改进 | - | - | - | 🟡 | Self-Improving + Proactive Agent |
| Tavily 搜索 | jacky1n7-Tavily 搜索 | jacky1n7 | 提取 | AI联网搜索 | 需要API Key | - | - | 🟡 | Tavily 搜索 |
| 0001-Automation Workflows | jk-0001-Automation Workflows | jk | 执行 | 自动化工作流 | - | - | - | 🟡 | Automation Workflows |
| desktop-control | matagul-desktop-control | matagul | 执行 | 桌面自动化控制 | Windows环境 | - | - | 🟡 | Desktop Control Skill |
| agent-browser-clawdbot | MaTriXy-agent-browser-clawdbot | MaTriXy | 执行 | 浏览器自动化 | 需要浏览器环境 | - | - | 🟡 | Agent Browser Skill |
| auto-updater | maximeprades-auto-updater | maximeprades | 执行 | 自动更新OpenClaw | Linux服务器 | - | - | 🟡 | Auto-Updater Skill |
| youtube-watcher | Michaelgathara-youtube-watcher | Michaelgathara | 提取 | YouTube内容抓取 | - | - | - | 🟡 | YouTube Watcher |
| humanize-ai-text | moltbro-humanize-ai-text | moltbro | 转换 | AI文本去痕迹 | 不修语义层面词汇，Windows需加`-X utf8` | - | 2026-03-31 🟢 | 🟢 | Humanize AI Text |
| Elite Longterm Memory | nextfrontierbuilds-Elite Longterm Memory | nextfrontierbuilds | 提取 | 长期记忆管理 | - | - | - | 🟡 | Elite Longterm Memory |
| clawddocs | NicholasSpisak-clawddocs | NicholasSpisak | 提取 | Clawdbot文档检索 | - | - | - | 🟡 | Clawdbot Documentation Expert |
| document-processor | ocr-document-processor | ocr | 提取 | 文档OCR处理 | 需要图像/扫描件 | - | - | 🟡 | OCR Document Processor |
| pdf | pdf | - | 提取 | PDF文本提取/合并/拆分/生成 | 扫描版需OCR，表单填写需pdf-lib | →ocr→summarize | 2026-03-31 🟢 | 🟢 | PDF Processing Guide |
| Nano Pdf | steipete-Nano Pdf | steipete | 执行 | PDF编辑修改 | - | - | - | 🟡 | Nano Pdf |
| nano-pdf | steipete-nano-pdf | steipete | 执行 | PDF编辑修改 | - | - | - | 🟡 | nano-pdf |
| summarize | steipete-summarize | steipete | 提取 | 网页/文件/YouTube摘要 | 无API Key只能文本提取；Wikipedia被DNS污染 | - | 2026-03-31 🟢 | 🟢 | Summarize |
| openai-whisper | openclaw-openai-whisper | openclaw | 提取 | 音频转文字 | 需要本地Whisper | - | - | 🟡 | Whisper (CLI) |
| video-frames | steipete-video-frames | steipete | 提取 | 视频帧提取 | 需要ffmpeg | - | - | 🟡 | Video Frames (ffmpeg) |
| api-gateway | byungkyu-api-gateway | byungkyu | 执行 | 100+ API集成 | 需要OAuth配置 | - | - | 🟡 | API Gateway |
| brave-search | steipete-brave-search | steipete | 提取 | Brave搜索 | - | - | - | 🟡 | Brave Search |
| notion | steipete-notion | steipete | 执行 | Notion笔记管理 | 需要Notion API Key | - | - | 🟡 | Notion |
| obsidian | steipete-obsidian | steipete | 执行 | Obsidian笔记管理 | 需要Obsidian vault | - | - | 🟡 | Obsidian |
| slack | steipete-slack | steipete | 执行 | Slack消息操作 | 需要Slack Token | - | - | 🟡 | Slack Actions |
| weather | steipete-weather | steipete | 提取 | 天气预报 | wttr.in和Open-Meteo均被网络阻断 | - | - | 🔴 | Weather |
| github | steipete-github | steipete | 执行 | GitHub操作 | 需要GitHub Token | - | - | 🟡 | GitHub Skill |
| gog | steipete-gog | steipete | 执行 | Google Workspace操作 | 需要OAuth | - | - | 🟡 | gog |
| nano-banana-pro | steipete-nano-banana-pro | steipete | 生成 | 图像生成编辑 | 需要API Key | - | - | 🟡 | Nano Banana Pro Image Generation & Editing |
| Official | steipete-Official | steipete | 提取 | OpenClaw官方文档 | - | - | - | 🟡 | Official |
| superpowers | superpowers | - | 执行 | 主动开发任务 | 需要明确任务 | - | - | 🟡 | Superpowers — OpenClaw Edition |
| stock-analysis | udiedrichsen-stock-analysis | udiedrichsen | 分析 | 股票/加密货币分析 | 需要Yahoo Finance | - | - | 🟡 | Stock Analysis |
| skill | supervision-skill | supervision | 执行 | 监督巡检报告 | - | - | - | 🟡 | supervision-skill — 监督巡检执行器 |
| skills | xiage-skills | xiage | 执行 | 技能全生命周期管理 | - | - | - | 🟢 | xiage-skills - 自定义技能全生命周期自动化管理 |
| demand-review | demand-review | xiage | 生成 | 定期跑需求模型生成需求清单 | 仅生成，不做分拣/计划 | - | 2026-04-03 🟢 | 🟢 | demand-review - 需求模型执行 skill |
| executor | safety-executor | safety | 执行 | 系统命令安全执行 | 仅限白名单命令 | - | - | 🟡 | Command Log Skill |
| ralph-loop | openclaw-ralph-loop | openclaw | 执行 | Coding Agent循环 | - | - | - | 🟡 | Ralph Loop AI coding agent 循环工作流 |
| memory-skill | openclaw-memory-skill | openclaw | 提取 | 长期记忆管理 | - | - | - | 🟡 | Memory Skill |
| ima-skills | iampennyli-ima-skills | iampennyli | 执行 | 腾讯ima知识库 | 需要ima账号 | - | - | 🟡 | 腾讯ima知识库，支持笔记和知识库读写 |

---
| business | ivangdavila-business | ivangdavila | 验证 | 商业想法验证+决策框架+指标追踪，纯prompt | 无 | - | 🟡 待测 | 🟡 | Business — 商业想法验证框架 |
| mbb-strategist | sofianhw-mbb-strategist | sofianhw | 分析 | 麦肯锡级别战略分析，含多种框架模板 | 无 | - | 🟡 待测 | 🟡 | MBB Strategist — 麦肯锡框架顾问 |
| validate-plan | b-mendoza-validate-implementation-plan | b-mendoza | 审核 | 审查AI生成的实施计划，需求追溯性、YAGNI合规、假设风险 | 纯prompt skill，需要subagent支持 | superpowers | 🟡 待测 | 🟡 | Validate Implementation Plan — 方案审计专家 |
## 按分类

### 🚀 能力扩展

| 短名 | 完整目录 | 作者 | 能力类型 | 触发场景 | 描述 |
|------|---------|------|---------|---------|------|
| brainstorming | brainstorming | - | 生成 | 需求头脑风暴 | Brainstorming Ideas Into Designs |
| Skill Creator | chindden-Skill Creator | chindden | 生成 | 创建新skill | Skill Creator |
| Proactive Agent | halthelobster-Proactive Agent | halthelobster | 执行 | 主动工作流编排 | Proactive Agent |
| self-improving | ivangdavila-self-improving | ivangdavila | 执行 | 自我反思改进 | Self-Improving Agent |
| Self-Improving + Proactive Agent | ivangdavila-Self-Improving + Proactive Agent | ivangdavila | 执行 | 主动+自我改进 | Self-Improving + Proactive Agent |
| skill-vetter | spclaudehome-skill-vetter | spclaudehome | 分析 | Skill安全检查 | Skill Vetter 🔒 |
| skill | supervision-skill | supervision | 执行 | 监督巡检报告 | supervision-skill — 监督巡检执行器 |
| skills | xiage-skills | xiage | 执行 | 技能全生命周期管理 | xiage-skills - 自定义技能全生命周期自动化管理 |

### 📄 文档处理

| 短名 | 完整目录 | 作者 | 能力类型 | 触发场景 | 描述 |
|------|---------|------|---------|---------|------|
| documentation | documentation | - | 生成 | 技术文档编写 | Technical Documentation |
| ocr | image-ocr | image | 提取 | 图片文字识别 | Image OCR Expert |
| clawddocs | NicholasSpisak-clawddocs | NicholasSpisak | 提取 | Clawdbot文档检索 | Clawdbot Documentation Expert |
| document-processor | ocr-document-processor | ocr | 提取 | 文档OCR处理 | OCR Document Processor |
| pdf | pdf | - | 提取 | PDF内容处理 | PDF Processing Guide |
| nano-pdf | steipete-nano-pdf | steipete | 执行 | PDF编辑修改 | nano-pdf |
| summarize | steipete-summarize | steipete | 提取 | 文本/URL摘要 | Summarize |

### 🎵 媒体处理

| 短名 | 完整目录 | 作者 | 能力类型 | 触发场景 | 描述 |
|------|---------|------|---------|---------|------|
| openai-whisper | openclaw-openai-whisper | openclaw | 提取 | 音频转文字 | Whisper (CLI) |
| openai-whisper-api | openclaw-openai-whisper-api | openclaw | 提取 | 音频转文字（API） | OpenAI Whisper API |
| video-frames | steipete-video-frames | steipete | 提取 | 视频帧提取 | Video Frames (ffmpeg) |

### 🛠️ 工具能力

| 短名 | 完整目录 | 作者 | 能力类型 | 触发场景 | 描述 |
|------|---------|------|---------|---------|------|
| api-gateway | byungkyu-api-gateway | byungkyu | 执行 | 100+ API集成 | API Gateway |
| multi-search-engine | gpyAngyoujun-multi-search-engine | gpyAngyoujun | 提取 | 多引擎联网搜索 | Multi Search Engine v2.0.1 |
| rea-baidu-search | ide-rea-baidu-search | ide | 提取 | 百度搜索 | Baidu Search |
| agent-browser-clawdbot | MaTriXy-agent-browser-clawdbot | MaTriXy | 执行 | 浏览器自动化 | Agent Browser Skill |
| brave-search | steipete-brave-search | steipete | 提取 | Brave搜索 | Brave Search |
| weather | steipete-weather | steipete | 提取 | 天气预报 | Weather |

### 💻 开发工具

| 短名 | 完整目录 | 作者 | 能力类型 | 触发场景 | 描述 |
|------|---------|------|---------|---------|------|
| ralph-loop | openclaw-ralph-loop | openclaw | 执行 | Coding Agent循环 | Ralph Loop AI coding agent 循环工作流 |
| github | steipete-github | steipete | 执行 | GitHub操作 | GitHub Skill |

### 🎯 其他

| 短名 | 完整目录 | 作者 | 能力类型 | 触发场景 | 描述 |
|------|---------|------|---------|---------|------|
| byterover | byteroverinc-byterover | byteroverinc | 提取 | 知识管理检索 | ByteRover Knowledge Management |
| Tavily 搜索 | jacky1n7-Tavily 搜索 | jacky1n7 | 提取 | AI联网搜索 | Tavily 搜索 |
| desktop-control | matagul-desktop-control | matagul | 执行 | 桌面自动化控制 | Desktop Control Skill |
| youtube-watcher | Michaelgathara-youtube-watcher | Michaelgathara | 提取 | YouTube内容抓取 | YouTube Watcher |
| humanize-ai-text | moltbro-humanize-ai-text | moltbro | 转换 | AI文本去痕迹 | Humanize AI Text |
| stock-analysis | udiedrichsen-stock-analysis | udiedrichsen | 分析 | 股票/加密货币分析 | Stock Analysis |
| Official | steipete-Official | steipete | 提取 | OpenClaw官方文档 | Official |
| superpowers | superpowers | - | 执行 | 主动开发任务 | Superpowers — OpenClaw Edition |
| ima-skills | iampennyli-ima-skills | iampennyli | 执行 | 腾讯ima知识库 | 腾讯ima知识库，支持笔记和知识库读写 |
| opencli | joeseesun-opencli-skill | joeseesun | 执行 | 内容抓取/社交媒体 | CLI工具，复用Chrome登录态，支持B站/知乎/Twitter/微博/YouTube等平台热搜读取，依赖Chrome已登录+Playwright MCP Bridge |

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-03-22 | 初始版本 |
| v1.1.0 | 2026-03-31 | 新增能力地图6字段：能力类型/触发场景/能力边界/组合推荐/实测状态/可用性 |
