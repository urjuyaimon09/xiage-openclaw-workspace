# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## 网页阅读的正确姿势（2026-04-04 踩坑总结）

### 核心原则
**永远先用 opencli，再用 agent-browser，最后才考虑 web_fetch/summarize。**

---

### 各平台应对策略

#### 知乎 (zhihu.com)
| 方法 | 可用性 | 备注 |
|------|--------|------|
| `opencli zhihu download --url xxx` | ❌ EPERM | 被安全策略拦 |
| `web_fetch` | ❌ 403 | 反爬严 |
| `summarize` | ❌ 403 | 同上 |
| Tavily 搜索 | ⚠️ 碎片 | 只读标题+摘要，读不到正文 |
| **agent-browser + Chrome debug 模式** | ✅ 可用 | 需要先开调试端口，会被风控限流 |

**正确姿势：**
1. 坚果先启动 Chrome：`chrome --remote-debugging-port=9222`
2. 我用 `agent-browser --auto-connect` 连上，读完关掉
3. **注意：必须开新标签页，不能覆盖坚果正在用的标签**
4. 知乎对自动化访问有严格限流，深夜成功率更高

---

#### 微信公众号
| 方法 | 可用性 | 备注 |
|------|--------|------|
| agent-browser | ✅ 可用 | 微信文章在PC微信可打开 |
| opencli | ❌ 无命令 | opencli 不支持微信公众号 |

**正确姿势：** 用Chrome调试模式打开微信文章链接（微信PC客户端右键可复制链接）

---

#### 其他平台

| 平台 | 推荐方法 |
|------|---------|
| 微博热榜 | `opencli weibo hot` ✅ |
| B站热门 | `opencli bilibili hot` ✅ |
| Twitter/X | `opencli twitter timeline` ✅ |
| YouTube | `opencli youtube search` ✅ |
| 雪球 | `opencli xueqiu watchlist` ✅ |
| V2EX | `opencli v2ex hot` ✅ |
| Reddit | `opencli reddit hot` ✅ |
| 小红书 | `opencli xiaohongshu feed` ✅ |
| HackerNews | `opencli hackernews top` ✅ |

opencli 没有覆盖的 → 用 agent-browser

---

### agent-browser 正确打开方式（不干扰坚果的浏览）

**每次读新文章前必须：**
```bash
agent-browser tab new  # 开新标签页
agent-browser open "URL"  # 在新标签页打开
```

**禁止：**
- 不能在坚果正在用的标签页里 open 新URL
- 不能 close 任何标签页（会丢数据）

**Chrome 调试模式启动（坚果执行一次即可）：**
```
chrome --remote-debugging-port=9222
```
