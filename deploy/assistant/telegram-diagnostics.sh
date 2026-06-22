#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/hetzner/.env.production}"
CONTAINER_NAME="${CONTAINER_NAME:-allonahub-api}"

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
if [ -z "$BOT_TOKEN" ]; then
  echo "Telegram token is not set in $ENV_FILE" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi

echo "Telegram getMe:"
GET_ME="$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getMe")"
echo "$GET_ME"
BOT_USERNAME="$(printf "%s" "$GET_ME" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')"

if [ -n "$BOT_USERNAME" ]; then
  echo
  echo "Message this bot, not BotFather:"
  echo "https://t.me/${BOT_USERNAME}"
fi

echo
echo "Telegram webhook info:"
curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
echo

echo
echo "Backend container env check:"
docker exec "$CONTAINER_NAME" node -e 'console.log(JSON.stringify({assistantTelegramToken:Boolean(process.env.ASSISTANT_TELEGRAM_BOT_TOKEN), telegramWebhookSecret:Boolean(process.env.TELEGRAM_WEBHOOK_SECRET), assistantEnabled:process.env.ASSISTANT_ENABLED, assistantProvider:process.env.ASSISTANT_AI_PROVIDER}, null, 2))'

echo
echo "Local Telegram webhook pipeline test:"
docker exec "$CONTAINER_NAME" node - <<'NODE'
const payload = {
  update_id: Date.now(),
  message: {
    message_id: 9001,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 999999999, type: "private" },
    from: {
      id: 999999999,
      is_bot: false,
      first_name: "Diagnostics",
      username: "allonahub_diagnostics",
      language_code: "tr"
    },
    text: "Merhaba, partner basvurusu hakkinda bilgi almak istiyorum"
  }
};

const response = await fetch("http://127.0.0.1:3000/v1/telegram/webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Telegram-Bot-Api-Secret-Token": process.env.TELEGRAM_WEBHOOK_SECRET || ""
  },
  body: JSON.stringify(payload)
});

console.log(`HTTP ${response.status}`);
console.log(await response.text());
NODE

echo
echo "Recent backend logs:"
docker logs --tail=80 "$CONTAINER_NAME" 2>&1 | tail -n 80
