# Data 文件夹

<summary>Data — 场景配置与校验层</summary>

本目录负责场景包的加载、zod 严格校验、节点图语义校验与注册，同时维护门户的「主题 → 变式」目录。

## 目录结构

* [index.ts](index.ts) —— 场景注册表；导出 `scenarios`、`scenarioPackages`、`getScenario`、`getScenarioPackage`
* [scenario.schema.ts](scenario.schema.ts) —— zod v4 严格 schema 与 `parseScenario`
* [validation.ts](validation.ts) —— 图完整性校验：悬挂边、不可达节点、未知指标、默认分支等
* [experimentThemes.ts](experimentThemes.ts) —— 门户主题目录（主题 → 场景变式）
* [scenarios.test.ts](scenarios.test.ts) —— 五份场景包的校验与代表性路径测试
* [experimentThemes.test.ts](experimentThemes.test.ts) —— 主题目录与场景注册表的一致性测试
* [scenarios/](scenarios/) —— 可执行场景包
    * [autonomous-driving.json](scenarios/autonomous-driving.json) —— 无人驾驶：暴雨夜避险与数据处置
    * [trolley-problem.json](scenarios/trolley-problem.json) —— 电车悖论：扳道岔
    * [trolley-footbridge.json](scenarios/trolley-footbridge.json) —— 电车悖论：天桥推人
    * [building-collapse.json](scenarios/building-collapse.json) —— 大楼倒塌：工程隐患与责任链
    * [dujiangyan-build.json](scenarios/dujiangyan-build.json) —— 都江堰建造实录：角色引导、六次工程判断与分阶段建造动画

# 数据流

1. 依赖：流入的方向和原因

从 `models` 获取 `ScenarioDefinition`、`Condition` 等契约；从 `scenarios/*.json` 读取静态配置；依赖 `zod` 完成结构校验。

2. 本模块：经过本文件夹做了什么

`parseScenario` 先做结构校验，`assertValidScenario` 再做语义校验（边、可达性、指标引用、决策引用、结局兜底），最后注册为 `scenarios` 与 `scenarioPackages`。

3. 输出：流出的方向和目的

向 `engine` 提供可信的 `ScenarioDefinition`；向 `views`、`components` 提供 `ScenarioPackage` 与统计函数；向 `apis/experiment.api.ts` 提供本地主题目录作为后端失败时的回退。
