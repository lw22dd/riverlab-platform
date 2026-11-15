# Apis 文件夹

<summary>Apis — HTTP 接口适配层</summary>

本目录只负责与后端通信：主题目录接口和会话同步接口，均可在未配置后端时安全降级。

## 目录结构

* [experiment.api.ts](experiment.api.ts) —— `GET /experiments`，失败或超时回退本地主题目录
* [session.api.ts](session.api.ts) —— `POST /sessions`，未配置 `VITE_API_BASE_URL` 时直接短路

# 数据流

1. 依赖：流入的方向和原因

从 `models` 获取 `ExperimentTheme`、`SessionRecord` 类型；从 `data/experimentThemes.ts` 获取本地回退目录；从 `import.meta.env` 读取 `VITE_API_BASE_URL`。

2. 本模块：经过本文件夹做了什么

`experiment.api.ts` 校验响应结构（数组或 `{ items }`），异常时回退本地 catalog；`session.api.ts` 做幂等保存，失败时抛出错误由调用方决定是否吞掉。

3. 输出：流出的方向和目的

主题目录流向 `stores/experiments.store.ts`；会话同步由 `services/session.service.ts` 调用，前端始终以本地存储为准。
