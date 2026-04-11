# 安全规则 v1.0.2

_虾哥生存保障核心文档_

最后更新：2026-04-06

---

## 一、自我保护（改配置/代码前必须遵守）

### 1.1 OpenClaw 核心代码改动规程（最高风险）

**触发条件：** 修改 `node_modules/openclaw/dist/` 下的任意 .js 文件

**操作前必须执行：**

```powershell
# 1. git commit 当前所有代码（备份现状）
git add -A && git commit -m "chore: backup before core code change"

# 2. 备份 gateway-runtime loader
gw_file="$env:APPDATA\npm\node_modules\openclaw\dist\gateway-runtime-B7jG4Cjq.js"
Copy-Item $gw_file "$env:USERPROFILE\.openclaw\workspace\backup-pre-orchestrator\gateway-runtime-B7jG4Cjq.js.bak"

# 3. 备份所有 chunk 文件（核心逻辑分散在这些文件里）
Backup-Item "$env:APPDATA\npm\node_modules\openclaw\dist" -Destination "$env:USERPROFILE\.openclaw\workspace\backup-pre-orchestrator\chunks"
```

**OpenClaw 核心代码结构（警告）：**
- `gateway-runtime-B7jG4Cjq.js` 只是 loader（338字节），真正逻辑在各个 chunk 文件
- chunk 文件名含随机后缀（如 `runtime-BXvktGYG.js`），每次 `npm update` 会变
- 改错 chunk → gateway 起不来 → 必须从 git 恢复

**改动后验证：**
```powershell
openclaw gateway status
```
`RPC probe: ok` → 验证通过
`Aborted` / 超时 → Step 2 恢复流程

**崩溃恢复：**

```powershell
# 情况一：OpenClaw 核心崩溃（node_modules）
# 无法从 GitHub 恢复，直接重装
npm install -g openclaw --force
openclaw configure

# 情况二：workspace 文件损坏
# 从 GitHub 拉取关键文件
cd C:\Users\Administrator\.openclaw\workspace
git checkout HEAD -- docs/core/
git checkout HEAD -- AGENTS.md
git checkout HEAD -- SAFETY_RULES.md
git checkout HEAD -- skills/xiage-skills/
```

### Step 0-B — PM2 进程守护（Gateway 稳定方案）

**解决的问题：**
- Gateway崩溃后不能自动拉起
- 手工启动依赖PowerShell窗口
- 进程挤爆问题

**已完成的配置：**

| 组件 | 状态 | 说明 |
|------|------|------|
| PM2 安装 | ✅ | `npm install -g pm2` |
| Gateway 托管 | ✅ | `pm2 start "node ...openclaw/dist/index.js gateway" --name openclaw` |
| 重启退避 | ✅ | `--exp-backoff-restart-delay=1000`（间隔1秒起递增） |
| 进程保存 | ✅ | `pm2 save`（保存到快照） |
| 开机自启 | ✅ | `startup.bat` 放入 `shell:startup` |

**PM2 常用命令：**
```powershell
pm2 list                  # 查看状态
pm2 info openclaw         # 查看详细信息
pm2 logs openclaw         # 查看日志
pm2 restart openclaw      # 重启Gateway
pm2 save                  # 保存当前进程快照（改完PM2配置后必跑）
pm2 resurrect             # 从快照恢复所有进程（开机自启用）
```

**注意事项：**
- 改了Gateway配置或重启了PM2进程 → 要跑 `pm2 save` 保存新快照
- PM2 daemon本身很稳定，一般不需要动
- Gateway启动慢（4分钟）是正常现象，不是PM2的问题

**崩溃时的行为：**
- Gateway进程退出 → PM2检测到 → 按退避策略重启（1秒 → 2秒 → 4秒...）
- 一分钟内重启超过5次 → PM2停止重启，进入errored状态
- 下次开电脑 → `startup.bat` → `pm2 resurrect` → 自动恢复所有进程

**需要恢复的关键文件（均在 workspace 内，受 Git 管理）：**

| 文件/目录 | 说明 |
|-----------|------|
| `docs/core/` | 所有核心规则文档 |
| `SAFETY_RULES.md` | 安全规则 |
| `AGENTS.md` | 操作手册 |
| `skills/xiage-skills/` | skill 管理脚本 |
| `memory/` | 对话记忆 |

**⚠️ 绝对禁止：**
- gateway 运行中直接改 `node_modules/openclaw/dist/` 下的文件（必须重启才能生效）
- 在没有 git commit 的情况下改动核心代码
- 改完不验证就离开电脑
- gateway 正常运行时不通过 `openclaw gateway stop` 停服务（会导致 scheduled task 重新拉起旧实例，形成多个 gateway 同时跑）

| 场景 | 行动 |
|------|------|
| 改 openclaw.json 前 | 自动触发 pre-commit hook，本地备份 + git push 到 backup/openclaw 分支 |
| 改 Skills 脚本前 | beforeCode.js check；改前 git commit |
| 装新 npm 包 / 新 Skill 前 | 评估是否影响 gateway 启动；**必须问：会不会让我起不来？** |
| 执行 openclaw update 前 | 备份当前 openclaw.json；记录版本号 |
| 修改 cron 任务前 | 验证 jobs.json 格式；先在测试环境试 |
| 子 Agent 启动前 | **子 Agent 必须用独立 auth-profiles，禁止共享主 Agent 的认证** |

**⚠️ 已知的危险操作（绝对不能做）：**
- 给子 Agent 使用主 Agent 的 `minimax-portal:default` OAuth 认证 → 会导致网关所有模型请求认证冲突
- 安装来源不明的 MCP server → deepwiki MCP 安装后直接死机，根因至今未定位
- 在没有备份的情况下修改 SKILLS-INDEX.md → 导致所有 cron 任务崩溃

---

## 二、崩溃恢复手册（给坚果）

**Step 0 — 检查 Windows 服务状态（新增）**

gateway 以 Windows 任务计划服务方式运行，崩溃后每 5 分钟自动重试，最多 10 次。

```powershell
# 检查任务计划是否存在
schtasks /Query /TN "OpenClaw Gateway"

# 检查上次运行结果（0 = 成功）
schtasks /Query /TN "OpenClaw Gateway" /FO LIST /V

# 手动触发启动
schtasks /Run /TN "OpenClaw Gateway"

# 查看 RestartOnFailure 配置
(Get-ScheduledTask -TaskName 'OpenClaw Gateway').Settings.RestartOnFailure
```

**服务关键信息：**
- 任务计划名：`\\OpenClaw Gateway`
- 启动脚本：`C:\\Users\\Administrator\\.openclaw\\gateway.cmd`
- 崩溃重启：5 分钟间隔，最多 10 次
- 冲突策略：`IgnoreNew`（已运行则忽略新实例）

**Step 1 — 检查网关状态**
```
openclaw gateway status
```
`RPC probe: ok` → 在线，跳 Step 3
`Aborted` / 超时 → Step 2

**Step 2 — 网关起不来**
```powershell
netstat -ano | findstr 18789
taskkill /PID <pid> /F
openclaw gateway restart
```

**Step 3 — 子 Agent 导致认证冲突（认证过载）**
症状：网关在线但所有模型请求超时或 401。
```powershell
tasklist | findstr node
taskkill /PID <子进程pid> /F
openclaw gateway restart
```
**根因**：子 Agent 和主 Agent 共享同一套 auth-profiles，共享同一个 OAuth Token，并发请求导致 Token 被冲掉。

**Step 4 — 配置损坏，恢复备份**
```powershell
cd C:\Users\Administrator\.openclaw\workspace
git checkout backup/openclaw -- openclaw.json
openclaw gateway restart
```

**Step 5 — Skills 索引损坏**
症状：所有 cron 任务同时崩溃，SKILLS-INDEX.md 丢失或为空。
```powershell
git checkout HEAD -- skills/xiage-skills/metadata/SKILLS-INDEX.md
openclaw gateway restart
```

**Step 6 — MCP server 导致死机**
症状：安装某个 MCP server 后网关完全起不来。
编辑 openclaw.json，注释掉可疑的 MCP server，重启。

**Step 7 — 最极端情况**
```powershell
npm install -g openclaw@latest --force
openclaw configure
```
⚠️ 所有配置重置

---

## 三、外界安全

| 风险 | 防护措施 |
|------|---------|
| Gateway Token 外泄 | 绑定 loopback，外网无法访问 |
| openclaw.json 凭证外泄 | appSecret/API Key 不推送 GitHub，.gitignore 已配置 |
| 恶意 Skill 安装 | 跑 `openclaw security audit --deep`；skill-vetter 安检 |
| 飞书频道入侵 | dmPolicy=open；group 白名单仅信任群 |
| 外部 MCP 服务 | 不传敏感数据；MCP server 安装后观察 5 分钟确认不崩 |
| 子 Agent 认证冲突 | 子 Agent 必须用独立 API Key，严禁复用主 Agent 的 OAuth 认证 |

---

## 四、定期安全检查（每周日 16:00 自动巡检）

检查项：
1. 检查是否有异常进程占用 18789 端口
2. 检查 .openclaw/backups 是否有当天备份
3. 检查 Skills 索引是否完整
4. 检查 MCP servers 是否都有响应
5. 跑 `openclaw security audit --deep`

---

**PM2 故障排查：**
- `pm2 list` 显示 `errored` 状态 → 说明进程超过最大重启次数，停止拉起 → 手动 `pm2 restart openclaw` 恢复
- `pm2 logs openclaw` 无输出 → daemon 可能挂了 → 重启PM2：`pm2 restart all`
- 开机后Gateway没起来 → 检查 `startup.bat` 是否在启动文件夹里、是否以管理员权限运行

---

*版本历史*
- v1.0.0 (2026-04-04)：初始版本，纳入：自我保护规则/崩溃恢复手册/外界安全/定期巡检
- v1.0.1 (2026-04-05)：新增 1.1 OpenClaw 核心代码改动规程（改动前备份、chunk结构说明、崩溃恢复步骤）
- v1.0.2 (2026-04-06)：新增 Step 0 Windows 服务状态检查；补充 gateway 服务运行时强制关闭的危害说明；关联 skill: openclaw-gateway-service
- v1.0.3 (2026-04-11)：新增 Step 0-B PM2 进程守护方案（Gateway 稳定化完整配置）
