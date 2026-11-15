# Engine 文件夹

<summary>Engine — 无 DOM 的推演内核层</summary>

本目录实现节点图解释器、条件语言、评分规则与表现状态机，全部与 Vue / Three.js 解耦，可在 Vitest 中无头运行。

## 目录结构

* [SimulationEngine.ts](SimulationEngine.ts) —— 节点图解释器：黑板状态、决策、日志、事件与结算
* [conditions.ts](conditions.ts) —— 共享条件语言解释器与 `conditionSummary`
* [scoring.ts](scoring.ts) —— 规则求值、五维权重总分、等级与结局选择
* [decisionProgram.ts](decisionProgram.ts) —— 把自动驾驶决策表编译为具体选项
* [eventBus.ts](eventBus.ts) —— 类型化事件总线
* [events.ts](events.ts) —— `SimulationEvents` 事件契约
* [scenarioMachine.ts](scenarioMachine.ts) —— XState 表现层：并行区域、嵌套 flow、延迟迁移
* [interpreter.test.ts](interpreter.test.ts) —— 解释器与评分路径测试
* [scenarioMachine.test.ts](scenarioMachine.test.ts) —— 表现状态机测试

# 数据流

1. 依赖：流入的方向和原因

从 `models` 读取场景 DSL、运行时状态与会话契约；从 `data` 接收已通过 zod 与图校验的 `ScenarioDefinition`。

2. 本模块：经过本文件夹做了什么

`SimulationEngine` 解释 `narrative / decision / consequence / branch / end` 节点，维护指标、flag、决策、路径与日志，并通过 `TypedEventBus` 发出 `node / choice / metric / stage / inspect / finished` 事件；`scoring` 在结束时按规则结算；`scenarioMachine` 只描述表现层的阶段与节奏。

3. 输出：流出的方向和目的

事件流向 `views/scenario/ScenarioView.vue`，再分发给 `three` 舞台与 `components` 面板；结算得到 `SessionRecord` 与 `Evaluation`，交给 `services/session.service.ts` 持久化，并进入结果页。
