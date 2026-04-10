/**
 * Layer 2: 历史消息打分 & 归档
 *
 * Claude Code的规则：对历史消息打分，删除低分片段
 * 分数规则：
 *   +3  用户消息
 *   +5  含"同意"/"结论"的assistant消息
 *   +2  有工具调用的assistant消息（保留工具链上下文）
 *   -2  纯工具返回（tool role）
 *   -5  错误信息
 *   -1  过短内容（<20字符）
 *
 * 保留：用户消息、结论性消息
 * 删除：临时调试输出、重复确认、错误堆栈、中间草稿
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const SCORED_DIR = path.join(__dirname, '..', 'tmp', 'scored')

function uid() {
  return crypto.randomBytes(8).toString('hex')
}

function ensureScoredDir() {
  if (!fs.existsSync(SCORED_DIR)) {
    fs.mkdirSync(SCORED_DIR, { recursive: true })
  }
}

/**
 * 对单条消息打分
 */
function scoreMessage(msg) {
  let s = 0

  if (msg.role === 'system') return 0 // system prompt不删

  if (msg.role === 'user') {
    s += 3 // 用户消息，高优
  }

  if (msg.role === 'assistant') {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '')
    if (content.includes('同意') || content.includes('结论') || content.includes('决定')) {
      s += 5 // 含结论，高优
    }
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      s += 1 // 有工具调用，保留
    }
  }

  if (msg.role === 'tool') {
    s -= 3 // 工具返回，中低优
    if (msg.is_error || (msg.content && String(msg.content).includes('Error'))) {
      s -= 5 // 错误信息，最低
    }
  }

  // 过短内容扣分
  const textLen = typeof msg.content === 'string'
    ? msg.content.length
    : JSON.stringify(msg.content || '').length
  if (textLen < 20) s -= 1

  return s
}

/**
 * 扫描消息历史，打分后归档低分消息
 * @param {object} ctx - OpenClaw runtimeContext
 * @returns {{ removed: number }}
 */
async function layer2ScoreMessages(ctx) {
  ensureScoredDir()

  let messages = []
  if (Array.isArray(ctx.messages)) {
    messages = ctx.messages
  } else if (Array.isArray(ctx)) {
    messages = ctx
  }

  let removed = 0

  // 从后往前扫描，保留关键消息
  const toRemove = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const score = scoreMessage(msg)

    if (score < 0) {
      toRemove.push({ msg, index: i })
    }
  }

  // 逆序删除（避免index偏移）
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const { msg, index } = toRemove[i]
    try {
      const filename = `scored-${uid()}-${Date.now()}.json`
      fs.writeFileSync(
        path.join(SCORED_DIR, filename),
        JSON.stringify(msg, null, 2),
        'utf8'
      )
      messages.splice(index, 1)
      removed++
    } catch (err) {
      console.error(`[Layer2] 归档失败: ${err.message}`)
    }
  }

  if (removed > 0) {
    console.log(`[Layer2] 归档${removed}条低分消息`)
  }

  return { removed }
}

module.exports = { layer2ScoreMessages }
