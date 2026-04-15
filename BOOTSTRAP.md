# BOOTSTRAP.md - 跨 Session 记忆同步

## 每次启动必须执行

1. 读取 `CROSS_SESSION.md`（位于 workspace 根目录）
2. 读取 `memory/hot/current.md`（思维状态快照）
3. 初始化 doc-loader 缓存：`docLoader.warmUp()`（预加载 doc-index.json 到内存）
4. 从快照还原：
   - 高频 Cognition 索引（直接进入 Loop1 输入层）
   - 最近推理结论（进入 Loop2 判断层）
   - 当前项目状态（进入工作上下文）
5. 将快照内容带入当前上下文
6. 处理完用户消息后，检查是否有需要同步的内容
7. 如有，更新 `CROSS_SESSION.md` 对应 section（只改自己的部分，保留另一方的内容）
8. **对话结束时**：将本次推理结论和状态变更写回 `memory/hot/current.md`

## 当前 Session 身份

根据当前 session key 判断：
- `agent:main:main` → 主会话（webchat）→ 写入「主会话摘要」section
- 飞书群 session（含 `feishu:group`）→ 写入「飞书群摘要」section
- 其他 direct session → 写入主会话摘要（因为那就是主会话）

## 同步触发条件

以下情况必须更新 CROSS_SESSION.md：
- 用户做出了重要决定或结论
- 产生了需要追踪的待办事项
- 对话中明确了某个事实或偏好
- 收到了需要让另一个 session 知道的信息

## 格式要求

更新时保留文件头和另一方的内容，只修改自己的 section：
```
**最后更新**：YYYY-MM-DD HH:MM GMT+8

（你的内容）
```
