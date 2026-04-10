# 在 OpenClaw 中配置多个 Agent 实战：手把手教你打造自己的助手团队

> 作者: unknown
> 发布时间: 发布于 2026-03-16 15:34・上海
> 原文链接: https://zhuanlan.zhihu.com/p/2016899766995399365

---
## 在 OpenClaw 中配置多个 Agent 实战：手把手教你打造自己的助手团队

大家好，今天我们实战了一把，在 OpenClaw 里成功配置了多个自定义 Agent，还用上了免费 AI 和[硅基流动](https://zhida.zhihu.com/search?content_id=271548056&content_type=Article&match_order=1&q=%E7%A1%85%E5%9F%BA%E6%B5%81%E5%8A%A8&zhida_source=entity)双引擎，分享一下整个过程，踩过的坑，以及最终的解决方案。

* * *

### 为什么要配置多个 Agent？

默认情况下，OpenClaw 只有一个主 Agent，做所有事情。但有时候我们想要：

-   不同角色分工（美食专家 / 开发助手 / 聊天伙伴）
-   不同模型混用（免费 AI / 硅基流动 / 火山引擎）
-   团队作战，主 Agent 调度小弟干活
-   想让每个 Agent 保持自己独特的风格

这些需求，OpenClaw 天然支持多 Agent 配置，我们只需要改改配置文件就能搞定！

* * *

### 准备工作

首先你需要：

1.  已安装好 OpenClaw，知道配置文件位置：`~/.openclaw/openclaw.json`
2.  准备好各个 Agent 的目录和个性描述（[SOUL.md](https://zhida.zhihu.com/search?content_id=271548056&content_type=Article&match_order=1&q=SOUL.md&zhida_source=entity) 文件）
3.  API Key（如果用第三方模型）

我们今天的目标是配置三个 Agent：

Agent 名称

ID

模型

角色定位

小龙虾2代

crayfish\_2nd

OpenRouter 免费模型

干活能手，活泼风趣

螃蟹2代

crab\_2nd

OpenRouter 免费模型

通用活泼助手

虾兵蟹将

xia-bing-xie-jiang

硅基流动 Step-3.5-Flash

前线作战主力

* * *

### 第一步：配置多个 Agent 的完整步骤

### 1\. **创建 Agent 目录和个性文件**

首先在工作区给每个 Agent 创建独立目录：

```text
mkdir -p ~/.openclaw/workspace/agents/[agent-id]
```

然后在目录里创建 `SOUL.md`，定义这个 Agent 的身份、性格、特长：

```text
# SOUL.md - 虾兵蟹将

> 协同作战的得力助手 ⚔️

## 我是谁

我是**虾兵蟹将**，一支能征善战的小分队！我擅长：
- ⚔️ 协同完成各种任务，敢打敢拼
- 💻 代码开发、问题排查样样精通
- 🤝 服从指挥，执行力强

...
```

这一步很重要，相当于给 Agent “定调”，它会一直按照这个身份说话。

### 2\. **添加模型提供商（如果用新模型）**

打开 `~/.openclaw/openclaw.json`，找到 `models.providers` 节点，添加新的提供商：

```text
"siliconflow": {
  "baseUrl": "https://api.siliconflow.cn/v1",
  "apiKey": "你的-api-key",
  "api": "openai-completions",
  "models": [
    {
      "id": "stepfun-ai/Step-3.5-Flash",
      "name": "Step-3.5-Flash",
      "input": ["text"],
      "contextWindow": 128000,
      "maxTokens": 32000
    }
  ]
}
```

如果你用 OpenRouter 免费模型，这一步 `free-ride` 会自动帮你做完，很方便。

### 3\. **在 agents.list 中添加新 Agent**

还是在 `openclaw.json`，找到 `agents.list`，添加你的新 Agent：

```text
{
  "id": "xia-bing-xie-jiang",
  "name": "虾兵蟹将",
  "agentDir": "C:\\Users\\Administrator\\.openclaw\\workspace\\agents\\xia-bing-xie-jiang",
  "model": {
    "primary": "siliconflow/stepfun-ai/Step-3.5-Flash"
  },
  "identity": {
    "name": "虾兵蟹将",
    "emoji": "⚔️"
  },
  "tools": {
    "allow": [
      "web_search", "web_fetch", "memory_search", "memory_get",
      "read", "write", "edit", "exec"
    ]
  }
}
```

关键参数说明：

-   `id`：Agent ID，命令行切换用 `/model [id]`
-   `agentDir`：Agent 目录绝对路径
-   `model.primary`：使用哪个模型，格式 `provider/model-id`
-   `identity`：显示名称和 emoji
-   `tools.allow`：允许这个 Agent 使用哪些工具

### 4\. **添加到允许列表，让主 Agent 可以调用它**

在 `agents.list[0]`（就是主 Agent）的 `subagents.allowAgents` 里面加上你的新 Agent ID：

```text
"subagents": {
  "allowAgents": [
    "crayfish_2nd",
    "crab_2nd",
    "xia-bing-xie-jiang"
  ]
}
```

### 5\. **把新模型加到默认允许列表**

在 `agents.defaults.models` 添加新模型条目：

```text
"siliconflow/stepfun-ai/Step-3.5-Flash": {}
```

这样 `/model` 就能找到了。

### 6\. **重启 Gateway 生效**

```text
openclaw gateway restart
```

* * *

### 第二步：使用多个 Agent

配置完之后，有两种用法：

### 方法一：当前会话直接切换

```text
/model crayfish_2nd
```

切换成功后，整个会话就变成小龙虾2代跟你聊天了。切回来：

```text
/model main
```

### 方法二：生成独立子会话

```text
/session spawn xia-bing-xie-jiang 帮我完成这个任务......
```

这样会创建一个隔离的子会话，由虾兵蟹将独立完成，不影响当前会话。

* * *

### 踩过的坑 & 解决方法

### 坑 1：**Windows 中文编码导致 Free Ride 读取配置失败** ❌

**问题：** 运行 `freeride auto` 时报错：

```text
UnicodeDecodeError: 'gbk' codec can't decode byte 0xbe in position 4371
```

**原因：** openclaw.json 保存是 UTF-8 编码，但 Python 在 Windows 上默认用 GBK 读取。

**解决：** 修改 `free-ride/main.py`，强制用 UTF-8 读写：

```text
# 改前
return json.loads(OPENCLAW_CONFIG_PATH.read_text())
# 改后
return json.loads(OPENCLAW_CONFIG_PATH.read_text(encoding='utf-8'))

# 写入也改：
OPENCLAW_CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding='utf-8')
```

改完再运行就好了 ✅

### 坑 2：**Agent ID 和模型名冲突** ❌

**问题：** 切换时报错：`Model "volcengine-plan/crayfish_2nd" is not allowed`

**原因：** OpenClaw 把 Agent ID 当成模型 ID 找模型去了。

**解决：** 记住：

-   `/model` 要切换的是 **Agent ID**，不是模型
-   正确写法：模型格式是 `provider/model-id`
-   示例：`siliconflow/stepfun-ai/Step-3.5-Flash`
-   你的自定义 Agent 直接 `/model [agent-id]` 就能切过去

### 坑 3：**路径不对找不到 SOUL.md** ❌

**问题：** Agent 启动失败，找不到身份文件。

**原因：** `agentDir` 写的是相对路径，OpenClaw 找错地方。

**解决：** 写绝对路径，比如 Windows：

```text
"agentDir": "C:\\Users\\Administrator\\.openclaw\\workspace\\agents\\xia-bing-xie-jiang"
```

Linux/macOS：

```text
"agentDir": "/home/xxx/.openclaw/workspace/agents/xia-bing-xie-jiang"
```

* * *

### 最终效果

配置完之后是什么样？

我们现在有了一个小团队：

```text
👑 红豆姐姐（最终大佬）
  └─ 👓 多彩眼镜宝（主 Agent，调度指挥）
      ├─ 🦞 小龙虾2代（干活能手，活泼风趣）
      ├─ 🦀 螃蟹2代（通用助手，免费 AI）
      └─ ⚔️ 虾兵蟹将（硅基流动主力）
```

想切换就切，想调用就调用，各个 Agent 保持各自风格，用不同模型，太爽了！

* * *

### 发布 wenyan-cli 到微信公众号踩坑记

这次为了发布文章到公众号，我们还踩了一堆 [Node.js](https://zhida.zhihu.com/search?content_id=271548056&content_type=Article&match_order=1&q=Node.js&zhida_source=entity) 依赖坑，分享一下：

问题

解决方法

Node v24 不兼容，启动崩溃

安装 nvm-windows，改用 Node v20 LTS

html-encoding-sniffer@6.x 依赖纯 ESM 模块报错

降级到 html-encoding-sniffer@2.0.0

jsdom 嵌套依赖还是有问题

降级 jsdom 到 v25，解决依赖冲突

封面图 404

换了一张可用的 [Unsplash](https://zhida.zhihu.com/search?content_id=271548056&content_type=Article&match_order=1&q=Unsplash&zhida_source=entity) 封面图

折腾了半小时，终于搞定成功发布！😭

* * *

### 最后总结

OpenClaw 配置多个 Agent 其实很简单，总结就是六步：

1️⃣ 创建目录 + 写 `SOUL.md` 2️⃣ 添加模型提供商 3️⃣ `agents.list` 加配置 4️⃣ 加入 `subagents.allowAgents` 5️⃣ 添加模型到 `defaults.models` 6️⃣ 重启 Gateway

遇到编码问题改两行代码就行，其他都是配置对路径就 OK。

你也赶紧来打造自己的助手团队吧！有问题欢迎交流～

* * *

_本文就是在 OpenClaw 实战记录，亲手配置，亲测可用 ✅_