# 我的料理图鉴 · Cooking Atlas

AI 驱动的家庭料理图鉴：菜谱收藏、家庭点菜、智能配餐与采购清单。

> 当前阶段：MVP 工程实现中。部署前请阅读 [WorkBuddy 部署交接](docs/WORKBUDDY_HANDOFF.md)。

## 技术栈

- Taro + React + TypeScript（微信小程序）
- npm workspaces monorepo
- 独立纯 TypeScript 业务引擎：菜谱、配餐、采购
- CloudBase 云函数/数据库/云存储适配层
- AI Provider 抽象，模型密钥只允许配置在服务端

## 本地开发

```bash
npm install
npm run dev:weapp
```

首次运行前复制 `.env.example` 为 `.env`。未配置 CloudBase 时，应用使用本地演示数据，方便先检查 UI；本地演示数据不代表线上持久化。

## 项目结构

- `apps/miniprogram`：微信小程序
- `packages/shared`：领域类型、校验与共享常量
- `packages/recipe-engine`：菜谱归一化
- `packages/meal-engine`：规则约束的家庭配餐
- `packages/shopping-engine`：采购清单计算
- `cloudfunctions`：CloudBase 云函数入口
- `docs`：产品规格、架构、数据模型、部署交接

## 重要边界

- 家庭空间是菜谱、菜单和采购数据的归属边界。
- MVP 仅空间 owner 可以创建、修改、删除菜谱；其他成员可浏览、收藏、点菜。
- AI 推荐优先已有菜谱；新菜必须显式标记为外部建议，不得伪装成图鉴已有菜。
- 采购清单以已确认菜单及其菜谱快照为依据。未知用量不伪造精确数值。
- 当前仓库提供可部署工程和 CloudBase 适配骨架；真实微信登录、CloudBase 环境、AI 服务商密钥和小程序主体资质需由部署方配置并联调。
