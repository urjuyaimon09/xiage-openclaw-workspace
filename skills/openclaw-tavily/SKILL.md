---
name: tavily
description: AI-optimized web search using Tavily API. Designed for AI agents - returns clean, relevant content.
---

# Tavily Search

AI-optimized web search using Tavily API. Designed for AI agents - returns clean, relevant content.

## Setup

Needs `TAVILY_API_KEY` environment variable.

Get your API key at https://tavily.com

## Search

```
node {baseDir}/scripts/search.mjs "query"
node {baseDir}/scripts/search.mjs "query" -n 10
node {baseDir}/scripts/search.mjs "query" --deep
node {baseDir}/scripts/search.mjs "query" --topic news
```

## Options

- `-n` : Number of results (default: 5, max: 20)
- `--deep`: Use advanced search for deeper research (slower, more comprehensive)
- `--topic` : Search topic - general (default) or news
- `--days` : For news topic, limit to last n days

## Extract content from URL

```
node {baseDir}/scripts/extract.mjs "https://example.com/article"
```

## Notes

- Tavily is optimized for AI - returns clean, relevant snippets
- Use `--deep` for complex research questions
- Use `--topic news` for current events
