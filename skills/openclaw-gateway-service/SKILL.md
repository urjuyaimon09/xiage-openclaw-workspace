# openclaw-gateway-service

> OpenClaw Gateway Windows 服务安装与维护手册

## 架构概览

```
Windows 启动
    ↓
LogonTrigger 触发
    ↓
gateway.cmd（环境变量 + 端口）
    ↓
node → OpenClaw Gateway (18789)
    ↓
崩溃检测 → 每5分钟重试 → 最多10次
```

---

## 安装

```powershell
openclaw gateway install
```

安装后自动创建：
- 任务计划：`\OpenClaw Gateway`（LogonTrigger，每次登录自动启动）
- 启动脚本：`C:\Users\Administrator\.openclaw\gateway.cmd`

---

## 关键文件

| 文件 | 作用 |
|------|------|
| `C:\Users\Administrator\.openclaw\gateway.cmd` | 启动脚本，含环境变量和端口配置 |
| Scheduled Task: `\OpenClaw Gateway` | Windows 任务计划，控制生命周期 |

---

## gateway.cmd 内容

```batch
@echo off
set "OPENCLAW_SERVICE_VERSION=2026.4.2"
set "OPENCLAW_FEISHU_HTTP_TIMEOUT_MS=5000"
"C:\Program Files\nodejs\node.exe" "%~dp0index.js" gateway --port 18789
```

**关键环境变量：**
- `OPENCLAW_FEISHU_HTTP_TIMEOUT_MS=5000` — 飞书 API 超时从 30s → 5s（快速失败）
- `OPENCLAW_GATEWAY_PORT=18789` — 固定端口

---

## 服务配置（RestartOnFailure）

**配置值：**
- 崩溃后等待：5 分钟
- 重试次数：最多 10 次
- 冲突策略：`IgnoreNew`（已运行时忽略新实例）

**验证配置：**
```powershell
# 查看 RestartOnFailure 配置
(Get-ScheduledTask -TaskName 'OpenClaw Gateway').Settings.RestartOnFailure

# 查看完整 XML
(Get-ScheduledTask -TaskName 'OpenClaw Gateway').Xml
```

**修改配置（需管理员 PowerShell）：**
```powershell
# 用 fix-restart.ps1 脚本（推荐）
# 位置：~\AppData\Local\Temp\fix-restart3.ps1

# 或手动通过 COM 接口（需编码 UTF-16）
$TaskService = New-Object -ComObject Schedule.Service
$TaskService.Connect("localhost")
$task = $TaskService.GetFolder("\").GetTask("OpenClaw Gateway")
$xml = $task.Xml
# 在 </MultipleInstancesPolicy> 后插入 <RestartOnFailure><Count>N</Count><Interval>PTXM</Interval></RestartOnFailure>
# 然后用 NewTask(0) + RegisterTaskDefinition 重建
```

---

## 排查

### 检查服务状态

```powershell
openclaw gateway status
```

- `RPC probe: ok` + `Listening: 127.0.0.1:18789` → 正常
- 端口被占：`Gateway already running locally`

### 端口冲突

```powershell
netstat -ano | findstr 18789
```

有多个进程 → 手动 kill 旧进程后重启

### 服务未自动启动

```powershell
# 检查任务计划是否存在
schtasks /Query /TN "OpenClaw Gateway"

# 手动触发
schtasks /Run /TN "OpenClaw Gateway"

# 查看上次运行结果
schtasks /Query /TN "OpenClaw Gateway" /FO LIST /V
```

### RestartOnFailure 不生效

症状：gateway 崩溃后没有自动拉起。

**排查步骤：**
1. 检查任务计划 `LastTaskResult` 是否为 0（成功）
2. 检查 `NumberOfMissedRuns` 是否 > 0（错过的次数）
3. 检查 Windows 事件日志：`eventvwr.msc` → Windows Logs → System，筛选 TaskScheduler

### 重建服务

```powershell
# 删除旧任务计划
schtasks /Delete /TN "OpenClaw Gateway" /F

# 重新安装
openclaw gateway install

# 然后重新配置 RestartOnFailure
```

---

## 版本历史

- v0.1.0 (2026-04-06)：初始版本，记录安装、服务配置、gateway.cmd 内容、排查方法
