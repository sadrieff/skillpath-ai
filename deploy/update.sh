#!/usr/bin/env bash
# Update the demo stand: git pull (main), rebuild images, restart, apply migrations.
# Usage (as root): bash /opt/skillpath-ai/deploy/update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/skillpath-ai}"
COMPOSE_FILE="deploy/docker-compose.demo.yml"
ENV_FILE="deploy/demo.env"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

compose() {
  (cd "$APP_DIR" && docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@")
}

[[ -f "$APP_DIR/$ENV_FILE" ]] || die "$APP_DIR/$ENV_FILE is missing, run deploy/setup-server.sh first"

log "Pulling latest code"
git -C "$APP_DIR" pull --ff-only

log "Rebuilding and restarting containers"
compose up -d --build

log "Waiting for the api container"
for _ in $(seq 1 30); do
  if compose exec -T api true >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
compose exec -T api true >/dev/null 2>&1 || die "api container is not running. Check: docker compose -f $COMPOSE_FILE logs api"

log "Applying migrations"
compose exec -T api alembic upgrade head

log "Removing unused images"
docker image prune -f

log "Update finished"
