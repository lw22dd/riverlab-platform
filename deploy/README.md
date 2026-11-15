# 部署编排

在 `deploy` 目录执行：

```bash
cp .env.example .env   # 可选，按需修改密码/密钥
DOCKER_BUILDKIT=0 docker compose up -d --build
```

> 项目路径包含中文时，Windows BuildKit 可能报 `x-docker-expose-session-sharedkey` 错误；加 `DOCKER_BUILDKIT=0` 使用经典构建器即可。

首次启动时 MySQL 会自动建库，API 会执行表结构迁移并写入种子数据（全景源图从宿主机 `assets/参考` 只读挂载）；就绪后访问 <http://localhost>。

> 首次 seed 需要把约 0.8G 全景源图上传到 MinIO，视磁盘速度可能需要数分钟；API 健康检查通过前 `web` 不会启动，这是正常现象。

## 访问入口

| 地址 | 说明 |
| --- | --- |
| <http://localhost/> | 仿真实验 SPA（web 容器） |
| <http://localhost/panorama/> | 全景 SPA（panorama 容器） |
| <http://localhost/admin> | 302 跳转到 `/panorama/admin` |
| <http://localhost/api/v1/...> | 反向代理到 `api:7000`，保留 `/api/v1` 前缀 |
| MinIO 控制台 | 默认不暴露；需要时取消 compose 中 9001 端口注释 |
| `http://api:7000/health` | API 健康检查（仅容器网络，不映射到宿主机） |

## 端口

| 服务 | 宿主机端口 | 说明 |
| --- | --- | --- |
| web | 80 | 唯一应用入口 |
| minio | 不映射 | 9000 仅在容器网络内供 api 使用；控制台按需开放 9001 |
| api | 不映射 | 容器网络内监听 7000 |
| mysql | 不映射 | 容器网络内监听 3306 |
| redis | 不映射 | 容器网络内监听 6379 |

## 默认账号

- 应用管理员：`admin` / `admin123`（首次启动由 seed 写入）
- MinIO：`admin` / `admin123456`（可通过 `.env` 修改）

## 目录结构

```text
deploy/
├── Dockerfile.api          # Go 后端多阶段构建
├── Dockerfile.web          # 仿真前端 + Nginx
├── Dockerfile.panorama     # 全景前端 + Nginx
├── docker-compose.yml      # 六个服务、网络与数据卷
├── .env.example            # 环境变量示例
├── nginx/
│   ├── gateway.conf        # 统一入口：静态 SPA、/panorama/、/api/、WebSocket
│   └── panorama.conf       # 全景 SPA，挂载在 /panorama/
└── README.md
```

## 常用命令

```bash
docker compose ps
docker compose logs -f api
docker compose down
docker compose down -v   # 同时删除 MySQL / Redis / MinIO 数据卷
```

## 注意事项

- 全景前端构建产物的 Vite `base` 必须为 `/panorama/`，否则其资源会以 `/assets/...` 请求而 404。
- 全景前端的资源/WebSocket 地址默认留空，走同源 `/api/v1`；只有在需要直连独立后端源站时才设置 `VITE_API_BASE_URL`。
- API 容器通过 `CONFIG_FILE` / `APP_INIT_DATA` / `APP_SEED_BASE_PATH` 指定生产配置、初始化开关与素材目录；数据库密码、MinIO 账号和 JWT 密钥可通过 `.env` 覆盖。
- 全景源图约 0.8G，不进入镜像；`assets/参考` 只读挂载到 API 容器的 `/app/assets`，首次 seed 使用，已有数据后会自动跳过。
- 全景地图的高德 Key 通过 `deploy/.env` 的 `VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_KEY` 在构建时注入；`.env` 不进入版本库，首次部署请从 `.env.example` 复制并填写。
- 镜像构建统一以仓库根目录为 build context，`.dockerignore` 已排除 `node_modules`、`dist` 和本地大体积素材。
