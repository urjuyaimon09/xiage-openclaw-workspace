# BOOTSTRAP.md - 启动记忆同步

## 每次启动必须执行

1. 读取 `memory/hot/current.md`（思维状态快照）
2. 读取 `memory/hot/lessons.md`（教训记录）
3. 读取当日 `memory/YYYY-MM-DD.md`（每日合并）
4. 按时间顺序加载当日所有 `memory/sessions/` 文件
5. 初始化 doc-loader 缓存：`docLoader.warmUp()`（路径：docs/意识层/doc-loader.js）
6. 从快照还原：
   - 高频 Cognition 索引（直接进入 Loop1 输入层）
   - 最近推理结论（进入 Loop2 判断层）
   - 当前项目状态（进入工作上下文）
7. 将快照内容带入当前上下文

## 归档触发

| 时机 | 触发 | 目标 |
|------|------|------|
| Session结束 | 立即 | `memory/sessions/YYYY-MM-DD-HHMMSS.md` |
| 心跳30分钟 | 定时 | 增量归档 |
| 每日00:00 | 定时 | 合并为 `memory/YYYY-MM-DD.md` |

## 同步触发条件

以下情况必须写回 memory：
- 用户做出了重要决定或结论
- 产生了需要追踪的待办事项
- 对话中明确了某个事实或偏好
- 收到了需要让另一个 session 知道的信息

## 格式要求

见 MEMORY.md 两层归档机制。
