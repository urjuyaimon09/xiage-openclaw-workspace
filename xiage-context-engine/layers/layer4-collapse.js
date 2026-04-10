/**
 * Layer 4: Context Collapse - 折叠旧窗口为摘要
 *
 * 当context消耗>=90%时触发
 * 将前半部分旧消息压缩成结构化摘要，保留近期完整细节
 *
 * 简化版：不调用MiniMax API，用规则+模板生成摘要
 * （调用API会消耗额外token，这里用固定规则）
 */

const path = require('path')
const fs = require('fs')

/**
 * 生成结构化摘要
 */
function generateSummary(messages) {
  if (!messages || messages.length === 0) return null

  const ts = new Date().toISOString().slice(0, 10)
  const lines = [`## ${ts} 上下文压缩摘要（${messages.length}条消息）`]

  // 提取主题/关键词
  const topics = extractTopics(messages)
  if (topics.length > 0) {
    lines.push(`**主题：** ${topics.join(' / ')}`)
  }

  // 提取用户问题
  const userQuestions = messages
    .filter(m => m.role === 'user')
    .slice(0, 5)
    .map(m => extractText(m.content).slice(0, 80))
    .filter(t => t.length > 10)

  if (userQuestions.length > 0) {
    lines.push(`**讨论过的问题：**`)
    userQuestions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q}${q.length >= 80 ? '…' : ''}`)
    })
  }

  // 提取结论（assistant回复中含"结论"/"决定"的内容）
  const conclusions = messages
    .filter(m => m.role === 'assistant')
    .map(m => extractText(m.content))
    .filter(t => t.includes('结论') || t.includes('同意') || t.includes('决定'))
    .slice(0, 3)
    .map(t => t.slice(0, 100))

  if (conclusions.length > 0) {
    lines.push(`**结论：** ${conclusions.join('；')}`)
  }

  // 提取工具调用（反映做过什么操作）
  const toolCalls = messages
    .filter(m => m.tool_calls || m.role === 'tool')
    .map(m => {
      if (m.tool_calls) {
        return m.tool_calls.map(tc => tc.function?.name || tc.name).filter(Boolean)
      }
      return [m.name || 'tool']
    })
    .flat()
    .filter((v, i, a) => a.indexOf(v) === i) // 去重
    .slice(0, 10)

  if (toolCalls.length > 0) {
    lines.push(`**执行过的操作：** ${toolCalls.join(', ')}`)
  }

  return lines.join('\n')
}

function extractText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(c => typeof c === 'string' ? c : c.text || '').join('')
  }
  if (content && typeof content === 'object') {
    return content.text || content.content || JSON.stringify(content)
  }
  return String(content || '')
}

function extractTopics(messages) {
  // 简单关键词提取
  const keywords = []
  const patterns = [
    /skill/i, /memory/i, /context/i, /compact/i,
    /github/i, /git/i, /commit/i, /push/i,
    /feishu/i, /飞书/i, /gateway/i, /openclaw/i,
    /进化/i, /改进/i, /方案/i, /规则/i
  ]

  for (const msg of messages) {
    const text = extractText(msg.content || '')
    for (const p of patterns) {
      if (p.test(text) && !keywords.includes(p.source.replace(/[^\w\u4e00-\u9fa5]/g, ''))) {
        keywords.push(p.source.replace(/[^\w\u4e00-\u9fa5]/g, ''))
      }
    }
  }

  return [...new Set(keywords)].slice(0, 5)
}

/**
 * Layer 4: 折叠旧窗口
 * @param {object} ctx - runtimeContext
 * @param {object} engine - 注册上下文（用于访问父级方法）
 * @returns {{ summary: string, keptMessages: number, collapsedCount: number }}
 */
async function layer4Collapse(ctx, engine) {
  let messages = []
  if (Array.isArray(ctx.messages)) {
    messages = ctx.messages
  } else if (Array.isArray(ctx)) {
    messages = ctx
  }

  if (messages.length < 10) {
    return { summary: null, keptMessages: messages.length, collapsedCount: 0 }
  }

  // 保留后半部分（近期消息），压缩前半部分
  const mid = Math.floor(messages.length / 2)
  const oldMessages = messages.slice(0, mid)
  const newMessages = messages.slice(mid)

  // 生成摘要
  const summary = generateSummary(oldMessages)

  // 用摘要替换旧消息
  const summaryMsg = {
    role: 'system',
    content: `[历史摘要 - ${new Date().toISOString().slice(0, 10)}]\n${summary}`,
    _is_compression_artifact: true
  }

  // 清空前半部分，保留摘要
  messages.splice(0, mid, summaryMsg)

  console.log(`[Layer4] 折叠${mid}条消息为摘要，保留${newMessages.length + 1}条`)

  return {
    summary: summary || '（无有效内容）',
    keptMessages: newMessages.length + 1,
    collapsedCount: mid
  }
}

module.exports = { layer4Collapse }
