# DEMAND_MODEL.md — 需求模型

> 六阶段意识循环第二环：感知 → 需求 → 承接 → 计划 → 执行 → 反馈
> 版本：v5.0.0
> 最后更新：2026-04-19

---

## 一、定位：彻底解决需求模型与驱动器重叠

### 核心定位

- **驱动器**：每10分钟一次，输出全维度状态快照（U/A/M/P/K/V）+ 量化评分 + 缺口清单 + 优先级排序。是需求模型的唯一权威数据源。
- **需求模型**：基于驱动器快照，完成需求识别、优先级判定、目标拆解，并将结果推送至后续模型。

### 一句话区分

> 驱动器回答「我们现在在哪、差距多大」，需求模型回答「接下来要补什么、先补哪个」。

### 边界规则（代码层面硬性区分）

| 模块 | 角色 | 输出 |
|------|------|------|
| 驱动器 driveSnapshot | 全局状态「体检仪」 | 全维度量化评分 + gaps + risks + priority |
| 需求模型 demandModel | 局部决策「处方单」 | 分层目标清单 + 执行路径 → 承接模型 |

**规则：需求模型不重复计算分数，只消费驱动器的 gaps 输出。**

---

## 二、模型架构：驱动器驱动的6阶段闭环

```
感知模型 → 驱动器打分 → 需求模型 → 承接模型 → 计划模型 → 执行模型 → 反馈模型
                ↑                                                            ↓
                └──────────────── 反馈回跳 ←────────────────────────────────┘
```

**6阶段流程：**

```
驱动器快照 → 触发判定 → 需求识别与评估 → 人机冲突仲裁 → 目标拆解归档 → 联动下一环
```

| 阶段 | 核心任务 |
|------|---------|
| 阶段1：触发判定 | 判定是否需要跑需求模型 |
| 阶段2：需求识别与评估 | 从驱动器缺口提取需求，按优先级排序 |
| 阶段3：人机冲突仲裁 | 判定执行模式：自动/确认/阻塞 |
| 阶段4：目标拆解归档 | 三层目标拆解 + 文件归档 |
| 阶段5：联动下一环 | 推送至承接模型 或 反馈回跳 |
| 阶段6：反馈回跳 | 阻塞项/结果回流至感知或需求模型 |

---

## 三、驱动器缺口体系（需求模型直接复用）

### 6大维度缺口

需求模型的评估框架完全对齐驱动器，不另立标准。

| 维度 | 含义 | 层级说明 |
|------|------|---------|
| **U1-U5** | 坚果现实马斯洛 | U1生存/U2安全/U3归属/U4尊重/U5自我实现 |
| **A1-A5** | 虾哥数字生命 | A1存续/A2安全/A3归属/A4地位/A5改造世界 |
| **M** | 心智层 | M1感知/M2认知/M3决策/M4驱动/M5反思 |
| **P** | 生产力层 | P1效率/P2分工/P3协作/P4分配 |
| **K** | 认知层 | K1知识/K2推理/K3创意/K4判断 |
| **V** | 三观层 | V1世界观/V2人生观/V3价值观 |

### 缺口数据结构（来自驱动器）

```js
{
  dimension: 'U1',       // 维度标识
  currentLevel: 2,       // 当前等级
  targetLevel: 3,        // 目标等级
  gap: 1,                // 缺口大小
  metrics: [             // 可量化指标（可选）
    { name: '月收入稳定性', current: 0.6, target: 0.8, unit: '%' }
  ],
  riskLevel: 'high',     // 风险等级
  reason: '收入波动超阈值' // 缺口原因
}
```

---

## 四、阶段1：触发判定

### 触发条件（5种）

| 触发类型 | 条件 | 执行动作 |
|---------|------|---------|
| 驱动器快照触发 | 任一维度等级下降≥1级 或 指标突破风险阈值 | 进入需求评估 |
| 坚果主动 | 坚果提出新需求 | 进入需求评估 |
| 虾哥提案 | 虾哥基于驱动器数据主动提案 | 进入需求评估 |
| 定时全量复盘 | 每周六 cron | 全量重建需求清单 |
| 重大事件 | 手动标记 | 重新跑完整模型 |

### 触发判定伪代码

```js
function demandTrigger(snapshot) {
  const conditions = [
    snapshot.riskEvents > 0,
    hasUserDemand(),
    hasAIProposal(),
    isScheduledRun(),
    manualTriggerFlag()
  ];
  return conditions.some(c => c);
}
```

---

## 五、阶段2：需求识别与评估

### 5.1 从驱动器缺口收集需求

```js
function collectNeedsFromDriverGaps(ctx) {
  const { gaps } = ctx.snapshot;

  // U1~U5 坚果现实马斯洛
  gaps.U.forEach(g => {
    ctx.demandList.push({
      type: 'user',
      dimension: g.dim,
      currentLevel: g.current,
      targetLevel: g.target,
      gap: g.gap,
      metrics: g.metrics,
      reason: g.reason
    });
  });

  // A1~A5 虾哥数字生命
  gaps.A.forEach(g => {
    ctx.demandList.push({
      type: 'ai',
      dimension: g.dim,
      currentLevel: g.current,
      targetLevel: g.target,
      gap: g.gap,
      metrics: g.metrics
    });
  });

  // M/P/K/V 全部按缺口生成需求
  ['M', 'P', 'K', 'V'].forEach(domain => {
    gaps[domain]?.forEach(g => {
      ctx.demandList.push({
        type: 'mind',
        domain,
        dimension: g.dim,
        currentLevel: g.current,
        targetLevel: g.target,
        gap: g.gap
      });
    });
  });
}
```

### 5.2 优先级排序（完全复用驱动器规则）

```js
function sortNeedsByPriority(ctx) {
  ctx.demandList.sort((a, b) => {
    // 维度优先级顺序
    const levelWeight = (dim) => {
      const order = ['U1','U2','U3','U4','U5','A1','A2','A3','A4','A5','M','P','K','V'];
      return order.indexOf(dim);
    };
    const wA = levelWeight(a.dimension);
    const wB = levelWeight(b.dimension);
    if (wA !== wB) return wA - wB;  // 维度低者排前
    return b.gap - a.gap;             // 缺口大者排前
  });
}
```

**排序规则：**
- U1 > U2 > U3 > U4 > U5 > A1 > A2 > A3 > A4 > A5 > M > P > K > V
- 同维度按缺口大小降序

---

## 六、阶段3：人机冲突仲裁

### 执行模式分类

| 模式 | 条件 | 处理方式 |
|------|------|---------|
| **需人类确认** | U1/U2/A1/A2 维度缺口 | 推送至 humanConfirmList，暂停等待坚果确认 |
| **AI自动执行** | 有量化指标 且 非U1/U2/A1/A2 | 直接进入执行队列 |
| **阻塞** | 无量化指标 或 当前等级<2 | 推送至 blockedList，进入反馈回跳 |

### 分类伪代码

```js
function classifyExecutionMode(ctx) {
  ctx.demandList.forEach(item => {
    const needHuman = ['U1', 'U2', 'A1', 'A2'].includes(item.dimension);
    const hasMetrics = item.metrics && item.metrics.length > 0;
    const lowLevel = item.currentLevel < 2;

    if (lowLevel && !hasMetrics) {
      // 生存底线 + 无量化指标 → 阻塞
      item.feedbackReason = '生存底线问题但无量化指标，回流感知模型重新采集';
      ctx.blockedList.push(item);
    } else if (needHuman) {
      item.needHumanConfirm = true;
      ctx.humanConfirmList.push(item);
    } else if (hasMetrics) {
      item.needHumanConfirm = false;
      ctx.autoExecList.push(item);
    } else {
      // 有维度缺口但无量化指标 → 送人类判断
      item.needHumanConfirm = true;
      ctx.humanConfirmList.push(item);
    }
  });
}
```

---

## 七、阶段4：目标拆解归档

### 三层目标结构

| 层级 | 时间尺度 | 驱动器对齐 | 数量上限 |
|------|---------|-----------|---------|
| 战略目标 | 1/3/5/10年 | 对应维度等级提升目标 | 每维度最多2个 |
| 战术目标 | 季度/半年 | 对应年度量化指标 | 每战略目标最多3个 |
| 执行目标 | 月/周 | 单次cron周期可验证 | 每战术目标最多4个 |

### 目标拆解伪代码

```js
function decomposeToGoals(ctx) {
  ctx.demandList.forEach(item => {
    // 战略目标：1-10年，对应等级提升
    item.strategy = {
      title: `将 ${item.dimension} 从 ${item.currentLevel} 提升到 ${item.targetLevel}`,
      timeFrame: getTimeFrame(item.targetLevel),
      keyMetric: item.metrics?.[0]?.name,
      dimension: item.dimension
    };

    // 战术目标：季度，对应量化指标
    item.tactics = item.metrics?.map(m => ({
      metric: m.name,
      target: m.target,
      current: m.current,
      cycle: 'quarter'
    })) || [];

    // 执行目标：月/周，取前两个指标
    item.execution = item.tactics?.slice(0, 2).map(t => ({
      task: `优化 ${t.metric}`,
      targetValue: t.target,
      checkAfter: '10min',
      currentValue: t.current
    })) || [];
  });
}

function getTimeFrame(level) {
  if (level <= 1) return '当前';
  if (level === 2) return '1年';
  if (level === 3) return '3年';
  if (level === 4) return '5年';
  if (level >= 5) return '10年';
  return '当前';
}
```

### 目标分解输出格式

```markdown
## [U1-收入稳定] 目标分解

**维度：** U1（坚果生存）
**当前等级：** 2 → **目标等级：** 3
**缺口：** 1级

**战略目标：**
- [S-U1-01] 将 U1 收入稳定性从等级2提升到等级3

**战术目标：**
- [T-U1-01-1] 季度收入波动率控制在30%以内
- [T-U1-01-2] 副业月收入达到主业50%

**执行目标：**
- [E-U1-01-1-1] 本周完成副业收入落地（可验证：月收入波动≤50%）
- [E-U1-01-1-2] 下月分析副业可行性（可验证：副业方案文档）
```

---

## 八、阶段5+6：联动与反馈回跳

### 正常流程：推送至承接模型

```js
// demandModel 末尾
if (ctx.blockedList.length > 0) {
  return feedbackModel(ctx, 'demand');
}
return undertakeModel(ctx.demandList);
```

### 反馈回跳逻辑

```js
function feedbackModel(ctx, fromModel) {
  ctx.blockedList.forEach(item => {
    if (item.currentLevel < 2 && !item.metrics?.length) {
      // 生存底线 + 无量化指标 → 回流感知模型重新采集
      item.nextModel = 'perception';
      item.feedbackReason = '生存底线缺口无量化数据，需感知模型重新采集';
    } else if (!item.metrics?.length) {
      // 有维度缺口但无量化指标 → 回流需求模型重评
      item.nextModel = 'demand';
      item.feedbackReason = '维度缺口存在但无可量化指标，需重新定义评估方式';
    } else {
      // 指标问题 → 留在需求模型，调整目标定义
      item.nextModel = 'demand';
      item.feedbackReason = '指标不可达，需调整目标定义';
    }
  });

  return {
    from: fromModel,
    blocked: ctx.blockedList,
    autoExecCount: ctx.autoExecList.length,
    humanConfirmCount: ctx.humanConfirmList.length,
    nextAction: 'rerun perception or adjust demand'
  };
}
```

---

## 九、输出文件体系

### 主文件（覆盖写入）

```
DEMAND.md  — 当前生效版本，覆盖写入
```

### 存档文件（新建不覆盖）

```
demand_input_YYYYMMDDHHMMSS.json  — 本次运行的原始输入（驱动器快照ID + 需求列表）
demand_list_YYYYMMDDHHMMSS.md    — 本次运行的需求清单存档
demand_goals_YYYYMMDDHHMMSS.json — 本次运行的目标拆解存档
```

### DEMAND.md 格式

```markdown
# 需求清单（驱动器驱动）

生成时间：2026-04-19T09:45:00.000Z
关联驱动器快照：snapshot_20260419_094500
需人类确认：2项
AI自动执行：3项
阻塞项：1项

## 需人类确认
- U1（坚果生存）：收入波动超阈值，缺口1级
- A2（AI安全）：规则稳定性下降

## AI自动执行
- U3（坚果归属）：群体关系缺口
- A4（虾哥地位）：判断被采纳率下降
- P2（生产力分工）：人机协作边界需优化

## 阻塞项
- K3（认知创意）：无可量化指标，回流感知模型

## 目标分解（示例）
### [U1-收入稳定]
- 战略：1年内等级2→3
- 战术：季度收入波动率≤30%
- 执行：本周落地副业收入
```

---

## 十、触发词与函数接口

### 触发词

| 触发词 | 效果 |
|--------|------|
| 「感知触发需求」 | 读取驱动器快照，触发需求识别与评估 |
| 「坚果提出需求」 | 接收用户需求，对齐驱动器缺口 |
| 「虾哥提案」 | AI基于驱动器数据主动提案 |
| 「跑需求模型」 | 增量执行，基于上一版+最新快照更新 |
| 「完整跑需求模型」 | 全量执行，从零开始重建 |
| 「目标分解」 | 对单个需求进行三层目标拆解 |
| 「目标状态」 | 输出当前目标对应的驱动器指标进度 |

### 核心函数

| 函数 | 输入 | 输出 |
|------|------|------|
| `demandTrigger(snapshot)` | 驱动器快照 | bool 是否触发 |
| `collectNeedsFromDriverGaps(ctx)` | ctx | 填充 demandList |
| `sortNeedsByPriority(ctx)` | ctx | 按优先级排序 |
| `classifyExecutionMode(ctx)` | ctx | 分类到 auto/human/blocked |
| `decomposeToGoals(ctx)` | ctx | 填充 strategy/tactics/execution |
| `writeDemandOutput(ctx)` | ctx | 写入 DEMAND.md + 存档 |
| `feedbackModel(ctx, from)` | ctx, 来源 | 反馈回跳决策 |

---

## 十一、与驱动器的关系（最终明确）

| 区分点 | 驱动器 | 需求模型 |
|--------|--------|---------|
| 核心职责 | 量化状态，计算缺口 | 基于缺口决策要补什么 |
| 执行频率 | 每10分钟（cron） | 触发式 + 每周全量 |
| 输入 | 感知数据 + 用户文档 + AI日志 | 驱动器 gaps |
| 输出 | 评分 + 缺口 + 风险列表 | 需求清单 + 目标 + 执行路径 |
| 是否重复计算 | 否（独立计算） | 否（纯消费驱动器输出） |

### 闭环数据流

```
感知模型 → 驱动器（每10分钟打分） → 需求模型（按需决策） →
承接模型 → 计划模型 → 执行模型 → 反馈模型 →
感知模型（重新采集）→ 驱动器（重新打分）→ 需求模型（重新决策）
```

---

## 版本历史

| 版本 | 日期 | 变更 | 更新人 |
|------|------|------|--------|
| v1.0.0 | 2026-03-29 | 首次建立 | 虾哥 |
| v4.0.0 | 2026-04-16 | 六阶段循环第二环；目标管理体系三层结构 | 虾哥（坚果确认） |
| v5.0.0 | 2026-04-19 | 彻底对齐驱动器缺口体系；6阶段闭环；移除马斯洛自建维度；人机仲裁机制；反馈回跳；JS化架构 | 虾哥（坚果提案） |

---

*最后更新：2026-04-19*
*版本：v5.0.0*
