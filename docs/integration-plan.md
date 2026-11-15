# 平台拼装契约

本文档冻结仿真、全景、总服务器三端的路由、登录态、会话数据与权限边界。实现期间字段名、路由前缀和本地存储键不再随意变更。

## 1. 部署拓扑

三个应用进程：

| 进程 | 技术 | 职责 |
| --- | --- | --- |
| `web` | Nginx | 仿真主入口 `/`，代理 `/panorama/` 与 `/api/` |
| `panorama` | Nginx | 全景 SPA 静态托管，含平台后台 `/panorama/admin` |
| `api` | Go 模块化单体 | 用户/权限、全景资源、切片、仿真会话、汇总 |

MySQL、Redis、MinIO 为基础设施，不作为应用进程计数。

## 2. 路由

| URL | 归属 | 说明 |
| --- | --- | --- |
| `/login` | 仿真 SPA | 统一登录 |
| `/` | 仿真 SPA | 主平台首页 |
| `/experiments/:themeId` | 仿真 SPA | 主题详情 |
| `/scenario/:id` | 仿真 SPA | 实验运行 |
| `/result/:sessionId` | 仿真 SPA | 本地结果页，不请求后端 |
| `/panorama/` | 全景 SPA | 全景首页/地图 |
| `/panorama/space/:id` | 全景 SPA | 景区场景列表 |
| `/panorama/panorama?id=&scene=` | 全景 SPA | 全景播放器 |
| `/panorama/admin` | 全景 SPA | 平台后台 |
| `/admin` | 网关 | 302 到 `/panorama/admin` |
| `/api/v1/*` | API | Go 后端 |

## 3. 统一登录态

两个前端共用同一个同源 localStorage 键：`user`。

```json
{
  "isLogin": true,
  "userInfo": {
    "id": 20240001,
    "username": "20240001",
    "nickname": "张三",
    "role_id": 3,
    "role": { "id": 3, "name": "student" },
    "is_super_admin": false,
    "class_id": 1
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

约定：

- 只允许统一登录页写入完整登录态；全景侧只读取和清理，不单独创建登录态。
- 登录接口：`POST /api/v1/auth/login`，响应为 `{ code, msg, data: { access_token, refresh_token, user } }`。
- 刷新接口：`POST /api/v1/auth/refresh`，请求体 `{ refresh_token }`。
- 登出接口：`POST /api/v1/user/logout`。
- 401 时清理 `user` 并跳转 `/login?redirect=<当前路径>`；`redirect` 只允许同源绝对路径。

## 4. 仿真会话

### 4.1 上报

`POST /api/v1/sim/sessions`，需要登录。

- 请求体：完整 `SessionRecord` JSON。
- 服务端只从 JWT 取 `user_id`，忽略请求体中的任何用户字段。
- 按 `session.id` 幂等 upsert；若已存在且属于其他用户，返回 `409`。
- 请求体上限 2 MiB。
- 服务端接收时间写入 `received_at`。

### 4.2 查询

```http
GET /api/v1/sim/sessions/:id
GET /api/v1/sim/sessions?page=1&page_size=20&scenario_id=&class_id=&from=&to=
```

范围：

- 学生：仅本人。
- 教师：本人 + 自己担任班主任班级的学生。
- 管理员：全局。

### 4.3 汇总

```http
GET /api/v1/sim/analytics/overview?from=&to=&scenario_id=&class_id=
GET /api/v1/sim/analytics/scenarios?from=&to=&class_id=
GET /api/v1/sim/analytics/classes/:id?from=&to=
GET /api/v1/sim/analytics/export.csv?from=&to=&scenario_id=&class_id=
```

概览字段：

- `sessions`、`students`、`avg_score`、`avg_duration_ms`
- `grade_distribution`：`A/B/C/D`
- `outcome_distribution`：结局 id/title/count
- `daily_trend`：日期、会话数、平均分

明细分析：

- `GET /api/v1/sim/analytics/decisions?scenario_id=&class_id=`：按节点/选项统计次数。
- `GET /api/v1/sim/analytics/rules?scenario_id=&class_id=`：规则命中次数与命中率。

### 4.4 数据表

只建一张主表，完整快照放 JSON：

```text
sim_session
  id varchar(64) PK
  user_id bigint
  scenario_id varchar(64)
  scenario_title varchar(200)
  scenario_version varchar(32)
  domain varchar(32)
  score int
  grade varchar(8)
  grade_label varchar(32)
  outcome_id varchar(64)
  outcome_title varchar(200)
  duration_ms bigint
  started_at datetime(3)
  finished_at datetime(3)
  payload json
  received_at datetime(3)
  created_at datetime(3)
  updated_at datetime(3)
```

索引：`(user_id, finished_at)`、`(scenario_id, finished_at)`、`(finished_at)`、`(grade)`。

## 5. 仿真前端

- 除 `/login` 外全部路由要求登录。
- 实验目录以 `src/data/experimentThemes.ts` 为准，不请求 `/experiments`。
- 本地会话键：`moral-lab.sessions.v1:<userId>`，避免换账号看到别人的本地结果。
- 结果页只读本地；找不到会话回首页。
- 都江堰主题详情页增加全景卡片，跳转 `/panorama/?space=dujiangyan`。

## 6. 全景前端

- Vite `base: '/panorama/'`，Router `createWebHistory(import.meta.env.BASE_URL)`。
- 无 token 时跳 `/login?redirect=<全景当前路径>`，不保留独立登录页。
- 只读取/清理共享 `user` 键。
- 平台后台新增“实验数据”页；管理员看全局，教师看自己班级。

## 7. 目录归属

```text
simulation/frontend/simulation/       仿真 SPA（主入口）
simulation/frontend/simulation/backend/  Go 总服务器
panorama/                             全景 SPA + 平台后台
deploy/                               Docker / Nginx / Compose
assets/参考/                          全景源图，仅首次 seed 使用
```

## 8. 错误约定

- `400`：参数或会话结构不合法。
- `401`：未登录或令牌失效。
- `403`：越权访问他人/其他班级会话。
- `404`：会话不存在。
- `409`：会话 id 已被其他用户占用。
