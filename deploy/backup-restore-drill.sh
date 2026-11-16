#!/usr/bin/env bash
# cooking-atlas 备份与恢复演练（在 CVM 上执行）
#
#   bash deploy/backup-restore-drill.sh [备份目录]
#
# 做三件事：
#   1. pg_dump -Fc 全量备份到 <备份目录>（保留最近 7 份）
#   2. 还原到一次性 scratch 库 cooking_atlas_restore_check
#   3. 逐表比对源库/还原库行数，全部一致才算通过，最后删除 scratch 库
#
# 前置：容器 cooking-atlas-postgres 正在运行；调用者有 docker 权限。
# 退出码：0 通过，非 0 失败（失败时保留 scratch 库便于排查）。
set -euo pipefail

CONTAINER="${CONTAINER:-cooking-atlas-postgres}"
DB="${DB:-cooking_atlas}"
DB_USER="${DB_USER:-cooking}"
BACKUP_DIR="${1:-$HOME/backups}"
SCRATCH="cooking_atlas_restore_check"
KEEP=7

TABLES=(Recipe User FamilySpace FamilyMembership MealRequest MealPlan ShoppingList RecipeFavorite CookingLog)

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/${DB}-$TS.dump"

psql_src() { docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -tAc "$1"; }
psql_admin() { docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -qc "$1"; }

echo "== 1/4 备份 =="
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB" -Fc > "$DUMP"
echo "dump: $(du -h "$DUMP" | cut -f1) $DUMP"
TOC=$(docker exec -i "$CONTAINER" pg_restore -l < "$DUMP" | grep -c 'TABLE DATA' || true)
echo "TOC 表数据条目: $TOC"
[ "$TOC" -gt 0 ] || { echo "FAIL: 备份无可还原条目"; exit 1; }

echo "== 2/4 还原到 scratch 库 =="
psql_admin "DROP DATABASE IF EXISTS $SCRATCH"
psql_admin "CREATE DATABASE $SCRATCH"
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$SCRATCH" --no-owner < "$DUMP"

echo "== 3/4 行数比对 =="
FAIL=0
for t in "${TABLES[@]}"; do
  a=$(psql_src "select count(*) from \"$t\"")
  b=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$SCRATCH" -tAc "select count(*) from \"$t\"")
  if [ "$a" = "$b" ]; then st=OK; else st=MISMATCH; FAIL=1; fi
  printf '%-18s 源=%-6s 还原=%-6s %s\n' "$t" "$a" "$b" "$st"
done

echo "== 4/4 清理 =="
if [ "$FAIL" -eq 0 ]; then
  psql_admin "DROP DATABASE $SCRATCH"
  echo "scratch 库已删除"
else
  echo "存在差异，保留 scratch 库 $SCRATCH 供排查"
fi

# 保留最近 KEEP 份备份
ls -1t "$BACKUP_DIR"/${DB}-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  echo "清理旧备份: $old"; rm -f "$old"
done

if [ "$FAIL" -eq 0 ]; then echo "RESULT: PASS"; else echo "RESULT: FAIL"; exit 1; fi
