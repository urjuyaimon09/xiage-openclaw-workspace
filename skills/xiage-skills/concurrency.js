/**
 * runWithConcurrency - 并发执行只读任务，串行执行写任务
 *
 * 参照 Claude Code StreamingToolExecutor 的并发调度逻辑：
 * - 只读任务（type: 'read'）并行执行
 * - 写任务（type: 'write'）串行执行，前面的只读任务全部完成后才执行
 * - 写任务之后的任务会等待写任务完成后再继续
 *
 * @param {Array<{name: string, type: 'read'|'write', fn: () => Promise}>} tasks
 * @returns {Promise<Array<{name: string, result: any, error: any}>>}
 */
async function runWithConcurrency(tasks) {
  const results = new Array(tasks.length)
  const queue = [...tasks]  // 浅拷贝，不修改原数组

  let writeInFlight = false  // 是否有写任务正在执行
  let writeBarrierIndex = -1  // 写任务之前的最末索引

  function classify(t) {
    return t.type === 'write' ? 'write' : 'read'
  }

  async function executeTask(task, index) {
    try {
      const result = await task.fn()
      return { name: task.name, result, error: null }
    } catch (err) {
      return { name: task.name, result: null, error: err }
    }
  }

  // 找下一个连续只读批次（不受写任务阻挡的部分）
  function nextReadBatch(startIndex) {
    const batch = []
    let i = startIndex
    while (i < queue.length && classify(queue[i]) === 'read') {
      batch.push({ task: queue[i], index: i })
      i++
    }
    return { batch, endIndex: i }
  }

  // 主循环：按批次处理
  let cursor = 0
  while (cursor < queue.length) {
    const { batch, endIndex } = nextReadBatch(cursor)

    if (batch.length > 0) {
      // 并发执行当前只读批次
      const settled = await Promise.all(
        batch.map(({ task, index }) => executeTask(task, index))
      )
      settled.forEach((r, i) => {
        results[batch[i].index] = r
      })
      cursor = endIndex
      writeBarrierIndex = endIndex - 1
    }

    // 如果遇到写任务，等所有前面的完成后再串行执行
    if (cursor < queue.length && classify(queue[cursor]) === 'write') {
      const task = queue[cursor]
      const index = cursor
      const result = await executeTask(task, index)
      results[index] = result
      cursor++
      writeBarrierIndex = index
    }
  }

  return results
}

module.exports = { runWithConcurrency }
