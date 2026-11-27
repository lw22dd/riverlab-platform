# Three 文件夹

<summary>Three — 3D 舞台与场景建模层</summary>

本目录存放 Three.js 表现层：共享舞台、程序化几何体工厂，以及各场景（含都江堰建造动画）的实体、动画、机位与交互。

## 目录结构

* [stage.ts](stage.ts) —— `Stage`：渲染器、相机、灯光、氛围预设、CSS2D 热点、GSAP 补间与清理
* [primitives.ts](primitives.ts) —— 程序化几何体工厂（建筑、道路、车辆、人物、轨道、雨、护栏等）
* [chronicle/](chronicle/) —— 都江堰「开山导江记」纪事引擎（纪事页与运行页共用）
    * [spec.ts](chronicle/spec.ts) —— 反演规格单一真源：断面表、堤轴线、宝瓶口走廊、八幕时间轴、屏幕标签
    * [terrain.ts](chronicle/terrain.ts) —— 解析式高程 `sampleTerrain`（河床 / 西岸 / 玉垒山脊 / 缺口开挖 / 平原渠槽）
    * [hydraulics.ts](chronicle/hydraulics.ts) —— 六项分流、宽顶堰溢流、排沙效率、抗冲比、淘滩过流
    * [experiments.ts](chronicle/experiments.ts) —— 四张答辩面板的采样与刻度
    * [scene.ts](chronicle/scene.ts) —— 三维世界（地形、连续水体 shader、岩塞、竹笼/金刚堤/飞沙堰/杩槎、渠网田块、粒子、标签）
* [scenes/](scenes/) —— 场景构建与舞台句柄
    * [index.ts](scenes/index.ts) —— `buildScenarioScene` 按 `DomainKind` 分发
    * [types.ts](scenes/types.ts) —— `ScenarioSceneOptions`、`ScenarioStageHandle`、`CameraPreset`
    * [autonomous.ts](scenes/autonomous.ts) —— 无人驾驶：暴雨、斑马线、货车与 EDR 取证
    * [trolley.ts](scenes/trolley.ts) —— 电车悖论：轨道、道岔、电车与撞击
    * [footbridge.ts](scenes/footbridge.ts) —— 天桥推人：天桥、护栏与坠落
    * [collapse.ts](scenes/collapse.ts) —— 大楼倒塌：基坑、脚手架、污水与坍塌
    * [dujiangyan-chronicle.ts](scenes/dujiangyan-chronicle.ts) —— 都江堰运行页舞台：把纪事引擎包成 `ScenarioStageHandle`，自带 rAF 与 CSS2D 热点层
    * [dujiangyan-chronicle-map.ts](scenes/dujiangyan-chronicle-map.ts) —— `dujiangyan:*` 动作 → 纪元时间窗与分支（纯函数，可单测）
    * [dujiangyan.ts](scenes/dujiangyan.ts) —— v1 沙盘（已从分发点摘除，保留作对照）

# 数据流

1. 依赖：流入的方向和原因

从 `models/presentation.model.ts` 获取 `StageHotspot` 等展示契约；依赖 `three`、`gsap` 与浏览器 Canvas / WebGL；不引用 `engine`，只接收 `ScenarioView` 转发的动作字符串。

2. 本模块：经过本文件夹做了什么

`Stage` 统一渲染管线与相机编排；`primitives` 以确定性随机数生成可复用的城市部件；`scenes/*` 组装实体、定义动画与机位，并暴露统一的 `ScenarioStageHandle`。


3. 输出：流出的方向和目的

向 `views/scenario/ScenarioView.vue` 返回舞台句柄，供其调用 `focus`、`applyAction`、`setAmbience`、`markHotspot`、`pause`、`dispose`，把引擎事件翻译成可见的 3D 表演。


## 动画约定
动画不是通用动画系统：没有骨骼、动画剪辑或 `AnimationMixer`。`Stage` 只提供 `tweenTo`（GSAP 补间）、`addUpdater`（逐帧回调）、`after`（延迟）与 `cameraTo` / `shake` / `setAmbience` 等原语，各场景在自己的 `handleAction` 里用 `tw` / `later` 直接补间 `THREE.Group` 的 position / rotation / scale（电车沿 `CatmullRomCurve3` 补间 `progress` 再反算位置与朝向）。汽车与人物都是刚体拼装，仅都江堰的 `createFigure` 通过肩部 pivot 句柄做摆臂，因此动作复用粒度停在原语与模型级，未到动作级。
