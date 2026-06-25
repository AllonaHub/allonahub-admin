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
fi

request() {
  local label="$1"
  local method="$2"
  local url="$3"
  local data="${4:-}"
  local tmp
  local code
  tmp="$(mktemp)"

  if [ -n "$data" ]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$data" || true)"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" || true)"
  fi

  echo "$label HTTP $code"
  head -c 500 "$tmp"
  echo
  rm -f "$tmp"
}

request "Health" GET "${API_URL%/}/health"
request "Assistant webchat" POST "${API_URL%/}/v1/assistant/messages" '{"channel":"webchat","conversationId":"production-status-webchat","message":"Merhaba, partner basvurusu hakkinda bilgi almak istiyorum.","metadata":{"source":"production_status"}}'

if [ -n "${TELEGRAM_WEBHOOK_SECRET:-}" ]; then
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w "%{http_code}" -X POST "${API_URL%/}/v1/telegram/webhook" \
    -H "Content-Type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: ${TELEGRAM_WEBHOOK_SECRET}" \
    -d '{}' || true)"
  echo "Telegram backend endpoint HTTP $code"
  cat "$tmp"
  echo
  rm -f "$tmp"
else
  request "Telegram backend endpoint" POST "${API_URL%/}/v1/telegram/webhook" '{}'
fi

BOT_TOKEN="${ASSISTANT_TELEGRAM_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
if [ -n "$BOT_TOKEN" ]; then
  echo "Telegram getMe:"
  curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getMe" || true
  echo
  echo "Telegram webhook info:"
  curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" || true
  echo
else
  echo "Telegram token is not set."
fi

VERIFY_TOKEN="${ASSISTANT_META_VERIFY_TOKEN:-${META_WEBHOOK_VERIFY_TOKEN:-}}"
if [ -n "$VERIFY_TOKEN" ]; then
  echo "Meta webhook verification:"
  curl -fsS "${API_URL%/}/v1/meta/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=allonahub-status-ok" || true
  echo
else
  echo "Meta verify token is not set."
fi
