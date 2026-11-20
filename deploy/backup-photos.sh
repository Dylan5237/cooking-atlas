#!/usr/bin/env bash
# cooking-atlas 照片对象备份：mc mirror MinIO bucket → 本机备份目录（与 DB 备份同放 ~/backups）。
#
#   bash deploy/backup-photos.sh [备份目录]     # 默认 ~/backups
#
# 幂等镜像；不加 --remove —— 源端删除的对象在备份侧保留（防误删/勒索扩散到备份）。
# 前置：deploy/.env 已配置 MINIO_ROOT_USER/MINIO_ROOT_PASSWORD；调用者有 docker 权限。
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")" && pwd)/.env}"
BACKUP_DIR="${1:-$HOME/backups}/photos"
MC_IMAGE="minio/mc:RELEASE.2025-08-13T08-35-41Z"

# shellcheck disable=SC1090
source "$ENV_FILE"
: "${MINIO_ROOT_USER:?set MINIO_ROOT_USER in deploy/.env}"
: "${MINIO_ROOT_PASSWORD:?set MINIO_ROOT_PASSWORD in deploy/.env}"

mkdir -p "$BACKUP_DIR"
# minio 只绑服务器回环 → --network host 直连 127.0.0.1:9000；-u 保证文件不落 root 属主
# HOME=/tmp：mc 启动要写 ~/.mc 配置目录，容器内 -u 非 root 时 / 不可写
docker run --rm --network host -u "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e "MC_HOST_local=http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000" \
  -v "$BACKUP_DIR:/backup" "$MC_IMAGE" \
  mirror --overwrite local/cooking-atlas /backup/cooking-atlas

echo "photos mirrored: $BACKUP_DIR/cooking-atlas ($(find "$BACKUP_DIR/cooking-atlas" -type f | wc -l) files)"
