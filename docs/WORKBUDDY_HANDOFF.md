# WorkBuddy 部署交接

目标：把仓库适配到真实微信小程序与 CloudBase。先检查现有工程，不要重写业务引擎。

## 当前真实实现边界
- Taro React 页面、卡牌图鉴、手动菜谱录入、规则配餐、确认菜单、采购清单具备本地演示模式。
- 菜谱/配餐/采购纯 TypeScript 引擎独立并含基础单测。
- CloudBase recipe-import、meal-recommend、shopping-generate 云函数入口已提供。
- 真实微信登录、家庭空间邀请、完整 CRUD、收藏/点菜持久化、图片/语音上传、卡牌图片导出和真机联调仍需部署适配。不得将本地 demo 当线上能力。

## 部署
1. Node.js 20 LTS，npm install。
2. 复制 .env.example；设置 TARO_APP_DEMO_MODE=false、TARO_APP_CLOUDBASE_ENV_ID。
3. 配置微信 AppID，在微信开发者工具导入 apps/miniprogram。
4. 创建 CloudBase 环境、数据库集合与安全规则（见 DATA_MODEL.md）。
5. 分别在 cloudfunctions/* 安装依赖并部署。
6. 云函数配置 AI_BASE_URL、AI_API_KEY、AI_MODEL；密钥不得放入小程序。
7. 实现真实身份认证、家庭创建/邀请、菜谱 CRUD、收藏、点菜提交与汇总、菜单确认、采购状态更新。
8. 将 src/services/repository.ts 本地存储适配替换为 CloudBase adapter，保留接口和纯业务引擎。
9. 实现微信相机、录音、媒体上传、语音转写、卡牌 Canvas 导出、分享。
10. 配置合法域名、隐私保护指引与平台授权。
11. 执行 npm test、npm run build:weapp，使用微信开发者工具和真机验证端到端验收。

## 环境配置
微信 AppID、CloudBase 环境 ID、AI 兼容接口地址/密钥/模型、小程序合法域名、隐私声明、云函数网络策略。

## 交接原则
禁止把密钥提交仓库；禁止开放数据库客户端任意写权限；菜谱管理仅 owner；采购仅基于已确认菜单；菜单项保留菜谱快照；所有平台适配独立提交并附真机验证证据。
