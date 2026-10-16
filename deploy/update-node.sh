#!/usr/bin/env bash
# Обновление стенда на общей ноде: свежий код, новые образы из ghcr.io, перезапуск.
# Миграции применяются при старте контейнера api. Образы не собираются на ноде.
# Использование: bash ~/skillpath-demo/deploy/update-node.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/skillpath-demo}"
cd "$APP_DIR"
git pull --ff-only

cd deploy
[ -f demo.env ] || { echo "deploy/demo.env не найден" >&2; exit 1; }
[ -f certs/fullchain.pem ] && [ -f certs/privkey.pem ] || { echo "в deploy/certs нет сертификата" >&2; exit 1; }

docker compose -f docker-compose.node.yml --env-file demo.env pull
docker compose -f docker-compose.node.yml --env-file demo.env up -d
docker compose -f docker-compose.node.yml --env-file demo.env ps
