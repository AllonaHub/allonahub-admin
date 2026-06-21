#!/usr/bin/env bash
set -euo pipefail

BOT_TOKEN="${ASSISTANT_TELEGRAM_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"
API_URL="${API_URL:-https://api.allonahub.com}"
WEBHOOK_URL="${TELEGRAM_WEBHOOK_URL:-${API_URL%/}/v1/telegram/webhook}"

if [ -z "$BOT_TOKEN" ]; then
  echo "Set ASSISTANT_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN before registering the webhook." >&2
  exit 1
fi

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "Set TELEGRAM_WEBHOOK_SECRET before registering the webhook." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to register the Telegram webhook." >&2
  exit 1
fi

echo "Registering Telegram webhook at: $WEBHOOK_URL"
curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"url":"%s","secret_token":"%s","drop_pending_updates":true,"allowed_updates":["message","edited_message","callback_query"]}' "$WEBHOOK_URL" "$WEBHOOK_SECRET")"

echo
echo "Telegram webhook info:"
curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
echo

