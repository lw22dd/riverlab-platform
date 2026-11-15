# Stores 文件夹

<summary>Stores — Pinia 全局状态层</summary>

本目录存放跨页面共享的客户端状态：实验主题目录的加载缓存，以及用户的动效 / 镜头偏好。

## 目录结构

* [experiments.store.ts](experiments.store.ts) —— 主题目录加载、去重请求、缓存与筛选
* [preferences.store.ts](preferences.store.ts) —— 动效、电影镜头、键盘提示与最近场景偏好

# 数据流

1. 依赖：流入的方向和原因

从 `apis/experiment.api.ts` 拉取主题目录；从 `models` 获取 `ExperimentTheme` 等类型；偏好状态读写 `localStorage`。

2. 本模块：经过本文件夹做了什么

`experiments` 保证目录只加载一次并支持强制刷新；`preferences` 把用户选择持久化，并同步 `reduce-motion` 类到 `<html>`。

3. 输出：流出的方向和目的

向 `views` 与 `components` 提供响应式状态和动作，避免页面重复请求或各自维护偏好副本。
