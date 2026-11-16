# CloudBase 环境与权限创建指引

> 适用基线：`feat/mvp-implementation`。本文档只描述**由部署方在腾讯云控制台 / 微信公众平台完成的配置**，不含任何密钥。
> 架构硬约束：CloudBase 云函数是唯一服务端边界，客户端不直连数据库；密钥只存在云函数环境变量。

## 0. 前置条件

| 项 | 要求 | 说明 |
|---|---|---|
| 微信小程序 AppID | 已注册的小程序（非测试号） | 真机预览 / 体验版必需；`touristappid` 只能跑模拟器 |
| 小程序主体 | 个人主体即可 | 涉及相机、相册、麦克风，需完成隐私保护指引 |
| Node.js | 20 LTS（本机当前为 v22.22.2，已验证可构建） | 云函数运行时选 `Nodejs 20` |
| CloudBase 环境 | 新建，计费方式按需 | 记录 **环境 ID**，形如 `cooking-atlas-1gxxxxxxxx` |
| AI 兼容接口 | 支持 `/chat/completions` + `response_format: json_object` | `recipe-import` 图片录入还需支持 `image_url`（vision） |

## 1. 创建顺序

1. 微信公众平台 → 开发管理 → 开发设置：取得 **AppID**，把成员微信号加入「体验者」。
2. 腾讯云 CloudBase 控制台 → 新建环境 → 记录 **环境 ID**。
3. 环境 → 数据库 → 逐个创建下列 9 个集合。
4. 环境 → 数据库 → 集合权限：全部设为 **「仅管理端可读写」**（见 §3）。
5. 环境 → 数据库 → 索引：按下表建立（见 §2）。
6. 环境 → 云函数 → 逐个创建并部署 4 个函数（见 §4）。
7. 环境 → 云函数 → 对应函数 → 配置环境变量（见 §4）。
8. 环境 → 云存储：开启，权限同样设为管理端可读写（客户端仅通过 `cloud.uploadFile` 拿到 fileID）。
9. 微信公众平台 → 隐私保护指引：声明「相册/相机」「麦克风」「用户昵称头像」（见 §5）。

## 2. 集合与索引

集合名严格沿用 `DATA_MODEL.md`，字段不做改名。

| 集合 | 主要字段 | 建议索引 |
|---|---|---|
| `users` | openid, displayName, avatarUrl, createdAt, lastLoginAt | `openid`（唯一） |
| `family_spaces` | name, ownerOpenid, **inviteCodeHash**, status, createdAt | `ownerOpenid`；`inviteCodeHash`（唯一，M1 起用哈希查询） |
| `family_memberships` | spaceId, openid, displayName, role, status, joinedAt | `(spaceId, openid)` **唯一**；`(spaceId, status)` |
| `recipes` | spaceId, title, category, coverFileId, servings, ingredients[], steps[], createdBy, version, status, createdAt, updatedAt | `(spaceId, status, createdAt)` |
| `recipe_favorites` | spaceId, openid, recipeId, createdAt | `(spaceId, openid, recipeId)` **唯一** |
| `meal_requests` | spaceId, openid, mealDate, mealType, servings, recipeIds[], note, status, createdAt | `(spaceId, status, createdAt)` |
| `meal_plans` | spaceId, title, mealType, servings, status, items[], createdBy, confirmedBy, createdAt, confirmedAt | `(spaceId, status, confirmedAt)` |
| `shopping_lists` | spaceId, mealPlanId, title, status, items[], createdAt, updatedAt | `(spaceId, mealPlanId)`（供 M4 幂等查询） |
| `cooking_logs` | spaceId, recipeId, mealPlanId, cookedAt, photos, notes, rating, createdBy | `(spaceId, createdAt)` |

> **`inviteCodeHash` 说明**：`DATA_MODEL.md` 要求存哈希，当前基线 `family-api.createSpace` 写的是明文 `inviteCode`——这是已知缺口，M1 会改成 `sha256(邀请码 + 环境盐)` 并同步 `joinSpace` 查询。建集合时请直接按哈希字段命名，不要建 `inviteCode` 索引。

## 3. 安全规则（最关键）

**所有 9 个集合的数据库权限统一设为「仅管理端可读写」**，不要使用「所有用户可读」「仅创建者可读写」等客户端权限。

理由与对应约束：

- `ARCHITECTURE.md` / `DATA_MODEL.md`：客户端提交的 `openid` / `role` / `owner` 身份**不可信**，必须由云函数从 `cloud.getWXContext()` 取 `OPENID`。
- `WORKBUDDY_HANDOFF.md` 交接原则：**不开放数据库客户端任意写权限**。
- 云函数使用 `wx-server-sdk` 以管理端身份读写，天然绕过客户端权限规则；所有 action 在写入前校验 `family_memberships` 的 `status:'active'`，菜谱写 / 菜单确认 / 采购写再额外校验 `role:'owner'`。

因此**不要**依赖数据库安全规则做租户隔离，隔离逻辑在云函数；数据库规则只负责「堵死客户端直连」这一层。

## 4. 云函数部署

目录与依赖：

| 函数 | 目录 | 依赖 | 环境变量 |
|---|---|---|---|
| `family-api` | `cloudfunctions/family-api` | `wx-server-sdk@^3` | 无（可选 `INVITE_SALT`） |
| `recipe-import` | `cloudfunctions/recipe-import` | `wx-server-sdk@^3` | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` |
| `meal-recommend` | `cloudfunctions/meal-recommend` | `wx-server-sdk@^3` | 无 |
| `shopping-generate` | `cloudfunctions/shopping-generate` | `wx-server-sdk@^3` | 无 |

部署命令（在仓库根目录，Node 20）：

```bash
for f in family-api recipe-import meal-recommend shopping-generate; do
  (cd "cloudfunctions/$f" && npm install --production)
done
```

然后在控制台逐个「创建并部署：云端安装依赖」，运行时选 `Nodejs 20`，入口 `index.js`。

环境变量填写规范：

- `AI_BASE_URL`：OpenAI 兼容服务的**根地址**，云函数会自动追加 `/chat/completions`。例如 `https://ark.cn-beijing.volces.com/api/coding/v1`（末尾斜杠会被去掉）。
- `AI_API_KEY`：只填在云函数环境变量，**禁止**写入 `.env`、前端代码或 Git。
- `AI_MODEL`：实际模型名，例如 `doubao-seed-2-1-pro`。
- 云函数需具备**公网出站能力**，否则 `recipe-import` 调 AI 会超时；网络策略按最小必要放通 AI 服务域名。

## 5. 小程序侧配置

| 位置 | 操作 |
|---|---|
| `apps/miniprogram/project.config.json` | `appid` 由 `touristappid` 改为真实 AppID |
| 仓库根 `.env`（从 `.env.example` 复制，**已被 .gitignore 忽略**） | `TARO_APP_DEMO_MODE=false`、`TARO_APP_CLOUDBASE_ENV_ID=<环境 ID>` |
| 微信公众平台 → 开发管理 → 服务器域名 | 云开发调用（`wx.cloud.callFunction` / `uploadFile`）**不需要** request 合法域名；若后续直连外部 AI 域名才需要配置，本架构不走这条路 |
| 微信公众平台 → 隐私保护指引 | 声明「相册」「摄像头」「麦克风」「用户信息」，对应 `chooseImage`、录音录入、成员昵称；未声明会导致真机上授权弹窗被拒 |
| 微信公众平台 → 成员管理 → 体验成员 | 至少加入 **2 个家庭成员微信号**，用于 owner / member 双角色验收 |

## 6. 部署后自检

```bash
npm install
npm test                    # 期望：3 套件 / 4 用例全绿
npm run build:weapp         # 期望：Compiled successfully，产出 apps/miniprogram/dist
```

控制台侧逐项确认：

- [ ] 9 个集合已创建，权限均为「仅管理端可读写」
- [ ] 唯一索引已建（`family_memberships`、`recipe_favorites`）
- [ ] 4 个云函数部署成功，`recipe-import` 的 3 个 AI 变量已配置
- [ ] 云存储已开启且权限为管理端可读写
- [ ] AppID 已替换，`.env` 已设 `DEMO_MODE=false` 与环境 ID
- [ ] 隐私指引已提交并生效，两个体验者已加入
- [ ] 未把任何 `AI_*` 密钥提交进 Git

## 7. 与后续模块的对应

| 模块 | 依赖本节哪一项 |
|---|---|
| M1 登录/家庭空间 | §2 `users`/`family_spaces`/`family_memberships`、§3、§5 的 `.env` 与 AppID |
| M2 菜谱/收藏/AI 录入 | §2 `recipes`/`recipe_favorites`、§4 AI 变量与云函数公网出站 |
| M3 点菜/菜单确认 | §2 `meal_requests`/`meal_plans` |
| M4 采购清单同步 | §2 `shopping_lists` 的 `(spaceId, mealPlanId)` 索引 |
| M5 语音/卡牌/烹饪记录 | §2 `cooking_logs`、§5 麦克风与相册授权 |
| M6 真机闭环 | §5 两个体验者、§6 全部自检项 |

> 真机验证必须等本节配置完成 + 两个微信号就绪；在此之前 M6 保持 BLOCKED，不会用演示数据冒充验收通过。
