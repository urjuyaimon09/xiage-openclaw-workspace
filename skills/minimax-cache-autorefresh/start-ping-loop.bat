@echo off
:: start-ping-loop.bat
:: 启动 ping-loop 心跳脚本，确保 MinMax 缓存续命
:: 使用方式：双击运行，或通过计划任务在用户登录时自动触发

set PING_SCRIPT=%~dp0ping-loop.js
set LOG_FILE=%~dp0ping-loop.log

echo [%date% %time%] 启动 ping-loop... >> "%LOG_FILE%"
start /b node "%PING_SCRIPT%" >> "%LOG_FILE%" 2>&1
echo [%date% %time%] 已启动，PID: %errorlevel% >> "%LOG_FILE%"
