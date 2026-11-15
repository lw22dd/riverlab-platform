# 伦理仿真与都江堰全景实验平台

一个同源交付的 Web 实验平台：

- **仿真主入口**：主题 → 场景变式 → 3D 决策实验 → 本地结果页。
- **都江堰全景模块**：在都江堰主题页以卡片进入 720° 实景漫游。
- **平台后台**：统一用户/班级权限、全景资源管理、实验数据汇总与 CSV 导出。
- **总服务器**：Go 模块化单体，负责用户/权限、全景资源、切片、仿真会话与汇总。

## 目录结构

```text
毕设/
├─ simulation/frontend/simulation/          # ① 主入口：仿真 SPA
│  ├─ src/                                  # 页面、引擎、Three.js 场景
│  ├─ backend/                              # ③ 总服务器：Go 模块化单体
│  │  ├─ cmd/                               # 启动与依赖装配
│  │  ├─ config/                            # dev / prod 配置
│  │  ├─ internal/
│  │  │  ├─ user/                           # 登录、用户、角色、班级
│  │  │  ├─ resource/                       # 空间、场景、热点、上传
│  │  │  ├─ slice/                          # 切片队列与 worker
│  │  │  ├─ simulation/                     # 仿真会话、汇总接口
│  │  │  └─ model/sim_session.go            # 会话主表
│  │  └─ pkg/                               # JWT、MySQL、Redis、MinIO、瓦片
│  ├─ vite.config.ts
│  └─ package.json
│
├─ panorama/                                # ② 全景 SPA + 平台后台
│  ├─ src/
│  │  ├─ views/index.vue                    # 全景首页/地图
│  │  ├─ views/admin/ExperimentAnalytics.vue # 实验数据看板
│  │  ├─ components/PanoramaViewer.vue      # 720° 播放器
│  │  └─ utils/apiBase.ts                   # 同源 /api/v1
│  ├─ vite.config.ts                        # base: '/panorama/'
│  └─ package.json
│
├─ deploy/                                  # 交付编排
│  ├─ docker-compose.yml                    # mysql + redis + minio + api + web + panorama
│  ├─ .env.example
│  ├─ nginx/gateway.conf                    # 统一入口
│  ├─ nginx/panorama.conf
│  ├─ Dockerfile.api
│  ├─ Dockerfile.web
│  └─ Dockerfile.panorama
│
├─ assets/参考/都江堰/                       # 全景源图（首次 seed 用，不进入镜像）
└─ docs/
   ├─ integration-plan.md                   # 路由、接口、登录态、数据契约
   ├─ smoke-sim-api.mjs                     # 后端/网关接口冒烟
   └─ smoke-ui.mjs                          # Chrome 无头登录与页面跳转冒烟
```

> `assets/`、`参考/`、`文档备份/`、`前端设计原型/` 等大体积素材与论文资料只保留在本地，
> 已通过根目录 `.gitignore` 排除，不进入 GitHub 仓库。

## 设计系统（RIVERLAB · 江堰）

两个前端共用一套亮色设计令牌，方向为「纸白底 + 岷江深青主色 + 堰体土黄点缀」：

- 令牌源：`panorama/src/styles/riverlab.css` 与
  `simulation/frontend/simulation/src/styles/riverlab.css`，两份保持完全一致。
- 仿真入口的 `global.css` / `portal.css`、全景的 `style.css` 只做令牌别名与局部类样式，
  品牌色统一引用 `--rl-primary`（#0F6E84）。
- TDesign 通过 `--td-brand-color-1..10` 色阶桥接；组件库 CSS 打包顺序可能晚于令牌文件，
  因此品牌色阶在 `riverlab.css` 末尾用 `!important` 固定。
- 例外：720° 全景画布与 Three.js 场景保持原色渲染，只给叠在上面的工具条 / HUD 使用亮色铬件。

新增页面时优先复用 `--rl-*` / `--td-*` 令牌，避免再写品牌色十六进制值。

## Docker 交付

项目路径包含中文时，Windows 上的 BuildKit 可能报 `x-docker-expose-session-sharedkey` 错误，使用经典构建器：

```bash
cd deploy
cp .env.example .env
DOCKER_BUILDKIT=0 docker compose up -d --build
```

访问：

| 地址 | 说明 |
| --- | --- |
| <http://localhost/> | 仿真主入口 |
| <http://localhost/login> | 统一登录 |
| <http://localhost/panorama/> | 全景模块 |
| <http://localhost/admin> | 302 到 `/panorama/admin` |
| MinIO 控制台 | 默认不暴露；需要时取消 compose 中 9001 端口注释 |

默认账号：`admin / admin123`（教师账号 `teacher1 / teacher123`）。

> 首次启动会从 `assets/参考` 读取全景源图并写入 MinIO。源图约 0.8G，不进入镜像，由 compose 只读挂载到 API 容器。

## 本地开发

后端（已有数据时建议关闭 seed，避免重复检查 0.8G 素材）：

```bash
cd simulation/frontend/simulation/backend
APP_INIT_DATA=false go run .
```

仿真前端（默认 5174，`/api` 和 `/panorama` 已配置代理）：

```bash
cd simulation/frontend/simulation
npm run dev
```

全景前端（默认 5173，`/api` 和 `/login` 已配置代理）：

```bash
cd panorama
npm run dev
```

本地开发直接访问 <http://localhost:5174/> 即可：仿真主入口在 5174，`/panorama/` 会代理到全景 Vite；个人中心里的“实验记录”走 `/panorama/user/experiments`。

演示学生（已写入当前数据库）：`20240001 / 123456`，属于计算机科学1班，已有 3 条都江堰实验记录；教师 `teacher1 / teacher123` 可以看到这些记录。

空间详情页的 L7 底图依赖高德 JS API。本地开发前先
`cp panorama/.env.example panorama/.env` 并填入自己的 Key；Docker 部署则在
`deploy/.env` 中设置 `VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_KEY`，构建时注入。
同时请在该 Key 的域名白名单中加入 `localhost` 和 `127.0.0.1`，否则控制台会报
`INVALID_USER_DOMAIN`；缺少安全密钥时会报 `INVALID_USER_SCODE`。

## 核心接口

```http
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/user/logout

POST /api/v1/sim/sessions              # 幂等上报会话
GET  /api/v1/sim/sessions              # 个人/班级/全局范围
GET  /api/v1/sim/sessions/:id
GET  /api/v1/sim/analytics/overview
GET  /api/v1/sim/analytics/scenarios
GET  /api/v1/sim/analytics/decisions
GET  /api/v1/sim/analytics/rules
GET  /api/v1/sim/analytics/classes/:id
GET  /api/v1/sim/analytics/export.csv
```

个人中心实验记录页：`/panorama/user/experiments`，数据来自 MySQL 的 `sim_session.payload`。

## 验证

```bash
# 后端
cd simulation/frontend/simulation/backend
go build ./...
# pkg/utils 的拼音用例是原有历史问题，验证业务代码可先跳过
go test ./internal/resource/... ./pkg/panorama/...

# 前端
cd simulation/frontend/simulation && npm run build
cd panorama && npm run build

# 接口冒烟（需要 API 已启动）
API_BASE=http://localhost node docs/smoke-sim-api.mjs

# 补一个演示学生和一条本班实验记录（当前数据库已有则跳过创建）
API_BASE=http://localhost node docs/seed-demo-student.mjs

# 浏览器登录/跳转冒烟（需要 web 网关已启动）
node docs/smoke-ui.mjs
```
