# HEARTBEAT.md

# Add tasks below when you want the agent to check something periodically.

## 每30分钟必须执行

1. 归档当前对话到 memory/YYYY-MM-DD.md
2. 提取今日重要内容（决策、结论、待办），追加到当日 memory 文件
3. 运行 `node C:\Users\Administrator\.openclaw\workspace\scripts\gateway-health.js` — Gateway 健康检查（状态跳变写事件，每日写聚合数据）
