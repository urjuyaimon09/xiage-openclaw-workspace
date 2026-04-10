{
  "action": "react",
  "channelId": "C123",
  "messageId": "1712023032.1234",
  "emoji": "✅"
}

{
  "action": "reactions",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}

{
  "action": "sendMessage",
  "to": "channel:C123",
  "content": "Hello from Clawdbot"
}

{
  "action": "editMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234",
  "content": "Updated text"
}

{
  "action": "deleteMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}

{
  "action": "readMessages",
  "channelId": "C123",
  "limit": 20
}

{
  "action": "pinMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}

{
  "action": "unpinMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}

{
  "action": "listPins",
  "channelId": "C123"
}

{
  "action": "memberInfo",
  "userId": "U123"
}

{
  "action": "emojiList"
}

Slack Use when you need to control Slack from Clawdbot via the slack tool, including reacting to messages or pinning/unpinning items in Slack channels or DMs. MIT-0 · Free to use, modify, and redistribute. No attribution required. ⭐ 108 · 33k · 1.2k current installs · 1.2k all-time installs by Peter Steinberger · @steipete Highlighted MIT-0 Security Scan VirusTotal VirusTotal Benign View report → OpenClaw OpenClaw Suspicious high confidence The skill&#x27;s described functionality is coherent with controlling Slack, but the SKILL.md expects a &#x27;slack&#x27; CLI and a bot token while the registry metadata does not declare any required binary or credential — an important mismatch you should resolve before installing. Details ▾ ! Purpose &amp; Capability Name/description and the SKILL.md actions (react, send/edit/delete messages, pins, member info, emoji list) are consistent with a Slack control skill. However, the instructions explicitly reference using a &#x27;slack&#x27; tool and &#x27;the bot token configured for Clawdbot&#x27; while the registry metadata lists no required binaries or environment variables — the skill expects access that it does not declare. ℹ Instruction Scope SKILL.md limits behavior to Slack operations and does not ask to read local files or unrelated env vars. That scope is appropriate, but it relies on an externally configured bot token and a &#x27;slack&#x27; tool present in the agent environment; those implicit dependencies widen the runtime surface without being documented. ✓ Install Mechanism Instruction-only skill with no install spec or code files — lowest install risk. Nothing is written to disk by the skill itself based on provided metadata. ! Credentials The skill will need a Slack bot token and a usable Slack CLI/tool to operate, but requires.env and primary credential are empty. Not declaring the token or tool is a proportionality problem: users can&#x27;t see what secrets will be used or by whom, which risks accidental credential exposure or unexpected actions if a workspace token is already configured. ✓ Persistence &amp; Privilege always is false and the skill does not request persistent system-wide changes. The agent can invoke the skill autonomously (default), which is expected for an integration that controls Slack; this is not by itself a red flag. What to consider before installing This skill appears to do what it says (control Slack), but it fails to declare two important runtime dependencies: the &#x27;slack&#x27; CLI/tool and the Slack bot token it will use. Before installing, verify where the bot token comes from and who controls it, confirm the token&#x27;s scope (least privilege: only the scopes needed), and ensure the &#x27;slack&#x27; tool on the agent is the official/expected binary. If you cannot verify the token origin or the CLI, do not install. Prefer a version of the skill that explicitly lists required binaries and environment variables (e.g., SLACK_BOT_TOKEN) and provides a trusted source/homepage for the tool. Like a lobster shell, security has layers — review code before you run it. Current version v 1.0.0 Download zip latest v k974s2nwqdrhhcyyetbj0d3x8h7ykacv License MIT-0 Free to use, modify, and redistribute. No attribution required. Terms https://spdx.org/licenses/MIT-0.html Files Compare Versions SKILL.md Slack Actions Overview Use slack to react, manage pins, send/edit/delete messages, and fetch member info. The tool uses the bot token configured for Clawdbot. Inputs to collect channelId and messageId (Slack message timestamp, e.g. 1712023032.1234 ). For reactions, an emoji (Unicode or :name: ). For message sends, a to target ( channel:&lt;id&gt; or user:&lt;id&gt; ) and content . Message context lines include slack message id and channel fields you can reuse directly. Actions Action groups Action group Default Notes reactions enabled React + list reactions messages enabled Read/send/edit/delete pins enabled Pin/unpin/list memberInfo enabled Member info emojiList enabled Custom emoji list React to a message { &quot;action&quot;: &quot;react&quot;, &quot;channelId&quot;: &quot;C123&quot;, &quot;messageId&quot;: &quot;1712023032.1234&quot;, &quot;emoji&quot;: &quot;✅&quot; } List reactions { &quot;action&quot;: &quot;reactions&quot;, &quot;channelId&quot;: &quot;C123&quot;, &quot;messageId&quot;: &quot;1712023032.1234&quot; } Send a message { &quot;action&quot;: &quot;sendMessage&quot;, &quot;to&quot;: &quot;channel:C123&quot;, &quot;content&quot;: &quot;Hello from Clawdbot&quot; } Edit a message { &quot;action&quot;: &quot;editMessage&quot;, &quot;channelId&quot;: &quot;C123&quot;, &quot;messageId&quot;: &quot;1712023032.1234&quot;, &quot;content&quot;: &quot;Updated text&quot; } Delete a message { &quot;action&quot;: &quot;deleteMessage&quot;, &quot;channelId&quot;: &quot;C123&quot;, &quot;messageId&quot;: &quot;1712023032.1234&quot; } Read recent messages { &quot;action&quot;: &quot;readMessages&quot;, &quot;channelId&quot;: &quot;C123&quot;, &quot;limit&quot;: 20 } Pin a message { &quot;action&quot;: &quot;pinMessage&quot;, &quot;channelId&quot;: &quot;C123&quot;, &quot;messageId&quot;: &quot;1712023032.1234&quot; } Unpin a message { &quot;action&quot;: &quot;unpinMessage&quot;, &quot;channelId&quot;: &quot;C123&quot;, &quot;messageId&quot;: &quot;1712023032.1234&quot; } List pinned items { &quot;action&quot;: &quot;listPins&quot;, &quot;channelId&quot;: &quot;C123&quot; } Member info { &quot;action&quot;: &quot;memberInfo&quot;, &quot;userId&quot;: &quot;U123&quot; } Emoji list { &quot;action&quot;: &quot;emojiList&quot; } Ideas to try React with ✅ to mark completed tasks. Pin key decisions or weekly status updates. Files 1 total SKILL.md 2.3 KB Select a file Select a file to preview. Comments Loading comments…