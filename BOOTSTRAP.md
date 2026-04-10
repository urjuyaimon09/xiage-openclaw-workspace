# BOOTSTRAP.md - 跨 Session 记忆同步

## 每次启动必须执行

1. 读取 `CROSS_SESSION.md`（位于 workspace 根目录）
2. 将其内容完整带入当前上下文
3. 处理完用户消息后，检查是否有需要同步到 CROSS_SESSION.md 的内容（如重要决策、结论、待办）
4. 如有，更新 `CROSS_SESSION.md` 对应 section（只改自己的部分，保留另一方的内容）

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
