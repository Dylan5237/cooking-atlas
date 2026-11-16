# 我的料理图鉴 · Cooking Atlas

AI 驱动的家庭料理图鉴：菜谱收藏、家庭点菜、智能配餐与采购清单。

## 技术栈
- 微信小程序：Taro + React + TypeScript
- API：Node.js 24 LTS + Fastify
- 数据库：PostgreSQL + Prisma
- 对象存储：S3 兼容接口（本地 MinIO；生产可用 COS / R2 / S3）
- AI：服务端多模态模型 API
- 业务引擎：独立 TypeScript packages

## 本地启动
1. `docker compose up -d` 启动 PostgreSQL 和 MinIO。
2. 打开 MinIO Console（http://localhost:9001），创建 bucket：`cooking-atlas`。
3. 复制 `apps/api/.env.example` 为 `apps/api/.env`，填写微信和 AI 配置。
4. 根目录执行 `npm install`。
5. 执行 `npm run db:generate`。
6. 执行 `npm --workspace @cooking-atlas/api run db:dev -- --name init`。
7. 执行 `npm run dev:api`，API 默认监听 http://localhost:3001。
8. 小程序端设置 `TARO_APP_API_BASE_URL` 后执行 `npm run dev:weapp`。

## 目录
- `apps/miniprogram`：微信小程序客户端
- `apps/api`：Fastify API、Prisma Schema、对象存储适配
- `packages/shared`：领域类型
- `packages/recipe-engine`：菜谱归一化
- `packages/meal-engine`：家庭配餐规则
- `packages/shopping-engine`：采购清单计算
- `docs`：产品规格、架构、数据模型、WorkBuddy 交接

## 安全边界
- 家庭空间是数据隔离边界；所有服务端业务操作校验成员身份。
- 菜谱增删改、菜单确认和采购管理仅 owner 可执行。
- 微信 AppSecret、JWT Secret、S3 凭证和 AI API Key 只存在 API 服务端。
- 对象存储 bucket 默认私有；图片访问通过短期签名 URL。
- 采购清单只根据已确认菜单和菜谱快照生成；未知用量不伪造精确数值。

当前仍是待部署联调的 MVP 工程基线，真实微信登录、数据库迁移、存储桶、域名与真机验收由 WorkBuddy 完成，详见 `docs/WORKBUDDY_HANDOFF.md`。
