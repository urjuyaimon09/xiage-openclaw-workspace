---
name: tavily-search
description: Web search using Tavily API - optimized for AI agents and RAG applications. Python-based.
---

# Tavily Search (Python)

Web search using Tavily API - optimized for AI agents and RAG applications.

## Setup

```bash
pip install tavily-python
export TAVILY_API_KEY="tvly-your-api-key"
```

Or set in openclaw.json:
```json
{
  "skills": {
    "entries": {
      "tavily-search": {
        "enabled": true,
        "apiKey": "tvly-dev-xxxxx"
      }
    }
  }
}
```

## Quick Start

```python
from tavily import TavilyClient

client = TavilyClient(api_key="tvly-your-api-key")
response = client.search("Latest AI developments")

for result in response['results']:
    print(f"Title: {result['title']}")
    print(f"URL: {result['url']}")
    print(f"Content: {result['content'][:200]}...")
```

## Search Options

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| query | string | Search query | required |
| search_depth | string | "basic" or "comprehensive" | "basic" |
| max_results | int | Number of results (1-20) | 5 |
| include_answer | bool | Include AI-generated answer | False |
| include_raw_content | bool | Include full page content | False |
| topic | string | "general" or "news" | "general" |
| time_range | string | "day", "week", "month", "year" | - |

## Notes

- API key already configured: `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`
- Use `tavily` (Node.js) or `tavily-search` (Python) interchangeably
- Python version has better RAG support with `get_search_context()`
