# Services 文件夹

<summary>Services — 会话持久化层</summary>

本目录承载无 UI 的会话存储逻辑：默认写入 localStorage，配置后端时再异步同步到 REST 接口。

## 目录结构

* [session.service.ts](session.service.ts) —— `SessionRecord` 的读写、上限裁剪、按 id 查询与可选远程同步

# 数据流

1. 依赖：流入的方向和原因

从 `models/session.model.ts` 获取持久化契约；从 `apis/session.api.ts` 获取可选的 REST 同步能力。

2. 本模块：经过本文件夹做了什么

以 `moral-lab.sessions.v1` 为键保存最近 60 条会话；读取时做结构过滤，损坏数据自动降级为空列表；保存后可选调用 `POST /sessions`，失败时静默保留本地快照。

3. 输出：流出的方向和目的

向 `views/scenario/ScenarioView.vue` 提供保存能力，向 `views/result/ResultView.vue` 与 `router` 提供按 id 读取 / 存在性校验。
