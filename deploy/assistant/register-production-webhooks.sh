#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/hetzner/.env.production}"
API_URL="${API_URL:-https://api.allonahub.com}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
else
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

BOT_TOKEN="${ASSISTANT_TELEGRAM_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"

if [ -n "$BOT_TOKEN" ] && [ -n "$WEBHOOK_SECRET" ]; then
  API_URL="$API_URL" bash "$SCRIPT_DIR/register-telegram-webhook.sh"
else
  echo "Telegram webhook skipped. Set ASSISTANT_TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first."
fi

echo
echo "Meta callback URL:"
echo "${API_URL%/}/v1/meta/webhook"

if [ -n "${ASSISTANT_META_VERIFY_TOKEN:-${META_WEBHOOK_VERIFY_TOKEN:-}}" ]; then
  API_URL="$API_URL" sh "$SCRIPT_DIR/smoke-test-meta-webhook.sh"
else
  echo "Meta verification test skipped. Set ASSISTANT_META_VERIFY_TOKEN first."
fi

echo
echo "Webhook registration checks completed."
