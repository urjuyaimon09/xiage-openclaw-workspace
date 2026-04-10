mkdir -p ~/.config/notion
echo "ntn_your_key_here" > ~/.config/notion/api_key

NOTION_KEY=$(cat ~/.config/notion/api_key)
curl -X GET "https://api.notion.com/v1/..." \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json"

curl -X POST "https://api.notion.com/v1/search" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d &#x27;{"query": "page title"}&#x27;

curl "https://api.notion.com/v1/pages/{page_id}" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03"

curl "https://api.notion.com/v1/blocks/{page_id}/children" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03"

curl -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d &#x27;{
    "parent": {"database_id": "xxx"},
    "properties": {
      "Name": {"title": [{"text": {"content": "New Item"}}]},
      "Status": {"select": {"name": "Todo"}}
    }
  }&#x27;

curl -X POST "https://api.notion.com/v1/data_sources/{data_source_id}/query" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d &#x27;{
    "filter": {"property": "Status", "select": {"equals": "Active"}},
    "sorts": [{"property": "Date", "direction": "descending"}]
  }&#x27;

curl -X POST "https://api.notion.com/v1/data_sources" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d &#x27;{
    "parent": {"page_id": "xxx"},
    "title": [{"text": {"content": "My Database"}}],
    "properties": {
      "Name": {"title": {}},
      "Status": {"select": {"options": [{"name": "Todo"}, {"name": "Done"}]}},
      "Date": {"date": {}}
    }
  }&#x27;

curl -X PATCH "https://api.notion.com/v1/pages/{page_id}" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d &#x27;{"properties": {"Status": {"select": {"name": "Done"}}}}&#x27;

curl -X PATCH "https://api.notion.com/v1/blocks/{page_id}/children" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d &#x27;{
    "children": [
      {"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Hello"}}]}}
    ]
  }&#x27;

Notion Notion API for creating and managing pages, databases, and blocks. MIT-0 · Free to use, modify, and redistribute. No attribution required. ⭐ 212 · 66.7k · 1.9k current installs · 2k all-time installs by Peter Steinberger · @steipete MIT-0 Security Scan VirusTotal VirusTotal Benign View report → OpenClaw OpenClaw Suspicious medium confidence The skill&#x27;s instructions match a Notion API helper, but metadata omits the sensitive config path/credential it expects and the skill source is unknown — this mismatch and plaintext key guidance are concerning. Details ▾ ✓ Purpose &amp; Capability Name/description match the SKILL.md: it documents how to call the Notion API to create/read/update pages, data sources, and blocks. The curl examples and Notion endpoints are coherent with the stated purpose. ℹ Instruction Scope The runtime instructions explicitly tell the user/agent to store and read a Notion API key from ~/.config/notion/api_key and then use it in Authorization headers. That behavior is expected for a Notion integration, but the doc also gives an explicit plaintext storage pattern (echo into a file) which is risky — and the skill gives the agent direct shell-style commands to read that file. ✓ Install Mechanism Instruction-only skill with no install spec and no code files — lowest install risk. Nothing is downloaded or written by an installer. ! Credentials Registry metadata lists no required env vars, no primary credential, and no required config paths, yet SKILL.md both instructs creating an API key and reads a specific config file (~/.config/notion/api_key). That mismatch (credential/config use present in instructions but not declared in metadata) and the guidance to store the API key as plaintext are disproportionate and should be clarified. ✓ Persistence &amp; Privilege always:false and default autonomous invocation are normal. The skill does not request persistent system-level privileges. However, because the skill&#x27;s instructions access a local key file, autonomous invocation combined with the undeclared credential is an additional risk to consider. What to consider before installing This skill appears to be a straightforward Notion API helper, but the SKILL.md expects a Notion API key stored at ~/.config/notion/api_key while the registry metadata does not declare that config path or any primary credential. Before installing: (1) confirm the skill publisher/source (the skill lists an unknown source), (2) avoid storing keys as plaintext with echo — consider using your platform&#x27;s secret store or an environment variable, (3) verify whether the agent will be allowed to access ~/.config/notion (and whether autonomous agent invocation is acceptable), and (4) request an updated skill metadata that declares the config path or primary credential so the behavior is explicit. If the publisher cannot justify the missing metadata or you cannot constrain where the key is stored, treat the skill as risky. Like a lobster shell, security has layers — review code before you run it. Current version v 1.0.0 Download zip latest v k97f11bk9neh14b8pxakg2t0wd7yjb90 License MIT-0 Free to use, modify, and redistribute. No attribution required. Terms https://spdx.org/licenses/MIT-0.html Runtime requirements 📝 Clawdis Files Compare Versions SKILL.md notion Use the Notion API to create/read/update pages, data sources (databases), and blocks. Setup Create an integration at https://notion.so/my-integrations Copy the API key (starts with ntn_ or secret_ ) Store it: mkdir -p ~/.config/notion echo &quot;ntn_your_key_here&quot; &gt; ~/.config/notion/api_key Share target pages/databases with your integration (click &quot;...&quot; → &quot;Connect to&quot; → your integration name) API Basics All requests need: NOTION_KEY=$(cat ~/.config/notion/api_key) curl -X GET &quot;https://api.notion.com/v1/...&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; \ -H &quot;Content-Type: application/json&quot; Note: The Notion-Version header is required. This skill uses 2025-09-03 (latest). In this version, databases are called &quot;data sources&quot; in the API. Common Operations Search for pages and data sources: curl -X POST &quot;https://api.notion.com/v1/search&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; \ -H &quot;Content-Type: application/json&quot; \ -d &#x27;{&quot;query&quot;: &quot;page title&quot;}&#x27; Get page: curl &quot;https://api.notion.com/v1/pages/{page_id}&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; Get page content (blocks): curl &quot;https://api.notion.com/v1/blocks/{page_id}/children&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; Create page in a data source: curl -X POST &quot;https://api.notion.com/v1/pages&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; \ -H &quot;Content-Type: application/json&quot; \ -d &#x27;{ &quot;parent&quot;: {&quot;database_id&quot;: &quot;xxx&quot;}, &quot;properties&quot;: { &quot;Name&quot;: {&quot;title&quot;: [{&quot;text&quot;: {&quot;content&quot;: &quot;New Item&quot;}}]}, &quot;Status&quot;: {&quot;select&quot;: {&quot;name&quot;: &quot;Todo&quot;}} } }&#x27; Query a data source (database): curl -X POST &quot;https://api.notion.com/v1/data_sources/{data_source_id}/query&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; \ -H &quot;Content-Type: application/json&quot; \ -d &#x27;{ &quot;filter&quot;: {&quot;property&quot;: &quot;Status&quot;, &quot;select&quot;: {&quot;equals&quot;: &quot;Active&quot;}}, &quot;sorts&quot;: [{&quot;property&quot;: &quot;Date&quot;, &quot;direction&quot;: &quot;descending&quot;}] }&#x27; Create a data source (database): curl -X POST &quot;https://api.notion.com/v1/data_sources&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; \ -H &quot;Content-Type: application/json&quot; \ -d &#x27;{ &quot;parent&quot;: {&quot;page_id&quot;: &quot;xxx&quot;}, &quot;title&quot;: [{&quot;text&quot;: {&quot;content&quot;: &quot;My Database&quot;}}], &quot;properties&quot;: { &quot;Name&quot;: {&quot;title&quot;: {}}, &quot;Status&quot;: {&quot;select&quot;: {&quot;options&quot;: [{&quot;name&quot;: &quot;Todo&quot;}, {&quot;name&quot;: &quot;Done&quot;}]}}, &quot;Date&quot;: {&quot;date&quot;: {}} } }&#x27; Update page properties: curl -X PATCH &quot;https://api.notion.com/v1/pages/{page_id}&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; \ -H &quot;Content-Type: application/json&quot; \ -d &#x27;{&quot;properties&quot;: {&quot;Status&quot;: {&quot;select&quot;: {&quot;name&quot;: &quot;Done&quot;}}}}&#x27; Add blocks to page: curl -X PATCH &quot;https://api.notion.com/v1/blocks/{page_id}/children&quot; \ -H &quot;Authorization: Bearer $NOTION_KEY&quot; \ -H &quot;Notion-Version: 2025-09-03&quot; \ -H &quot;Content-Type: application/json&quot; \ -d &#x27;{ &quot;children&quot;: [ {&quot;object&quot;: &quot;block&quot;, &quot;type&quot;: &quot;paragraph&quot;, &quot;paragraph&quot;: {&quot;rich_text&quot;: [{&quot;text&quot;: {&quot;content&quot;: &quot;Hello&quot;}}]}} ] }&#x27; Property Types Common property formats for database items: Title: {&quot;title&quot;: [{&quot;text&quot;: {&quot;content&quot;: &quot;...&quot;}}]} Rich text: {&quot;rich_text&quot;: [{&quot;text&quot;: {&quot;content&quot;: &quot;...&quot;}}]} Select: {&quot;select&quot;: {&quot;name&quot;: &quot;Option&quot;}} Multi-select: {&quot;multi_select&quot;: [{&quot;name&quot;: &quot;A&quot;}, {&quot;name&quot;: &quot;B&quot;}]} Date: {&quot;date&quot;: {&quot;start&quot;: &quot;2024-01-15&quot;, &quot;end&quot;: &quot;2024-01-16&quot;}} Checkbox: {&quot;checkbox&quot;: true} Number: {&quot;number&quot;: 42} URL: {&quot;url&quot;: &quot;https://...&quot;} Email: {&quot;email&quot;: &quot;a@b.com&quot;} Relation: {&quot;relation&quot;: [{&quot;id&quot;: &quot;page_id&quot;}]} Key Differences in 2025-09-03 Databases → Data Sources: Use /data_sources/ endpoints for queries and retrieval Two IDs: Each database now has both a database_id and a data_source_id Use database_id when creating pages ( parent: {&quot;database_id&quot;: &quot;...&quot;} ) Use data_source_id when querying ( POST /v1/data_sources/{id}/query ) Search results: Databases return as &quot;object&quot;: &quot;data_source&quot; with their data_source_id Parent in responses: Pages show parent.data_source_id alongside parent.database_id Finding the data_source_id: Search for the database, or call GET /v1/data_sources/{data_source_id} Notes Page/database IDs are UUIDs (with or without dashes) The API cannot set database view filters — that&#x27;s UI-only Rate limit: ~3 requests/second average Use is_inline: true when creating data sources to embed them in pages Files 1 total SKILL.md 4.9 KB Select a file Select a file to preview. Comments Loading comments…