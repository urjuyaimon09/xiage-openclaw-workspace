/**
 * Layer 1: 工具结果外部化
 *
 * 当工具输出超过THRESHOLD字符时，写入tmp/tool-results/，
 * 在原位置替换为文件路径引用。
 *
 * 原理：Claude Code StreamingToolExecutor的工具结果超限处理方式
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const THRESHOLD = 2000 // 超过此字符数则外化
const TMP_DIR = path.join(__dirname, '..', 'tmp', 'tool-results')

function uid() {
  return crypto.randomBytes(8).toString('hex')
}

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true })
  }
}

/**
 * 扫描runtimeContext.recentToolResults，将超限条目外化
 * @param {object} ctx - OpenClaw runtimeContext
 * @returns {{ count: number }}
 */
async function layer1Externalize(ctx) {
  ensureTmpDir()

  // runtimeContext的结构取决于OpenClaw版本，尝试多种访问方式
  let results = []

  if (ctx.recentToolResults) {
    results = ctx.recentToolResults
  } else if (ctx.messages) {
    // 兼容方式：从messages中提取工具结果
    results = ctx.messages.filter(m => m.role === 'tool' || m.name === 'tool_result')
  } else if (Array.isArray(ctx)) {
    results = ctx.filter(m => m.role === 'tool' || m.tool_results)
  }

  let count = 0

  for (const entry of results) {
    // 提取工具结果的文本内容
    let text = ''
    if (typeof entry.content === 'string') {
      text = entry.content
    } else if (Array.isArray(entry.content)) {
      text = entry.content.map(c => typeof c === 'string' ? c : c.text || '').join('')
    } else if (entry.text) {
      text = entry.text
    }

    if (text.length > THRESHOLD) {
      const filename = `tool-${uid()}-${Date.now()}.txt`
      const filepath = path.join(TMP_DIR, filename)

      try {
        fs.writeFileSync(filepath, text, 'utf8')
        // 替换原内容为路径引用
        if (typeof entry.content === 'string') {
          entry.content = `[工具结果已外化，见文件: ${filepath}]`
        } else if (entry.text) {
          entry.text = `[工具结果已外化，见文件: ${filepath}]`
        } else if (Array.isArray(entry.content)) {
          entry.content = [{ type: 'text', text: `[工具结果已外化，见文件: ${filepath}]` }]
        }
        count++
        console.log(`[Layer1] 外化 ${filename} (${text.length}→${filepath.length}字符)`)
      } catch (err) {
        console.error(`[Layer1] 写入失败 ${filepath}: ${err.message}`)
      }
    }
  }

  return { count }
}

module.exports = { layer1Externalize }
