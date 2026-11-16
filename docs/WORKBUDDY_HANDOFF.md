# WorkBuddy 部署与适配交接

目标：基于现有代码完成自建 Node.js + PostgreSQL + S3 对象存储后端部署，以及微信小程序真实联调。**不再使用 CloudBase，不要重新引入 CloudBase SDK 或云函数。** 不要重写 recipe-engine、meal-engine、shopping-engine，除非先证明存在缺陷并补充测试。

## 已提交工程
- Taro + React + TypeScript 微信小程序。
- Fastify API 工程：apps/api。
- Prisma PostgreSQL Schema：apps/api/prisma/schema.prisma。
- 微信 code2Session 登录与 JWT 认证入口。
- 家庭空间创建/邀请码加入、成员校验、菜谱 CRUD、收藏、点菜请求、配餐推荐、菜单确认、采购清单生成/状态更新 API。
- S3 兼容对象存储适配：本地 MinIO，生产可替换 COS / R2 / S3。
- AI 菜谱草稿 API：服务端多模态模型调用，支持文字与图片对象 key。
- 小程序 REST API client 与上传入口。
- 独立 recipe-engine / meal-engine / shopping-engine。
- Docker Compose、PRD、架构、数据模型、验收文档。

## 先做的工程核验
1. 检查 npm workspaces 安装、Prisma generate、API TypeScript build、业务引擎测试和 Taro build。
2. 检查 Prisma Schema 是否能生成迁移；修正类型错误并提交测试证据。
3. 检查 API 路由的鉴权、成员权限、owner 权限和跨空间访问保护。
4. 检查小程序服务层与 API 契约；不要将本地 demo repository 误认为生产持久化实现。

## 本地启动
1. 安装 Node.js 24 LTS。
2. 根目录执行 docker compose up -d，启动 PostgreSQL 16 与 MinIO。
3. 登录 MinIO Console（http://localhost:9001），创建私有 bucket：cooking-atlas。
4. 复制 apps/api/.env.example 为 apps/api/.env，填写 DATABASE_URL、JWT_SECRET、S3 配置、微信 AppID/AppSecret、AI 配置。
5. 根目录 npm install。
6. npm run db:generate。
7. npm --workspace @cooking-atlas/api run db:dev -- --name init。
8. npm run dev:api，确认 http://localhost:3001/health。
9. 配置 TARO_APP_API_BASE_URL 后 npm run dev:weapp。

## 生产部署
1. 准备 Node.js 24 LTS 运行环境或容器平台；API 通过 HTTPS 暴露。
2. 准备 PostgreSQL（优先托管数据库或带自动备份的独立实例），启用 TLS、限制网络访问、定期备份并验证恢复。
3. 准备 S3 兼容对象存储 bucket，默认私有；配置最小权限的读写凭证、生命周期和备份策略。
4. 配置 API 环境变量：DATABASE_URL、JWT_SECRET、WECHAT_APP_ID、WECHAT_APP_SECRET、S3_ENDPOINT、S3_REGION、S3_BUCKET、S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY、S3_FORCE_PATH_STYLE、AI_BASE_URL、AI_API_KEY、AI_MODEL。
5. 生产部署执行 prisma migrate deploy；不要在生产环境执行 migrate dev。
6. 配置微信小程序 request 合法域名和 uploadFile 合法域名，指向 HTTPS API 域名。
7. 配置 TARO_APP_API_BASE_URL 指向生产 API；TARO_APP_DEMO_MODE=false；将 project.config.json 中 touristappid 替换为真实 AppID。
8. 配置日志、错误告警、API 限流、对象存储成本告警和数据库备份。
9. 不得把 AppSecret、JWT Secret、S3 密钥、AI Key 写入小程序包或 GitHub。

## 必须补齐的联调事项
当前代码是工程基线，以下仍需完成，不得误报为已生产就绪：
1. 小程序首次登录后自动创建/选择家庭空间，并持久化 activeSpaceId；邀请链接/邀请码加入流程。
2. 将 apps/miniprogram/src/services/repository.ts 的 local Storage demo adapter 替换为 REST repository；所有菜谱、收藏、点菜、菜单、采购数据必须来自 API。
3. 完成家人点菜提交、owner 查看汇总、菜单编辑/确认；当前 API 有请求和确认基础路由，客户端完整流程尚未接通。
4. AI 草稿确认后调用 POST /api/recipes 保存菜谱；目前解析接口只返回草稿。
5. 图片上传后保存 object key；菜谱/详情列表读取时调用签名 URL 接口或实现可刷新图片 URL。注意临时本地路径不能当作持久化图片地址。
6. 语音录入和转写尚未实现；评估微信录音 API 与服务端 STT Provider。
7. 高清 Canvas 卡牌合成、相册保存和微信分享尚未实现。
8. 采购清单前端编辑数量、标记家中已有/已购买，并在菜单变更时做差异同步。
9. 完成 cooking_logs API 与前端制作记录流程。
10. 检查新增/编辑菜谱、跨空间 IDOR、邀请码滥用、文件类型/大小、签名 URL 时效、AI prompt injection、API rate limit。
11. 使用两个真实微信账号真机测试成员/owner 权限和完整家庭晚餐流程。

## 当前 API 主要路径
- POST /api/auth/wechat
- GET /api/me
- POST /api/spaces、POST /api/spaces/join、GET /api/spaces
- GET/POST/PUT/DELETE /api/recipes
- POST /api/recipes/:id/favorite、GET /api/favorites
- POST/GET /api/meal-requests
- POST /api/meal-recommendations
- POST/GET /api/meal-plans
- POST /api/meal-plans/:id/shopping-list
- GET /api/shopping-lists、PATCH /api/shopping-lists/:id/items/:itemId
- POST /api/uploads
- POST /api/ai/recipe-draft
- GET /health

## 验收
- npm test
- npm run db:generate
- npm run build:api
- npm run build:weapp
- PostgreSQL migration deploy 成功
- API health check 成功
- 两个家庭成员微信账号登录并加入同一家庭空间
- owner 菜谱录入、成员收藏/点菜、owner 确认菜单、采购清单合并/调整、完成烹饪记录的端到端真机测试
- 备份与恢复演练成功

每完成一个适配模块单独提交 commit，并附构建、API 测试和真机验收证据。
