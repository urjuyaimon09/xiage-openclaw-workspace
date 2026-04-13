# 系统文档备份策略

落地：Rule

系统文档（openclaw.json、gateway.cmd、dump.pm2）的本地备份规范，供 health 监控系统在修复时查找备份使用。

---

## 存档目录

| 系统文档 | 原始路径 | 备份路径格式 | 保留数量 |
|----------|----------|-------------|---------|
| Gateway 配置 | `C:\Users\Administrator\.openclaw\openclaw.json` | `openclaw.json.bak.YYYY-MM-DD_HH-MM-SS` | 10个 |
| Gateway 启动脚本 | `C:\Users\Administrator\.openclaw\gateway.cmd` | `gateway.cmd.bak.YYYY-MM-DD_HH-MM-SS` | 10个 |
| PM2 进程配置 | `C:\Users\Administrator\.pm2\dump.pm2` | `dump.pm2.bak.YYYY-MM-DD_HH-MM-SS` | 10个 |

---

## 存档规则

### 修改前必须存档

以下操作前，**必须**先运行对应存档脚本：

| 操作 | 必须存档的文档 |
|------|--------------|
| 修改 `openclaw.json` | `openclaw.json` |
| 修改 `gateway.cmd` | `gateway.cmd` |
| 修改 PM2 环境变量（`pm2 env` / `pm2 set`） | `dump.pm2` |
| 修改 PM2 启动参数 | `dump.pm2` |

### 存档脚本

| 脚本 | 用途 |
|------|------|
| `scripts/archive-openclaw-config.ps1` | 存档 openclaw.json |
| `scripts/archive-gateway-cmd.ps1` | 存档 gateway.cmd |
| `scripts/archive-pm2-dump.ps1` | 存档 dump.pm2 |

---

## Health 修复规则

修复时查找备份的逻辑：**找最新时间戳的 .bak 文件恢复**

| 诊断 | 恢复路径 |
|------|---------|
| CONFIG_INVALID | `C:\Users\Administrator\.openclaw\openclaw.json.bak.*`（最新） |
| GATEWAY_CMD_DRIFT | `C:\Users\Administrator\.openclaw\gateway.cmd.bak.*`（最新） |
| PM2_ENV_DRIFT | `C:\Users\Administrator\.pm2\dump.pm2.bak.*`（最新） |

**修复后不调 pm2 restart**，由 PM2 自然检测到文件变化后重启，或由坚果手动重启。
