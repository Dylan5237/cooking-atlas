# A7 生产部署与真机验收 Runbook

> 状态：**H5 已部署上线（2026-11-20）** —— 无备案域名，公网 HTTPS 阻塞；家人走 HTTP 试用入口（用户已知情选择），
> 掌勺者可走 tailscale HTTPS 入口。部署分支 `feat/h5-deploy`（基线 367afa7），证据见 `shots/h5-cvm/`。
> 纪律：不使用演示数据冒充验收通过；每一步的产出都要留可复核证据。

## 0. 当前入口与状态（2026-11-20 实测）

| 项 | 值 |
| --- | --- |
| 家人入口（手机直接打开） | `http://43.139.159.100.nip.io`（明文 HTTP，仅限家庭试用；用户已知悉） |
| 掌勺者 HTTPS 入口 | `https://review-svc.tail16fd19.ts.net:8443`（tailnet 内可达；需设备装 Tailscale 并加入 tailnet） |
| 试用码 | 已轮换（旧码 `atlas-a4755a` 因仓库公开泄露已 403；新码只线下告知，不入库/不入 issue） |
| 公网 HTTPS 阻塞项 | 无备案域名；公网 443 被 brainstormtool（IP 证书）占用。需先备案域名 + DNS + certbot，见 §2 |
| AI / STT | `deploy/.env` 中 AI_* / STT_* 均为空占位 → 界面 503 降级手动录入并明确提示（实测 AI_PROVIDER_NOT_CONFIGURED） |

**部署布局**：静态 `/var/www/cooking-atlas-h5`（由 `deploy/deploy-h5.sh` 构建上传）；nginx：
`/etc/nginx/cooking-atlas/h5-locations.conf`（共用 location 片段：SPA try_files + /api 反代 + 试用码限流），
trial vhost（80，nip.io）与 `cooking-atlas-h5` vhost（127.0.0.1:8090，供 tailscale serve 8443 反代）都 include 它；
限流 zone 在 `/etc/nginx/conf.d/cooking-atlas-h5.conf`（10r/m burst 10，实测 10×403 → 429 → 503）。
`tailscale serve --bg --https=8443 http://127.0.0.1:8090`；原 443 → 8765 服务未动，配置备份在 `/home/ubuntu/ts-serve-backup-*.json`。

**备份（每日 cron，iris-deploy）**：03:20 `backup-restore-drill.sh`（pg_dump + scratch 还原比对，实测 RESULT: PASS，
9 表行数一致）；03:40 `backup-photos.sh`（mc mirror MinIO bucket → `~/backups/photos`，实测 32 对象镜像成功）。
缺项：异地副本（机器级故障会同失）——建议后续 rsync 到另一节点或 mc mirror 到独立对象存储，需用户提供目标。

**已知未做项**：H5 浏览器录音/STT（无 STT 密钥，语音入口 503 提示手动）；制作记录暂无照片入口（后端 photos 字段就绪，
UI `saveLog` 固定空数组）；家人点菜后掌勺者端已改为切 tab 自动拉最新（原只在会话建立时拉一次，见 feat(h5) 提交）。

## 0.9 历史记录（2026-11-16 小程序试用，已被 H5 入口取代）


**适用**：微信开发者工具 / 预览 / 真机调试（必须开调试模式）。**不适用**：体验版与正式版（微信强制备案域名 + HTTPS）。

| 项 | 值 |
| --- | --- |
| API 地址 | `http://43.139.159.100.nip.io`（80 端口 vhost，借 nip.io 通配 DNS 指到 CVM，未动现有 80/443 站点） |
| 试用码 | `atlas-a4755a`（CVM `deploy/.env` 的 `TRIAL_LOGIN_CODE`，留空即关闭入口） |
| 小程序源码 | `apps/miniprogram`，`project.config.json` 的 `appid=wxc79bbed1d3614ec2`（小程序测试号）、`urlCheck=false`（跳过合法域名校验） |
| 编译产物 | `apps/miniprogram/dist/`，`dist/common.js` 已注入上述 API 地址 |
| 登录方式 | 页面底部「输入试用码」→ 设备号自动生成；两台手机用同一码会得到两个账号，可验证 owner/member |

**操作步骤**：微信开发者工具 → 导入项目 → 目录选 `apps/miniprogram`（已配小程序测试号 `wxc79bbed1d3614ec2`）→ 详情 → 本地设置 → 勾选「不校验合法域名…」→ 编译。点工具栏「预览」生成二维码 → 手机微信扫码 → 右上角「…」→ 打开调试 → 即可连试用后端。AI 与 STT 未配置会 503 降级为手动录入，不影响其余流程。

**AppID 类型坑（2026-11-16 实测）**：`touristappid` 游客号能编译但 `appLaunch timeout`、无法生成预览码；**公众号 AppID（如订阅号）报 `invalid app type` 完全不可用**——公众号 ≠ 小程序，类型不通用。可用的是微信公众平台 `mp.weixin.qq.com` → 扫码 → 选择「小程序测试号」登录后，在「开发管理 → 开发设置」里的 AppID。CLI `preview` 验证成功的标志：输出 `Using AppID: wx...` + `Preview` 且无 error。

**安全边界**：`TRIAL_LOGIN_CODE` 是显式开关，未配置时 `/api/auth/trial` 返回 503；按 deviceId 限流 10/min；token 7 天；CVM 上 api/postgres/minio 仍只绑 127.0.0.1，公网仅经 nginx vhost 的 `/api/*` 与 `/health` 透传。现有站点回归验证 `http(s)://43.139.159.100/` 均 200 / 471B，与改前一致。

**公网冒烟证据**：`/health` → `{"ok":true}`；正确码 → 200 + JWT；错误码 → 403；现有站点 → 200/471B。

---

## 0.05 白屏排查与错误诊断层（2026-11-16 新增）

真机/模拟器首屏白屏时，Console 的红字不会落盘到微信开发者工具日志，只能靠「诊断层自动上报 + 读服务端日志」定位，无需截图/抢鼠标。

**已部署的诊断链路**：
- 小程序 `src/services/diagnostics.ts`：在 App 模块加载最早期注册 `Taro.onError` + `onUnhandledRejection` + `console.error` 劫持；错误写入本地 storage（去重限流，每类最多 8 条）+ 上报 `POST /api/dev/client-error`。首屏致命错误由 `app.ts` 的 `AppErrorBoundary` 捕获并渲染成可见错误页（含「重试」）。
- API `POST /api/dev/client-error`：无需鉴权（崩溃时未登录），`DIAGNOSTICS_ENABLED=true` 才生效，限流 20/min、字段长度上限，只写日志不入库。CVM `deploy/.env` 已开启。
- App 入口已改为 Taro 官方建议的 **class 组件**（原函数式 App + `useEffect` 在小程序端非官方写法，是 `LifeCycle.load fail` 的可疑诱因）；`project.config.json` 已关闭 `compileHotReLoad`（热重载中间态是 `setChanges` 报错的常见诱因）。

**抓错步骤（在你自己电脑上）**：
1. 微信开发者工具打开 `apps/miniprogram` → 编译（若仍白屏，错误页会显示简要错误）。
2. 让模拟器加载 3~5 秒，诊断层会把完整错误栈上报到服务端。
3. 让我读日志（我执行）：`ssh iris-deploy@43.139.159.100 'docker logs cooking-atlas-api 2>&1 | grep CLIENT_DIAGNOSTIC | tail -20'`。
4. 日志里的 `clientDiagnostic.message` / `stack` 即首屏真实报错，据此定位修复。

日志样例（冒烟测试已验证链路通）：
```json
{"level":50,"clientDiagnostic":{"kind":"smoke","message":"...","ip":"..."},"msg":"CLIENT_DIAGNOSTIC"}
```
排查完把 `deploy/.env` 的 `DIAGNOSTICS_ENABLED` 改回 `false` 并重建 api 即可关闭。

**白屏可疑诱因（按优先级，供对照）**：
1. 热重载中间态：`setChanges` 报错的经典来源。已在 `project.config.json` 与 `project.private.config.json` 双处关闭 `compileHotReLoad`。
2. 函数式 App + `useEffect`：小程序端非官方写法，易触发 `LifeCycle.load fail`。已改为 Taro 官方 class App 入口。
3. **基础库版本**：`project.private.config.json` 当前 `libVersion=3.18.0`（新版 3.x）。Taro 4.1.5 + 基础库 3.x 的 WebView 渲染层存在 `setChanges` 兼容风险；若上面两项仍白屏，在开发者工具「详情 → 本地设置 → 调试基础库」切到 **2.32.x 稳定版**重启后再编译验证。项目未启用 Skyline（`skylineRenderEnable=false`、app.config 无 renderer），不要误开。
4. AppID 类型：必须用小程序 AppID，不能用公众号 AppID（见 §0 的坑）。

## 0.1 已完成 / 已验证（无需重复）

| 项 | 证据 |
| --- | --- |
| CVM 数据层与 API 容器运行中 | `43.139.159.100:~/cooking-atlas`，postgres/minio/api 三容器 Up，仅绑 127.0.0.1 |
| 迁移已应用 | `migrate deploy` 无待应用迁移 |
| API 健康检查 | `GET http://127.0.0.1:3001/health` → `{"ok":true}` |
| 对象存储 | 私有 bucket `cooking-atlas` 已建 |
| 契约测试 | `apps/api/test/contract.test.ts` 84/84（含 IDOR/权限/限流/魔数/试用码） |
| 前端单测 | 47/47（含试用登录降级链） |
| 构建 | `build:api` ✔、`build:weapp` Compiled successfully |
| 备份恢复演练 | `deploy/backup-restore-drill.sh` 9 张表行数一致，RESULT: PASS |

## 1. 阻塞项（必须由账号持有人提供）

- [ ] **ICP 备案域名**（微信要求 request 合法域名是备案域名，不接受 IP）
- [ ] **该域名的 TLS 证书**（TLS≥1.2，iOS 不接受自签名）
- [ ] **小程序 AppID / AppSecret**（当前 `project.config.json` 是 `touristappid`，只能本地预览）
- [ ] **AI Provider**：`AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`
- [ ] **STT Provider**（可选，未配置时语音入口 503 降级为手动输入）：`STT_BASE_URL` / `STT_API_KEY` / `STT_MODEL`
- [ ] **两个真实微信账号**（一个 owner、一个 member）作为体验者

## 2. 启用 HTTPS 反代（不触碰现有 80/443 站点）

现有 nginx 站点 `brainstormtool` 监听 `10.1.0.3:443`，而公网 `43.139.159.100:443` 经 1:1 NAT 映射到该私网 IP —— 公网 443 已被占用，**不能新起监听，只能加 server_name 虚拟主机**。

```bash
# 2.1 渲染 vhost（把 __DOMAIN__ 换成备案域名）
ssh <cvm>
sudo sed 's/__DOMAIN__/cooking.example.com/g' ~/cooking-atlas/deploy/nginx-cooking-atlas.conf \
  | sudo tee /etc/nginx/sites-available/cooking-atlas >/dev/null
sudo ln -sf /etc/nginx/sites-available/cooking-atlas /etc/nginx/sites-enabled/cooking-atlas

# 2.2 先申请证书（webroot），再启用 443 段；否则 nginx -t 会因缺证书失败
sudo mkdir -p /var/www/_letsencrypt
sudo certbot certonly --webroot -w /var/www/_letsencrypt -d cooking.example.com

# 2.3 语法校验通过后才 reload（禁止跳过）
sudo nginx -t && sudo systemctl reload nginx

# 2.4 自检（外网）
curl -sS https://cooking.example.com/health
```

红线：不改 `/etc/nginx/sites-enabled/brainstormtool`；不加 `default_server`；不动 80/443 现有 `listen`。

## 3. 配置 API 环境变量并重建

```bash
cd ~/cooking-atlas
# deploy/.env 追加（600 权限，禁止入 Git）
cat >> deploy/.env <<'EOF'
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...
AI_BASE_URL=https://api.example.com/v1
AI_API_KEY=...
AI_MODEL=...
STT_BASE_URL=https://api.example.com/v1
STT_API_KEY=...
STT_MODEL=whisper-1
EOF
chmod 600 deploy/.env
# 生产必须 NODE_ENV=production（AUTH_TEST_MODE 三重闸门会自动失效）
docker compose -f docker-compose.yml -f deploy/docker-compose.cvm.yml --env-file deploy/.env up -d --build api
docker compose -f docker-compose.yml -f deploy/docker-compose.cvm.yml --env-file deploy/.env logs --tail 30 api
```

验证生产闸门已关闭（应 404，不是 200）：

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://cooking.example.com/api/auth/test -d '{}' -H 'content-type: application/json'
```

## 4. 小程序配置

```bash
# 4.1 替换 AppID（project.config.json 的 appid 字段）
# 4.2 关闭演示模式，指向生产域名（apps/miniprogram/.env 或构建时环境变量）
TARO_APP_DEMO_MODE=false
TARO_APP_API_BASE_URL=https://cooking.example.com
npm run build:weapp
```

微信公众平台后台 → 开发管理 → 服务器域名：

- request 合法域名：`https://cooking.example.com`
- uploadFile 合法域名：`https://cooking.example.com`（图片/录音上传）
- downloadFile 合法域名：`https://cooking.example.com`（卡牌封面、签名 URL 下载）

真机调试可临时跳过域名校验，但**体验版/正式版必须配好合法域名**。

## 5. 真机验收清单（对照 docs/ACCEPTANCE.md）

两人两台手机，A=owner（掌勺者）、B=member（家人）：

1. A 首次进入 → 自动建空间，拿到邀请码；B 输邀请码加入，A 的成员列表出现 B
2. A 拍照 + 语音录入各建一道菜；AI 草稿确认后落库，列表出现真实照片（签名 URL 拉取）
3. B 只能浏览/收藏/点菜；尝试增删改菜谱 → 提示「仅掌勺者可执行」
4. B 提交点菜（含备注）→ A 看到汇总（含 B 的昵称）
5. A 生成推荐 → 确认菜单 → 生成采购清单；同名同单位食材合并，未知用量不出现伪造数字
6. A 标记「家中已有 / 已购买」；回菜单换一道菜 → 采购清单差异同步（已买项状态保留）
7. B 记录一次制作（照片 + 星级 + 心得）→ A 在「我的 · 家庭制作记录」可见
8. 卡牌导出：选一道有照片的菜 → 导出卡牌 → 相册里出现 750×dpr 高清图；拒授权后能引导到设置
9. 分享：点「分享给家人」→ 好友卡片显示菜名与封面
10. 语音：授权录音 → 说话 → 结束录音 → 文本回填 AI 描述框；未配 STT 时提示改用文字
11. 断网/飞行模式下写入 → 有明确失败提示，不出现静默丢失
12. 跨家庭隔离：另建第三个账号加入另一个空间，确认看不到本空间菜谱与采购清单

## 6. 备份与恢复

```bash
# 手工演练（幂等，安全：只操作 scratch 库，不碰生产库）
bash ~/cooking-atlas/deploy/backup-restore-drill.sh ~/backups

# 定时（crontab，每日 03:20）
20 3 * * * /bin/bash /home/iris-deploy/cooking-atlas/deploy/backup-restore-drill.sh /home/iris-deploy/backups >> /home/iris-deploy/backups/drill.log 2>&1
```

待补：备份**异地副本**（当前只留在 CVM 本地，机器级故障会同时丢失）。建议 `mc mirror` 到独立对象存储，或本地 `rsync` 拉回。
