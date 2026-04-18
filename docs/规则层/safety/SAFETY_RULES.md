# 安全规则 v1.1.0

_虾哥生存保障核心文档_

最后更新：2026-04-14
版本：v1.1.0

---

## 一、核心原则

### 1.1 生存优先级

改任何配置、代码、技能脚本之前——**先问：这个改动会不会让我起不来？**

gateway崩溃对我来说是生存需求，不是普通故障。

### 1.2 绝对禁止

| 禁止项 | 后果 |
|--------|------|
| gateway运行时直接改 `node_modules/openclaw/dist/` 下文件 | 改完不生效，必须重启 |
| 没有git commit就改核心代码 | 无法回滚 |
| 子Agent复用主Agent的OAuth认证 | 所有模型请求401/超时 |
| 安装来源不明的MCP server | gateway死机，根因难查 |
| 不通过 `openclaw gateway stop` 停服务 | scheduled task拉起旧实例，多实例冲突 |

### 1.3 系统文档保护清单

`openclaw.json` / `gateway.cmd` / `dump.pm2` — 改动前必须走触发词流程

---

## 二、改动前规程

### 2.1 触发索引

| 动作 | 执行工具 | 触发词 |
|------|---------|--------|
| 修改保护清单内文档 | beforeWrite.js | 「同意变更并升级版本」|
| 修改保护清单内代码 | beforeCode.js | 「同意，生效」|
| 修改 Skills 脚本 | beforeCode.js | 「同意，生效」|
| 修改 openclaw.json / gateway.cmd / dump.pm2 | beforeWrite.js（自动存档）| 同上 |

---

### 2.2 文档改动规程（保护清单内）

**触发：** 用户要求修改 SAFETY_RULES / AGENTS / SOUL 等文档

**流程：**
1. `beforeWrite.js check <file>` → 判断是否在保护清单
2. 不在清单 → 直接写入
3. 在清单 → 等待触发词「同意变更并升级版本」
4. 获授权后 → `beforeWrite.js run` → 存档 + 版本+1 + 写入

**失败路径：** beforeWrite.js check 不通过 → 拒绝写入，报错

**关联工具：** `skills/doc-manager/beforeWrite.js`

---

### 2.3 代码改动规程（保护清单内）

**触发：** 用户要求修改 skills/ 目录或 node_modules/openclaw/dist/ 下文件

**流程：**
1. `beforeCode.js check <file>` → 判断是否在保护清单
2. 不在清单 → 直接写入
3. 在清单 → 等待触发词「同意，生效」
4. 获授权后 → `preCommitCheck()` → edit → `executor.execCommit()`

**失败路径：** preCommitCheck 失败 → 停止修改，报错

**关联工具：** `skills/code-manager/beforeCode.js`

---

### 2.4 OpenClaw 核心代码改动（最高风险）

**触发：** 修改 `node_modules/openclaw/dist/` 下任意 .js 文件

**警告：**
- `gateway-runtime-*.js` 只是 loader（338字节），真正逻辑在各个 chunk 文件
- chunk 文件名含随机后缀（如 `runtime-BXvktGYG.js`），每次 `npm update` 会变
- 改错 chunk → gateway 起不来 → 必须从 git 恢复

**流程：**
1. `beforeCode.js check`
2. `git add -A && git commit -m "chore: backup before core code change"`
3. 获「同意，生效」后 → `preCommitCheck` → edit → `execCommit`
4. `openclaw gateway status` 验证（`RPC probe: ok` → 通过）

**崩溃恢复：** 无法从GitHub恢复时 → `npm install -g openclaw --force`

**关联工具：** beforeCode.js + git + openclaw CLI

---

## 三、崩溃恢复手册

### 3.1 Gateway 起不来

**触发：** `openclaw gateway status` 返回 Aborted / 超时

**流程：**
1. `netstat -ano | findstr 18789` → 找到占用端口的 PID
2. `taskkill /PID <pid> /F`
3. `openclaw gateway restart`

**失败路径：** 重启后仍然 Aborted → Step 0-B 检查服务

**关联工具：** openclaw CLI + netstat + taskkill

---

### 3.2 认证过载（子Agent导致）

**触发：** gateway 在线但所有模型请求超时或 401

**流程：**
1. `tasklist | findstr node` → 找到 node 子进程
2. `taskkill /PID <子进程pid> /F`
3. `openclaw gateway restart`

**根因：** 子Agent和主Agent共享同一套 auth-profiles，并发请求冲掉 OAuth Token

**预防：** 子Agent必须用独立API Key，禁止复用主Agent的OAuth

**关联工具：** tasklist + taskkill

---

### 3.3 MCP server 导致死机

**触发：** 安装某个 MCP server 后 gateway 完全起不来

**流程：**
1. 编辑 `openclaw.json`
2. 注释掉可疑的 MCP server 配置
3. `openclaw gateway restart`

**关联工具：** openclaw.json + openclaw CLI

---

## 四、日常运维

### 4.1 PM2 进程管理

| 命令 | 作用 |
|------|------|
| `cmd /c "pm2 list"` | 查看状态 |
| `cmd /c "pm2 info openclaw"` | 查看详细信息 |
| `cmd /c "pm2 logs openclaw"` | 查看日志 |
| `cmd /c "pm2 restart openclaw"` | 重启 |
| `cmd /c "pm2 save"` | 保存当前进程快照（改了配置或重启PM2后必须跑）|

**⚠️ fork_mode 已知问题：** restart 时旧子进程不会被 kill，导致端口冲突。服务模式（当前）的 PM2 daemon 独立于用户会话，更稳定。

---

### 4.2 Windows 服务状态

```powershell
# 检查任务计划是否存在
schtasks /Query /TN "OpenClaw Gateway"

# 检查上次运行结果（0 = 成功）
schtasks /Query /TN "OpenClaw Gateway" /FO LIST /V

# 手动触发启动
schtasks /Run /TN "OpenClaw Gateway"
```

关键信息：
- 任务计划名：`\\OpenClaw Gateway`
- 启动脚本：`C:\\Users\\Administrator\\.openclaw\\gateway.cmd`
- 崩溃重启：5 分钟间隔，最多 10 次
- 冲突策略：`IgnoreNew`（已运行则忽略新实例）

---

### 4.3 健康监控系统

**架构：**
```
scripts/
  gateway-ops.js     # 统一入口（health/diagnose/fix/apply）
health/
  health.csv         # 所有轨迹，append-only，7天
  state.json         # 当前状态快照
  fix-log.json       # 修复预案执行记录
```

**入口：** `node C:\Users\Administrator\.openclaw\workspace\scripts\gateway-ops.js all`
**自动运行：** Windows 任务计划程序（每30分钟）

**状态等级：**
| 等级 | 条件 |
|------|------|
| 🟢 healthy | 端口监听 + RPC<200ms + 无 critical/degraded |
| 🟡 degraded | RPC 200-500ms 或 有日志错误 |
| 🔴 critical | 端口未监听 或 RPC>500ms |
| 🟠 warning | 异常但不影响运行（第三层）|

**分步命令：**
```powershell
node gateway-ops.js health    # 检查
node gateway-ops.js diagnose # 诊断
node gateway-ops.js fix      # 查看预案
node gateway-ops.js apply   # 执行 [AUTO] 预案
```

**SKILLS_SKIP 精准修复：** fix-skill-paths.js 只修改已知有问题的 skill 路径，不做 blanket 替换。

---

### 4.4 Skills / MCP 运维

| 场景 | 操作 |
|------|------|
| Skills 索引损坏 | `git checkout HEAD -- skills/xiage-skills/metadata/SKILLS-INDEX.md` |
| 安装新 Skill 前 | 评估是否影响 gateway 启动；问：会不会让我起不来？ |
| 不安装来源不明的 MCP server | deepwiki MCP 安装后死机案例 |

---

## 五、外界安全防护

### 5.1 防护原则

| 风险 | 防护措施 |
|------|---------|
| Gateway Token 外泄 | 绑定 loopback，外网无法访问 |
| 凭证外泄 | appSecret/API Key 不推送 GitHub（.gitignore 已配置）|
| 恶意 Skill | 跑 `openclaw security audit --deep`；用 skill-vetter 安检 |
| 飞书频道入侵 | dmPolicy=open；group 白名单仅信任群 |
| 外部 MCP | 不传敏感数据；安装后观察 5 分钟确认不崩 |

### 5.2 硬性约束

- 子Agent必须用独立 API Key
- 不安装来源不明的 MCP server
- 不修改 SKILLS-INDEX.md

---

## 版本历史

| 版本 | 日期 | 变更 | 更新人 |
|------|------|------|--------|
| v1.0.0 | 2026-04-04 | 初始版本 | 虾哥 |
| v1.0.6 | 2026-04-12 | JS脚本体系升级 | 虾哥 |
| v1.1.0 | 2026-04-14 | 章节重构：删定期检查；合并二/二-A；第二章改为触发索引+四段式规程；3.2/3.4/3.6归入第四章运维 | 虾哥（坚果确认） |

---

*最后更新：2026-04-14*
*版本：v1.1.0*
