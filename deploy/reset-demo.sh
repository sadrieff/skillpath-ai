#!/usr/bin/env bash
# Reset the demo data: runs `python -m app.demo_reset` inside the api container.
# Meant for cron (nightly at 04:00 server time), see docs/deploy-demo.md.
# Usage: bash /opt/skillpath-ai/deploy/reset-demo.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/skillpath-ai}"
COMPOSE_FILE="deploy/docker-compose.demo.yml"
ENV_FILE="deploy/demo.env"

echo "$(date -Is) demo reset: start"
(cd "$APP_DIR" && docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api python -m app.demo_reset)
echo "$(date -Is) demo reset: done"
