/**
 * feedback-engine.js v1.0.0
 * 反馈分析引擎 - 对接 FEEDBACK_MODEL
 *
 * 功能：
 * - 反馈收集与分类
 * - 情感分析
 * - 归因分析
 * - 改进建议生成
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.cwd();
const PROJECTS_DIR = path.join(__dirname, '项目档案');

// ============================================================
// 反馈状态
// ============================================================

const FEEDBACK_STATES = {
  RAW: 'raw',             // 原始反馈
  ANALYZED: 'analyzed',   // 已分析
  ACTIONED: 'actioned',   // 已处理
  ARCHIVED: 'archived'    // 已归档
};

// ============================================================
// 情感分析（简单规则版）
// ============================================================

const SENTIMENT_KEYWORDS = {
  positive: [/很好|不错|优秀|棒|感谢|满意|喜欢|赞|太好了|帮了大忙/],
  negative: [/不好|差|烂|失望|抱怨|投诉|糟糕|错误|失败|有问题|不对/],
  neutral: [/一般|普通|正常|还行|可以/],
  urgent: [/紧急|马上|立刻|崩溃|宕机|危机|必须/]
};

function analyzeSentiment(text) {
  let sentiment = 'neutral';
  let intensity = 5;
  let isUrgent = false;

  for (const [type, patterns] of Object.entries(SENTIMENT_KEYWORDS)) {
    if (patterns.some(p => p.test(text))) {
      if (type === 'urgent') {
        isUrgent = true;
      } else {
        sentiment = type;
      }
    }
  }

  // 强度判断
  const exclamationCount = (text.match(/！/g) || []).length + (text.match(/!/g) || []).length;
  const questionCount = (text.match(/？/g) || []).length + (text.match(/\?/g) || []).length;
  intensity = Math.min(10, 5 + exclamationCount - questionCount);

  return { sentiment, intensity, isUrgent };
}

// ============================================================
// 归因分析（简单版）
// ============================================================

const CAUSAL_PATTERNS = [
  { pattern: /因为|由于|是因为/, type: 'cause' },
  { pattern: /所以|因此|导致|造成/, type: 'effect' },
  { pattern: /如果|假如|要是/, type: 'condition' },
  { pattern: /但是|然而|不过/, type: 'contrast' }
];

function analyzeCausality(text) {
  const results = [];

  for (const { pattern, type } of CAUSAL_PATTERNS) {
    if (pattern.test(text)) {
      results.push({ type, matched: true, segment: text });
    }
  }

  return results;
}

// ============================================================
// 反馈分类
// ============================================================

const FEEDBACK_CATEGORIES = {
  BUG: { name: '问题/BUG', priority: 9, color: 'red' },
  FEATURE: { name: '功能建议', priority: 5, color: 'blue' },
  UX: { name: '用户体验', priority: 6, color: 'yellow' },
  PERFORMANCE: { name: '性能问题', priority: 7, color: 'orange' },
  DOCUMENTATION: { name: '文档问题', priority: 3, color: 'gray' },
  SECURITY: { name: '安全问题', priority: 10, color: 'red' },
  OTHER: { name: '其他', priority: 1, color: 'white' }
};

function categorizeFeedback(text) {
  const textLower = text.toLowerCase();

  if (/错误|bug|崩溃|宕机|故障/.test(textLower)) return 'BUG';
  if (/慢|性能|卡|延迟|响应/.test(textLower)) return 'PERFORMANCE';
  if (/安全|漏洞|注入|xss|csrf/.test(textLower)) return 'SECURITY';
  if (/体验|界面|交互|操作|流程/.test(textLower)) return 'UX';
  if (/建议|功能|希望|能够|可以加/.test(textLower)) return 'FEATURE';
  if (/文档|说明|注释|readme/.test(textLower)) return 'DOCUMENTATION';

  return 'OTHER';
}

// ============================================================
// 改进建议生成（模板版）
// ============================================================

const IMPROVEMENT_TEMPLATES = {
  BUG: [
    '建议建立 BUG 追踪机制，记录问题现象、复现步骤、修复方案',
    '建议添加自动化测试用例，防止类似问题再次发生',
    '建议在发布前增加代码审查环节'
  ],
  FEATURE: [
    '建议评估需求合理性，纳入迭代计划',
    '建议与现有功能做整合评估，避免重复建设',
    '建议先做小规模试点，验证可行性'
  ],
  UX: [
    '建议收集更多用户反馈，明确优化方向',
    '建议进行可用性测试，发现具体问题点',
    '建议参考行业最佳实践，优化交互流程'
  ],
  PERFORMANCE: [
    '建议进行性能 profiling，定位瓶颈点',
    '建议建立性能监控告警机制',
    '建议评估是否需要架构层面的优化'
  ],
  DOCUMENTATION: [
    '建议补充相关文档，保持文档与代码同步',
    '建议增加使用示例或教程',
    '建议建立文档审查机制'
  ],
  SECURITY: [
    '建议立即修复，不建议延后处理',
    '建议进行安全审计，排查类似问题',
    '建议建立安全检查清单'
  ],
  OTHER: [
    '建议进一步明确需求细节',
    '建议收集更多背景信息再做判断'
  ]
};

function generateImprovements(category, sentiment) {
  const templates = IMPROVEMENT_TEMPLATES[category] || IMPROVEMENT_TEMPLATES.OTHER;
  const count = sentiment === 'negative' ? 3 : 2;
  return templates.slice(0, count);
}

// ============================================================
// 状态读写
// ============================================================

function createFeedbackId() {
  return 'F' + Date.now();
}

function saveFeedback(feedback) {
  const dir = path.join(PROJECTS_DIR, feedback.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'feedback-state.json');
  fs.writeFileSync(filePath, JSON.stringify(feedback, null, 2), 'utf8');
  return filePath;
}

function loadFeedback(id) {
  const filePath = path.join(PROJECTS_DIR, id, 'feedback-state.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFeedbacks() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => fs.existsSync(path.join(PROJECTS_DIR, f, 'feedback-state.json')))
    .map(f => loadFeedback(f));
}

// ============================================================
// 主流程
// ============================================================

function processFeedback(input, options = {}) {
  const id = createFeedbackId();
  const sentiment = analyzeSentiment(input);
  const category = categorizeFeedback(input);
  const causality = analyzeCausality(input);
  const improvements = generateImprovements(category, sentiment.sentiment);

  const feedback = {
    id,
    input,
    state: FEEDBACK_STATES.ANALYZED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sentiment,
    category,
    causality,
    improvements,
    source: options.source || 'manual',
    relatedEntity: options.relatedEntity || null,
    tags: options.tags || [],
    actioned: false,
    actionedAt: null
  };

  const filePath = saveFeedback(feedback);
  return { feedback, filePath };
}

function markActioned(id) {
  const feedback = loadFeedback(id);
  if (!feedback) return null;
  feedback.state = FEEDBACK_STATES.ACTIONED;
  feedback.actioned = true;
  feedback.actionedAt = new Date().toISOString();
  saveFeedback(feedback);
  return feedback;
}

// ============================================================
// 统计报告
// ============================================================

function generateReport(filter = {}) {
  const feedbacks = listFeedbacks();
  const filtered = feedbacks.filter(f => {
    if (filter.category && f.category !== filter.category) return false;
    if (filter.sentiment && f.sentiment.sentiment !== filter.sentiment) return false;
    if (filter.actioned !== undefined && f.actioned !== filter.actioned) return false;
    return true;
  });

  const categoryStats = {};
  const sentimentStats = {};
  let total = filtered.length;
  let actionedCount = 0;

  for (const f of filtered) {
    categoryStats[f.category] = (categoryStats[f.category] || 0) + 1;
    sentimentStats[f.sentiment.sentiment] = (sentimentStats[f.sentiment.sentiment] || 0) + 1;
    if (f.actioned) actionedCount++;
  }

  return {
    total,
    actioned: actionedCount,
    actionRate: total > 0 ? Math.round(actionedCount / total * 100) : 0,
    categoryStats,
    sentimentStats,
    averageIntensity: filtered.length > 0
      ? Math.round(filtered.reduce((sum, f) => sum + f.sentiment.intensity, 0) / filtered.length * 10) / 10
      : 0
  };
}

// ============================================================
// CLI 入口
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

if (command === 'process') {
  const input = args.slice(1).join(' ');
  if (!input) {
    console.error('用法: node feedback-engine.js process <反馈内容>');
    process.exit(1);
  }
  const result = processFeedback(input);
  console.log(JSON.stringify(result, null, 2));
} else if (command === 'list') {
  console.log(JSON.stringify(listFeedbacks(), null, 2));
} else if (command === 'show' && args[1]) {
  console.log(JSON.stringify(loadFeedback(args[1]), null, 2));
} else if (command === 'action' && args[1]) {
  console.log(JSON.stringify(markActioned(args[1]), null, 2));
} else if (command === 'report') {
  console.log(JSON.stringify(generateReport(), null, 2));
} else if (command === 'analyze') {
  const input = args.slice(1).join(' ');
  console.log(JSON.stringify({
    sentiment: analyzeSentiment(input),
    category: categorizeFeedback(input),
    improvements: generateImprovements(categorizeFeedback(input), analyzeSentiment(input).sentiment)
  }, null, 2));
} else {
  console.log(`feedback-engine.js v1.0.0
用法:
  node feedback-engine.js process <反馈内容>   处理反馈
  node feedback-engine.js list                 列出所有反馈
  node feedback-engine.js show <id>             查看反馈详情
  node feedback-engine.js action <id>           标记为已处理
  node feedback-engine.js report               生成统计报告
  node feedback-engine.js analyze <文本>       仅做分析测试`);
}

module.exports = { processFeedback, analyzeSentiment, categorizeFeedback, generateImprovements, markActioned, generateReport, FEEDBACK_STATES };
