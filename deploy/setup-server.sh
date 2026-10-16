#!/usr/bin/env bash
# Set up the SkillPath demo stand on a fresh Ubuntu 22.04/24.04 or Debian VPS.
# Safe to run again: each step checks the current state first.
#
# Usage (as root):
#   bash deploy/setup-server.sh
# The first run clones the repo to /opt/skillpath-ai, creates deploy/demo.env from the template
# and stops. Fill in the CHANGE_ME values, then run the script again.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/sadrieff/skillpath-ai.git}"
APP_DIR="${APP_DIR:-/opt/skillpath-ai}"
COMPOSE_FILE="deploy/docker-compose.demo.yml"
ENV_FILE="deploy/demo.env"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

compose() {
  (cd "$APP_DIR" && docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@")
}

wait_for_api() {
  log "Waiting for the api container"
  for _ in $(seq 1 30); do
    if compose exec -T api true >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  die "api container is not running. Check: docker compose -f $COMPOSE_FILE logs api"
}

install_base_packages() {
  apt-get update
  apt-get install -y ca-certificates curl git
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and compose plugin are already installed"
    return
  fi

  log "Installing Docker Engine and compose plugin from the official apt repository"
  # Some RU hosters mirror download.docker.com. If it is unreachable from the server, point
  # the URLs below at the hoster's mirror (keep the same key and repo layout), or install the
  # hoster's docker package instead.
  # shellcheck disable=SC1091
  . /etc/os-release
  case "$ID" in
    ubuntu|debian) ;;
    *) die "unsupported OS: $ID (Ubuntu or Debian expected)" ;;
  esac

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$ID" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

setup_firewall() {
  log "Firewall: allow only 22, 80, 443"
  apt-get install -y ufw
  # Allow SSH before enabling ufw, otherwise the current session can be cut off.
  # Docker writes its own iptables rules; only published ports matter, and only 80 and 443 are published.
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  ufw status verbose
}

sync_repo() {
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Updating $APP_DIR"
    git -C "$APP_DIR" pull --ff-only
  else
    log "Cloning $REPO_URL into $APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
  fi
}

check_env() {
  local env_path="$APP_DIR/$ENV_FILE"
  if [[ ! -f "$env_path" ]]; then
    cp "$APP_DIR/deploy/demo.env.example" "$env_path"
    chmod 600 "$env_path"
    die "created $env_path from the template. Fill in every CHANGE_ME value (DEMO_HOST, JWT_SECRET, POSTGRES_PASSWORD, URLs, DATABASE_URL), add ROUTERAI_API_KEY, then run this script again"
  fi
  chmod 600 "$env_path"
  if grep -q 'CHANGE_ME' "$env_path"; then
    die "$env_path still contains CHANGE_ME placeholders"
  fi
  if ! grep -Eq '^ROUTERAI_API_KEY=.+' "$env_path"; then
    echo "WARNING: ROUTERAI_API_KEY is empty, the AI tutor will not work" >&2
  fi
}

main() {
  install_base_packages
  install_docker
  setup_firewall
  sync_repo
  check_env

  log "Building and starting containers"
  compose up -d --build
  wait_for_api

  log "Applying migrations"
  compose exec -T api alembic upgrade head

  log "Loading demo data (idempotent)"
  compose exec -T api python -m app.seed

  local demo_host
  demo_host="$(grep -E '^DEMO_HOST=' "$APP_DIR/$ENV_FILE" | head -n 1 | cut -d= -f2- || true)"
  log "Done. Check: https://${demo_host}/health (first start can take a minute while Caddy gets a certificate)"
}

main "$@"
