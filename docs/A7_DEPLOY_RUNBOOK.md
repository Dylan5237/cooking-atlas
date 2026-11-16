# A7 生产部署与真机验收 Runbook

> 状态：**BLOCKED** —— 前端/后端代码就绪，卡在外部凭据与备案域名。下文每一步都可执行，缺项已标注。
> 纪律：不使用演示数据冒充验收通过；每一步的产出都要留可复核证据。

## 0. 无域名试用（当前可用，2026-11-16 实跑通过）

**适用**：微信开发者工具 / 预览 / 真机调试（必须开调试模式）。**不适用**：体验版与正式版（微信强制备案域名 + HTTPS）。

| 项 | 值 |
| --- | --- |
| API 地址 | `http://43.139.159.100.nip.io`（80 端口 vhost，借 nip.io 通配 DNS 指到 CVM，未动现有 80/443 站点） |
| 试用码 | `atlas-a4755a`（CVM `deploy/.env` 的 `TRIAL_LOGIN_CODE`，留空即关闭入口） |
| 小程序源码 | `apps/miniprogram`，`project.config.json` 的 `urlCheck=false`（跳过合法域名校验） |
| 编译产物 | `apps/miniprogram/dist/`，`dist/common.js` 已注入上述 API 地址 |
| 登录方式 | 页面底部「输入试用码」→ 设备号自动生成；两台手机用同一码会得到两个账号，可验证 owner/member |

**操作步骤**：微信开发者工具 → 导入项目 → 目录选 `apps/miniprogram`（AppID 选「测试号」或保留 `touristappid`）→ 详情 → 本地设置 → 勾选「不校验合法域名…」→ 编译。真机调试时手机端也要打开调试模式。AI 与 STT 未配置会 503 降级为手动录入，不影响其余流程。

**安全边界**：`TRIAL_LOGIN_CODE` 是显式开关，未配置时 `/api/auth/trial` 返回 503；按 deviceId 限流 10/min；token 7 天；CVM 上 api/postgres/minio 仍只绑 127.0.0.1，公网仅经 nginx vhost 的 `/api/*` 与 `/health` 透传。现有站点回归验证 `http(s)://43.139.159.100/` 均 200 / 471B，与改前一致。

**公网冒烟证据**：`/health` → `{"ok":true}`；正确码 → 200 + JWT；错误码 → 403；现有站点 → 200/471B。

---

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
