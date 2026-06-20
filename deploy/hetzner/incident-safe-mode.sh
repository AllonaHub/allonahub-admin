#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/allonahub}"
ENV_FILE="$APP_DIR/deploy/hetzner/.env.production"
COMPOSE_FILE="$APP_DIR/deploy/compose/docker-compose.hetzner-traefik.yml"

usage() {
  cat <<'USAGE'
Usage:
  incident-safe-mode.sh status
  incident-safe-mode.sh maintenance-on
  incident-safe-mode.sh maintenance-off
  incident-safe-mode.sh api-off
  incident-safe-mode.sh api-on
  incident-safe-mode.sh payments-off
  incident-safe-mode.sh payments-on

This script only toggles temporary protection flags and redeploys the existing image.
It does not rotate secrets, run migrations, change production code, or create permanent firewall rules.
USAGE
}

set_kv() {
  key="$1"
  value="$2"
  tmp="$(mktemp)"
  if [ ! -f "$ENV_FILE" ]; then
    echo "Missing env file: $ENV_FILE" >&2
    exit 1
  fi
  awk -F= -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    index($0, key "=") == 1 { print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }
  ' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
  chmod 600 "$ENV_FILE"
}

redeploy() {
  cd "$APP_DIR"
  docker compose -f "$COMPOSE_FILE" up -d --build allonahub-api
}

status() {
  cd "$APP_DIR"
  echo "HEAD=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  awk -F= '
    /^(MAINTENANCE_MODE|EMERGENCY_API_DISABLED|PAYMENTS_DISABLED|AUTO_DEFENSE_ENABLED)=/ {
      print $1 "=" $2
    }
  ' "$ENV_FILE"
  docker ps --filter name=allonahub-api --format 'API_CONTAINER={{.Names}} {{.Status}}'
}

case "${1:-}" in
  status)
    status
    ;;
  maintenance-on)
    set_kv MAINTENANCE_MODE true
    redeploy
    ;;
  maintenance-off)
    set_kv MAINTENANCE_MODE false
    redeploy
    ;;
  api-off)
    set_kv EMERGENCY_API_DISABLED true
    redeploy
    ;;
  api-on)
    set_kv EMERGENCY_API_DISABLED false
    redeploy
    ;;
  payments-off)
    set_kv PAYMENTS_DISABLED true
    redeploy
    ;;
  payments-on)
    set_kv PAYMENTS_DISABLED false
    redeploy
    ;;
  *)
    usage
    exit 1
    ;;
esac
