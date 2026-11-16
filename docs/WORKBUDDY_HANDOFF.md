# WorkBuddy 部署与适配交接

目标：在现有工程基础上完成真实微信小程序与 CloudBase 联调。请先检查代码，不要重写已独立实现的业务引擎或替换产品规则。

## 已提交实现
- Taro + React + TypeScript 小程序工程。
- 家庭料理图鉴页面：分类、搜索、菜谱详情、手动录入。
- AI 录入 UI：文字描述、拍照/相册上传、调用 recipe-import 云函数生成结构化草稿。
- 真实照片 fileID 保存到菜谱，并用于卡牌封面展示；卡牌版式目前为基础模板，尚未实现高清 Canvas 导出。
- 点菜页面：人数、午晚餐、已选菜、规则引擎推荐、菜单确认。
- 采购页面：从已确认菜单生成清单、合并同名同单位食材、数量缩放、勾选交互。
- 独立 recipe-engine / meal-engine / shopping-engine 及基础 Vitest 单测。
- CloudBase 云函数：family-api、recipe-import、meal-recommend、shopping-generate。
- PRD、架构、数据模型、AI 约束、验收清单。

## 重要：当前仍属于可交接工程基线，不得误报为已完成生产联调
以下事项必须由 WorkBuddy 在部署环境完成：
1. 真实微信登录与用户初始化、家庭空间创建/邀请码加入、成员角色管理。
2. 将前端 services/repository.ts 的本地 Storage 实现替换为 CloudBase 数据 API adapter；当前业务 UI 默认本地演示数据，尚未连接 family-api 的全部 action。
3. 家庭点菜提交、全员请求汇总、owner 菜单确认等完整多用户实时数据流。
4. 收藏、菜谱 CRUD、采购状态修改的云端持久化与权限校验。
5. AI 录入草稿确认后保存到 CloudBase recipes；当前 AI 解析结果先回填编辑表单。
6. 语音录入与语音转写（当前已支持文字 + 图片；语音未接入）。
7. 高清卡牌 Canvas 合成、相册保存与微信分享。
8. 采购清单修改数量、标记“家中已有/已购买”的云端保存与菜单变更差异同步。
9. 真机兼容、授权/隐私流程、错误态、空状态、加载态及性能检查。

## 部署步骤
1. 使用 Node.js 20 LTS，执行 npm install。
2. 复制 .env.example；设置 TARO_APP_DEMO_MODE=false 与 TARO_APP_CLOUDBASE_ENV_ID。
3. 填入微信小程序 AppID；将 apps/miniprogram/project.config.json 中 touristappid 替换为真实 AppID。
4. 创建 CloudBase 环境、集合与索引，按 DATA_MODEL.md 配置安全规则。
5. 在 cloudfunctions/family-api、recipe-import、meal-recommend、shopping-generate 分别 npm install 并部署。
6. 在云函数环境配置 AI_BASE_URL、AI_API_KEY、AI_MODEL。密钥禁止写入前端或 Git。
7. 实现 CloudBase repository adapter，并按 family-api action 契约对接客户端。
8. 确保所有服务端操作从 cloud.getWXContext() 获取 OPENID；所有数据读写校验 active membership；菜谱写入、菜单确认、采购管理必须 owner。
9. 实现语音转写、相册/相机上传、Canvas 卡牌导出与分享。
10. 配置小程序合法域名、隐私保护指引、云函数网络策略及平台权限。
11. 执行 npm install、npm test、npm run build:weapp；使用微信开发者工具和至少两台不同家庭成员账号真机走通验收场景。

## 环境配置
- 微信小程序 AppID
- CloudBase 环境 ID
- AI 兼容接口地址、密钥、模型
- 小程序合法域名、隐私声明、云函数网络策略

## 交接原则
- 不重写已存在的业务引擎；发现缺陷先补测试再修复。
- 不把密钥提交仓库。
- 不开放数据库客户端任意写权限。
- 菜谱管理仅 owner；成员只读、收藏、点菜。
- 采购清单只从已确认菜单生成，保存菜谱快照与食材来源。
- 每次平台适配独立提交，并附构建、云函数部署和真机验收证据。
