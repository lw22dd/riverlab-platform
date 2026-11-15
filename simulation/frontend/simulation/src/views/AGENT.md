# Views 文件夹

<summary>Views — 页面级编排层</summary>

本目录存放路由页面，负责把数据、引擎、Three.js 舞台与 UI 组件组装成完整流程。

## 目录结构

* [home/HomeView.vue](home/HomeView.vue) —— 主题首页：实验主题与本地推演记录入口
* [experiments/ThemeDetailView.vue](experiments/ThemeDetailView.vue) —— 主题详情：场景变式、伦理透镜与相关主题
* [scenario/ScenarioView.vue](scenario/ScenarioView.vue) —— 3D 实验运行页：简报、决策、HUD、图谱、日志与结算
* [result/ResultView.vue](result/ResultView.vue) —— 单次会话报告：雷达图、规则审计、路径与导出

# 数据流

1. 依赖：流入的方向和原因

从 `stores` 获取主题目录与偏好；从 `data` 获取场景包；从 `engine` 获取解释器、FSM 与决策表编译；从 `three` 获取舞台；从 `services` 读取 / 保存会话；从 `components` 组合界面。

2. 本模块：经过本文件夹做了什么

`ScenarioView` 是运行时的总编排：创建 `SimulationEngine` 与 XState 机器，订阅事件，驱动 Three.js 舞台和 HUD；`HomeView` / `ThemeDetailView` 只消费门户目录；`ResultView` 读取会话快照并渲染报告。

3. 输出：流出的方向和目的

输出为路由页面（`/`、`/experiments/:themeId`、`/scenario/:id`、`/result/:sessionId`）；运行结束的 `SessionRecord` 交给 `services` 持久化，并跳转到结果页。
