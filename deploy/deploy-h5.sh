#!/usr/bin/env bash
# H5 部署/更新到 CVM（在仓库根目录执行，本地跑）：
#   bash deploy/deploy-h5.sh               # 构建 + 上传静态资源 + nginx 平滑更新
#   bash deploy/deploy-h5.sh --skip-build  # 跳过构建，只上传 + reload
# 前置：本机 ssh config 有 tx 别名（ubuntu，免密 sudo）；
#       首次部署的 nginx 配置安装见 docs/A7_DEPLOY_RUNBOOK.md（本脚本只管静态资源更新）。
set -euo pipefail
cd "$(dirname "$0")/.."
SSH_HOST="${SSH_HOST:-tx}"

if [ "${1:-}" != "--skip-build" ]; then
  # 同源部署：空串 = 相对路径，两处 vhost（nip.io / ts.net）共用一份产物。
  # 两个变量都必须列出 —— 未注入的 TARO_APP_* 会残留运行时 process 引用，浏览器直接崩。
  (cd apps/miniprogram && printf 'TARO_APP_API_BASE_URL=\nTARO_APP_DEMO_MODE=false\n' > .env && npm run build:h5)
fi

tar -C apps/miniprogram/dist -czf /tmp/cooking-atlas-h5.tgz .
scp -q /tmp/cooking-atlas-h5.tgz "$SSH_HOST":/tmp/
ssh "$SSH_HOST" 'set -e
  sudo mkdir -p /var/www/cooking-atlas-h5
  sudo tar -xzf /tmp/cooking-atlas-h5.tgz -C /var/www/cooking-atlas-h5
  sudo chown -R iris-deploy:iris-deploy /var/www/cooking-atlas-h5
  sudo nginx -t && sudo systemctl reload nginx
  echo "h5 deployed -> $(sudo ls -la /var/www/cooking-atlas-h5/index.html)"
'
