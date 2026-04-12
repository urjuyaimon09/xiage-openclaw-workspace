# 安全规则 v1.0.4

_虾哥生存保障核心文档_

最后更新：2026-04-12

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

**当前配置（v1.0.4）：**

| 组件 | 状态 | 说明 |
|------|------|------|
| PM2 安装 | ✅ | `npm install -g pm2` |
| pm2-windows-service | ✅ | PM2 作为 Windows 服务运行（后台，无窗口闪烁） |
| Gateway 托管 | ✅ | `pm2 start openclaw`（fork_mode） |
| 进程保存 | ✅ | `pm2 save`（已保存到 `C:\Users\Administrator\.pm2\dump.pm2`） |
| 开机自启 | ✅ | PM2 服务本身是 Automatic（由服务控制管理器管理） |

**PM2 常用命令：**
```powershell
cmd /c "pm2 list"           # 查看状态（用cmd绕开PowerShell执行策略）
cmd /c "pm2 info openclaw"   # 查看详细信息
cmd /c "pm2 logs openclaw"   # 查看日志
cmd /c "pm2 restart openclaw" # 重启Gateway
cmd /c "pm2 save"            # 保存当前进程快照
```

**⚠️ fork_mode 已知问题（不影响服务模式）：**
- fork_mode 下 restart 时旧子进程不会被 PM2 kill，导致端口冲突
- 表现：PM2 restart 后新进程起不来，日志里 lock timeout
- 根因：PM2 fork_mode 无法管理子进程的生命周期
- **解决：服务模式的 PM2 daemon 独立于用户会话，更稳定**
- 当前 restart 次数 1163 次是旧手工 gateway 留下的，新服务进程正常

**注意事项：**
- 改了 Gateway 配置或重启了 PM2 进程 → 必须跑 `pm2 save` 保存新快照
- PM2 服务本身很稳定，一般不需要动
- Gateway 启动慢（~72秒）是正常现象，不是 PM2 的问题

### Step 0-C — Gateway 健康监控流程（2026-04-12 新增）

**完整流程：检查 → 诊断 → 修复 → 记录**

#### 1. 检查（gateway-diagnose.ps1）

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\Administrator\.openclaw\workspace\scripts\gateway-diagnose.ps1
```

检查项（7项）：PM2状态 / 端口18789 / RPC健康 / Config有效性 / Bonjour阻塞 / 日志错误 / Codex ACP

#### 2. 诊断

诊断脚本输出：`[OK]` / `[WARN]` / `[ERR]`，并给出 `Recommended fixes` 列表

#### 3. 修复（-Fix）

```powershell
.\gateway-diagnose.ps1 -Fix
```

4种自动修复：
- **Config 无效** → 从 `.json.bak` 恢复
- **端口被旧进程占** → `Stop-Process -Id <pid> -Force` 杀旧进程
- **Bonjour 延迟** → 在 `dump.pm2` 里写入 `OPENCLAW_DISABLE_BONJOUR=1`
- **需要重启** → `pm2 restart openclaw`

#### 4. 记录（自动，无需手动）

| 文件 | 触发条件 | 内容 | 保留 |
|------|---------|------|------|
| `health/health-state.json` | 每次检查 | 当前状态（覆盖） | 最新 |
| `health/health-events.json` | 状态跳变时 | 跳变事件（from/to/rpcMs/issue） | 7天 |
| `health/health-daily.json` | 每天首次检查 | 聚合数据（rpcAvg/memAvg/issueCount） | 7天 |

**设计原则：** 有问题才记录，稳定态不写数据。

**自动运行：** Windows 任务计划程序 `OpenClaw Gateway Health`（每30分钟，独立于 OpenClaw）

#### `/gateway health` 指令

触发词：`/gateway health`

效果：读取 `health-state.json` + `health-events.json`（最近7天）+ `health-daily.json`（最近7天），输出：
```
🟢 HEALTHY | RPC: 50ms | Mem: 729MB | Restarts: 1163
最近：Bonjour延迟 → 已禁用（04-11 22:00）
趋势：近7天 RPC稳定在40-60ms
```

#### 状态等级

| 等级 | 条件 |
|------|------|
| 🟢 healthy | 端口监听 + RPC<200ms + 无错误 |
| 🟡 degraded | RPC 200-500ms 或 有日志错误/Bonjour阻塞 |
| 🔴 critical | 端口未监听 或 RPC>500ms 或 错误>5条 |

---

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

## 二-A Gateway 自动运维流程

### 架构

```
scripts/
  gateway-health.js    # 检查（定时30分钟+手动）
  gateway-diagnose.js  # 诊断（手动）
  gateway-fix.js       # 修复（手动）
health/
  health.csv           # 所有轨迹，append-only，7天
  state.json           # 当前状态快照
```

### 三层职责

| 脚本 | 职责 | 触发 |
|------|------|------|
| `gateway-health.js` | 检查，输出状态 | Task Scheduler 每30分钟 / 手动 |
| `gateway-diagnose.js` | 诊断，输出问题点 | 手动 |
| `gateway-fix.js` | 修复，执行修复操作 | 手动 |

数据集成点：`health.csv`（append-only），通过 `incident_id` 串联同一问题的检查→诊断→修复完整生命周期。

### incident_id 规则

- **格式**：`INC-YYYYMMDD-NNN`（日期 + 当日序号）
- 首次发现问题的 check 行生成新 ID，后续 diagnose/fix 复用同一 ID
- 正常 check（无问题）复用上一个 ID
- 修复完成后，新问题生成新 ID

### 检查项（gateway-health.js）

| 检查项 | 判定 |
|--------|------|
| PM2 在线 | `pm2 jlist` 含 online |
| 端口18789 | netstat LISTENING |
| RPC延迟 | Node.js TCP connect 计时 |
| Config有效 | JSON.parse |
| 日志错误 | 最近1小时：ECONNREFUSED / unhandledRejection / SIGTERM |
| Bonjour阻塞 | pm2 logs 有 stuck announcing |
| 内存MB | PM2 monit.memory |
| restart次数 | PM2 restart_time |

**状态等级**：
- 🟢 healthy：端口监听 + RPC<200ms + 无错误
- 🟡 degraded：RPC 200-500ms 或 有日志错误/Bonjour阻塞
- 🔴 critical：端口未监听 或 RPC>500ms 或 错误>5条

### 诊断规则（gateway-diagnose.js）

| 症状 | 诊断结论 |
|------|---------|
| portStatus != listening | 端口未监听，Gateway 未运行 |
| rpcMs > 500 | RPC 严重延迟，检查网络/负载 |
| logErrors 有 ECONNREFUSED | 某服务拒绝连接 |
| bonjourIssue 有 stuck | Bonjour 广播阻塞，禁用 |
| restartCount 突增 | PM2 频繁重启，检查进程稳定性 |
| configValid = false | Config 文件损坏，需回滚 |

### 修复上限规则

| 级别 | 问题 | 修复策略 | 上限 |
|------|------|---------|------|
| 小 | 端口被占（stale PID） | kill 旧进程 → PM2 restart | 重试2次 |
| 小 | Bonjour 延迟 | 写入 OPENCLAW_DISABLE_BONJOUR=1 到 dump.pm2 | 一次性 |
| 小 | 日志错误 | 写记录，等待人工处理 | — |
| 大 | Config 无效 | 从 .json.bak 回滚 | 直接执行，不重试 |
| 大 | PM2 errored | pm2 restart | 3次不行进重建 |

超过上限：记录并停用自动修复，等待人工介入。

### 运维

| 项目 | 说明 |
|------|------|
| 脚本存放 | `scripts/` |
| 数据存放 | `health/` |
| 日志聚合 | 所有 stdout → pm2 logs |
| Git 管理 | 脚本和数据都在 workspace，受 Git 版本控制 |
| 过期处理 | CSV 只保留7天 |
| 备份 | Git commit = 备份 |

### 当前进度

- ✅ `gateway-health.js` 已上线
- ⬜ `gateway-diagnose.js` 待实现
- ⬜ `gateway-fix.js` 待实现

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
- `pm2 list` 显示 `errored` 状态 → 进程超过最大重启次数，停止拉起 → `pm2 restart openclaw` 恢复
- `pm2 logs openclaw` 无输出 → 服务本身可能挂了 → 检查 PM2 Windows 服务：`Get-Service pm2.exe`
- 开机后 Gateway 没起来 → 检查 PM2 服务状态是否为 Running；检查 Task Scheduler 里的 OpenClaw Gateway 任务
- 端口被陈旧 PID 占用 → `Stop-Process -Id <pid> -Force` 杀旧进程；PM2 会自动拉起新进程

---

*版本历史*
- v1.0.0 (2026-04-04)：初始版本，纳入：自我保护规则/崩溃恢复手册/外界安全/定期巡检
- v1.0.1 (2026-04-05)：新增 1.1 OpenClaw 核心代码改动规程（改动前备份、chunk结构说明、崩溃恢复步骤）
- v1.0.2 (2026-04-06)：新增 Step 0 Windows 服务状态检查；补充 gateway 服务运行时强制关闭的危害说明；关联 skill: openclaw-gateway-service
- v1.0.3 (2026-04-11)：新增 Step 0-B PM2 进程守护方案（Gateway 稳定化完整配置）
- v1.0.4 (2026-04-12)：Step 0-B 更新为 pm2-windows-service 方案；新增 Step 0-C Gateway 健康监控完整流程（检查/诊断/修复/记录三段式）；更新 PM2 fork_mode 已知问题
- v1.0.5 (2026-04-12)：新增二-A「Gateway 自动运维流程」章节（架构/职责/incident_id/检查项/诊断规则/修复上限/运维）；diagnose.js 和 fix.js 待实现
