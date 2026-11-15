# Components 文件夹

<summary>Components — 可复用 UI 组件层</summary>

本目录存放与业务页面解耦的 Vue 组件：门户卡片、场景 HUD、决策面板、叙事叠层与结果路径图。

## 目录结构

* [common/](common/) —— 通用组件
    * [Icon.vue](common/Icon.vue) —— 内联 SVG 图标集
    * [SiteHeader.vue](common/SiteHeader.vue) —— 站点导航与动效偏好入口
* [home/](home/) —— 门户展示
    * [ThemeCard.vue](home/ThemeCard.vue) —— 主题卡片
    * [ThemeCover.vue](home/ThemeCover.vue) —— 封面图，缺失时回退程序化插画
    * [ThemeArtwork.vue](home/ThemeArtwork.vue) —— 程序化主题插画
    * [ScenarioGlyph.vue](home/ScenarioGlyph.vue) —— 场景图形符号
* [result/](result/) —— 结果展示
    * [StoryRoute.vue](result/StoryRoute.vue) —— 会话路径图
* [scenario/](scenario/) —— 运行页组件
    * [BriefingOverlay.vue](scenario/BriefingOverlay.vue) —— 开场简报
    * [DecisionPanel.vue](scenario/DecisionPanel.vue) —— 决策选项与倒计时
    * [DecisionProgramPanel.vue](scenario/DecisionProgramPanel.vue) —— 自动驾驶决策表
    * [NarrativePanel.vue](scenario/NarrativePanel.vue) —— 叙事与后果文本
    * [NodeGraphModal.vue](scenario/NodeGraphModal.vue) —— 节点图可视化
    * [OutcomeOverlay.vue](scenario/OutcomeOverlay.vue) —— 结局结算叠层
    * [ScenarioHud.vue](scenario/ScenarioHud.vue) —— 指标 HUD 与变化提示
    * [SessionLogDrawer.vue](scenario/SessionLogDrawer.vue) —— 会话日志抽屉

# 数据流

1. 依赖：流入的方向和原因

从 `models` 获取 props 类型；从 `data` 获取决策节点统计；从 `engine/decisionProgram` 获取决策表编译结果；从 `stores` 读取偏好；从 `utils` 读取格式化函数。

2. 本模块：经过本文件夹做了什么

组件只负责展示与交互，通过 `props` 接收数据、通过 `emits` 上报动作，不直接调用引擎、不直接持久化，也不持有全局状态。

3. 输出：流出的方向和目的

事件流向 `views`，由页面统一编排；`ScenarioView` 组合 `scenario/*` 与 Three.js 舞台，`HomeView` / `ThemeDetailView` / `ResultView` 组合门户与结果组件。
