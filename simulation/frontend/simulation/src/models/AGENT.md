# Models 文件夹

<summary>Models — 跨层类型契约层</summary>

本目录只存放 TypeScript 类型与常量，不包含运行时代码；它定义场景 DSL、运行时状态、会话快照和门户展示的共同语言。

## 目录结构

* [common.model.ts](common.model.ts) —— `Primitive` 字面量与 `Tone` 语义色
* [scenario.model.ts](scenario.model.ts) —— 场景 DSL：节点、条件、效果、指标、结局
* [simulation.model.ts](simulation.model.ts) —— 黑板书、决策记录、日志、评分与结局结果
* [session.model.ts](session.model.ts) —— `SessionRecord` 持久化契约
* [experiment.model.ts](experiment.model.ts) —— 主题 / 变式 / 封面等门户模型
* [presentation.model.ts](presentation.model.ts) —— 主题色、卡片元数据、舞台热点
* [decisionProgram.model.ts](decisionProgram.model.ts) —— 自动驾驶决策表与默认规则

# 数据流

1. 依赖：流入的方向和原因

无业务依赖；仅使用 TypeScript 标准类型，因此可以被任何层安全引用。

2. 本模块：经过本文件夹做了什么

把「静态场景」「一次运行」「一次会话」「门户展示」拆成互不耦合的类型契约，避免 DSL 与 UI 互相污染。

3. 输出：流出的方向和目的

以 `import type` 被 `data`、`engine`、`three`、`components`、`views`、`stores`、`services`、`apis` 消费，保证各层对同一份数据结构达成一致。
