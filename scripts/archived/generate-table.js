
const puppeteer = require('puppeteer');

const table = `
<table>
  <thead>
    <tr>
      <th>一级</th>
      <th>二级</th>
      <th>简单介绍</th>
      <th>变动</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>1.1 用户输入层</strong></td>
      <td>（一级无下级二级）</td>
      <td>飞书群消息 → OpenClaw网关 → 路由给AI</td>
      <td>无</td>
    </tr>
    <tr>
      <td rowspan="6"><strong>1.2 上下文加载层</strong></td>
      <td>1.2.1 AGENTS.md</td>
      <td>全局工作规则</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.2.2 SOUL.md</td>
      <td>性格语气要求（坚果定的）</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.2.3 IDENTITY.md</td>
      <td>我是谁（虾哥）</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.2.4 USER.md</td>
      <td>你是谁（坚果）</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.2.5 memory/YYYY-MM-DD.md</td>
      <td>今日/昨日对话记录</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.2.6 MEMORY.md</td>
      <td>长期记忆（仅主会话加载）</td>
      <td>无</td>
    </tr>
    <tr>
      <td rowspan="3"><strong>1.3 工具调用层</strong></td>
      <td>1.3.1 内置工具</td>
      <td>读/写文件、执行命令、浏览器控制、飞书API</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.3.2 Skill生态</td>
      <td>从ClawHub安装的扩展能力（比如faster-whisper）</td>
      <td>➕ 新增faster-whisper</td>
    </tr>
    <tr>
      <td>1.3.3 联网搜索</td>
      <td>Brave/Tavily 联网搜索信息</td>
      <td>无</td>
    </tr>
    <tr>
      <td rowspan="2"><strong>1.4 推理层</strong></td>
      <td>1.4.1 生成回复</td>
      <td>根据上下文+工具结果推理生成</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.4.2 规则遵循</td>
      <td>回复需要满足所有层级的规则约束</td>
      <td>无</td>
    </tr>
    <tr>
      <td rowspan="2"><strong>1.5 输出层</strong></td>
      <td>1.5.1 回复返回</td>
      <td>生成的回复返回飞书群</td>
      <td>无</td>
    </tr>
    <tr>
      <td>1.5.2 记忆归档</td>
      <td>自动归档对话记忆到本地文件</td>
      <td>无</td>
    </tr>
  </tbody>
</table>

<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  padding: 20px;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th, td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}
th {
  background-color: #f2f2f2;
}
tr:nth-child(even) {
  background-color: #f9f9f9;
}
</style>
`;

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(table);
  await page.screenshot({ path: 'architecture_table.png', fullPage: true });
  await browser.close();
  console.log('Saved to architecture_table.png');
})();
