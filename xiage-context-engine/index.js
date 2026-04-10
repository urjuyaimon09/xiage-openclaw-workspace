/**
 * xiage-context-engine - 5层上下文压缩插件
 *
 * 触发时机：context token消耗达到阈值时，由OpenClaw自动调用compact()
 * 不依赖模型执行，是代码层面的自动处理
 *
 * 5层策略：
 *   < 60%  budget → 跳过
 *   60-70%       → Layer1: 工具结果>2000字→磁盘
 *   70-90%       → Layer1 + Layer2: 消息打分，低分→归档
 *   90%+         → Layer1 + Layer2 + Layer4: 折叠旧窗口为摘要→hot/current.md
 *   98%+         → Layer5: memory flush（由memory-flush插件处理，这里不重复）
 */

const { layer1Externalize } = require('./layers/layer1-externalize')
const { layer2ScoreMessages } = require('./layers/layer2-score')
const { layer4Collapse } = require('./layers/layer4-collapse')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function uid() {
  return crypto.randomBytes(8).toString('hex')
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  fs.appendFileSync(
    path.join(__dirname, 'tmp', 'engine.log'),
    `[${ts}] ${msg}\n`
  )
}

/**
 * 主入口：注册ContextEngine
 * OpenClaw会在context快满时自动调用此方法
 */
async function register(runtime) {
  runtime.registerContextEngine('xiage-context', {
    priority: 100, // 高优先级，抢在默认压缩前

    async compact({ sessionKey, reason, budget, runtimeContext }) {
      const used = budget.tokenBudgetUsed
      const total = budget.tokenBudgetTotal || 1
      const ratio = used / total

      log(`compact触发 reason=${reason} ratio=${(ratio * 100).toFixed(1)}% used=${used}`)

      const steps = []

      try {
        // Layer 1: 工具结果外部化（任何时候都检查）
        const l1 = await layer1Externalize(runtimeContext)
        if (l1.count > 0) {
          steps.push(`L1外化${l1.count}个工具结果`)
          log(`L1完成: ${l1.count}个结果外化`)
        }

        // Layer 2: 消息打分（>=70%触发）
        if (ratio >= 0.70) {
          const l2 = await layer2ScoreMessages(runtimeContext)
          if (l2.removed > 0) {
            steps.push(`L2删除${l2.removed}条低分消息`)
            log(`L2完成: 删除${l2.removed}条`)
          }
        }

        // Layer 4: 折叠旧窗口（>=90%触发）
        if (ratio >= 0.90) {
          const l4 = await layer4Collapse(runtimeContext, this)
          if (l4.summary) {
            await appendToHotCurrent(l4)
            steps.push(`L4折叠→hot/current.md`)
            log(`L4完成: 摘要已写入`)
          }
        }

        if (steps.length === 0) {
          log('无需压缩')
          return null
        }

        const instructions = `上下文已压缩：${steps.join('；')}。请基于上述内容继续。`
        log(`压缩完成: ${steps.join('; ')}`)

        return {
          instructions,
          sessionUpdates: null
        }

      } catch (err) {
        log(`错误: ${err.message}\n${err.stack}`)
        return null // 失败则回退，不阻塞模型
      }
    }
  })

  log('xiage-context-engine 注册完成')
  console.log('[xiage-context-engine] 5层压缩引擎已注册')
}

async function appendToHotCurrent(l4) {
  const hotPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    '.openclaw', 'workspace', 'memory', 'hot', 'current.md'
  )

  if (!fs.existsSync(hotPath)) {
    log(`WARN: hot/current.md不存在，跳过L4写入`)
    return
  }

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const entry = `\n\n### 上下文压缩记录 ${ts}\n- 压缩摘要：${l4.summary}\n- 保留消息数：${l4.keptMessages}条\n- 折叠消息数：${l4.collapsedCount}条\n`

  fs.appendFileSync(hotPath, entry, 'utf8')
  log(`L4摘要已追加到 ${hotPath}`)
}

module.exports = { register }
