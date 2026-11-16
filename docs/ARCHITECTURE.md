# 系统架构

## 技术决策
- 小程序：Taro + React + TypeScript。
- API：Node.js 24 LTS + Fastify。
- 数据库：PostgreSQL + Prisma。
- 对象存储：S3 协议；本地 MinIO，生产可切换 Tencent COS / Cloudflare R2 / AWS S3。
- 认证：微信 code2Session 换取 OPENID，服务端签发 JWT。
- AI：服务端调用 OpenAI-compatible 多模态接口。
- 配餐和采购：确定性 TypeScript 业务引擎，不把算术交给 LLM。

## 分层
- apps/miniprogram：页面、微信 API、REST API client。
- apps/api：认证、空间权限、菜谱/点菜/菜单/采购 API、AI 编排、对象存储适配。
- apps/api/prisma：关系模型和数据库迁移。
- packages/shared：跨端领域类型。
- packages/recipe-engine：菜谱归一化。
- packages/meal-engine：人数、口味、点菜和近期重复的规则推荐。
- packages/shopping-engine：按菜谱份量缩放、同名同单位合并和来源追踪。

## 数据隔离与权限
FamilySpace 是租户边界。所有服务端业务操作必须从 JWT 获取 userId，再校验 active FamilyMembership。不得信任客户端传入的 userId、openid 或 role。
- owner：菜谱增删改、正式菜单确认、采购清单生成和管理。
- member：浏览、收藏、提交点菜、查看家庭菜单与采购清单。
- 过敏原和明确忌口属于硬约束。

## 微信登录
小程序调用 wx.login 获取临时 code，服务端使用 WECHAT_APP_ID / WECHAT_APP_SECRET 调用 jscode2session，保存 OPENID 并签发 JWT。AppSecret 永不进入小程序。

## 对象存储
bucket 默认私有。文件 key 以 spaces/{spaceId}/ 开头。API 校验成员权限后上传，使用短期签名 URL 供 AI 读取或客户端预览。S3 凭证只保存在 API 环境变量。

## 可迁移性
业务不依赖 CloudBase。数据库、对象存储和 AI provider 均通过服务端接口封装。未来 Web 客户端复用同一 REST API 与业务引擎。
