#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/allonahub}"
OUT_DIR="${OUT_DIR:-/opt/allonahub/incident-reports}"

mkdir -p "$OUT_DIR"
cd "$APP_DIR"

CURRENT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
PREVIOUS="$(git rev-parse --short HEAD~1 2>/dev/null || echo unknown)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$OUT_DIR/rollback-plan-$STAMP.txt"

cat > "$REPORT" <<EOF
AllonaHub Rollback Preparation
generated_at_utc=$STAMP
current_commit=$CURRENT
previous_commit=$PREVIOUS

This file is a rollback plan only. It does not execute rollback.

Human approval required before running:
1. Confirm incident scope and affected endpoints.
2. Confirm database migrations are backward compatible.
3. Confirm payment/callback state will not be corrupted.
4. Confirm latest backup/snapshot exists.

Candidate rollback commands:
  cd $APP_DIR
  git fetch origin main
  git checkout $PREVIOUS
  docker compose -f docker-compose.hetzner-traefik.yml up -d --build allonahub-api
  curl -fsS https://api.allonahub.com/health

Return to main after fix:
  cd $APP_DIR
  git checkout main
  git pull --ff-only origin main
  docker compose -f docker-compose.hetzner-traefik.yml up -d --build allonahub-api
EOF

echo "$REPORT"
