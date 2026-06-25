#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/hetzner/.env.production}"
EXAMPLE_FILE="$REPO_ROOT/deploy/hetzner/.env.production.example"
BACKUP_DIR="${BACKUP_DIR:-/root/allonahub-prod-backup}"
VISIBLE_SECRETS="${VISIBLE_SECRETS:-false}"

mkdir -p "$(dirname "$ENV_FILE")"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
fi

chmod 600 "$ENV_FILE" 2>/dev/null || true
if ! mkdir -p "$BACKUP_DIR" 2>/dev/null; then
  BACKUP_DIR="$(mktemp -d)"
fi
cp "$ENV_FILE" "$BACKUP_DIR/env-production-before-channel-setup-$(date -u +%Y%m%d%H%M%S).bak" 2>/dev/null || true

get_env_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

is_placeholder() {
  local value="${1:-}"
  [ -z "$value" ] && return 0
  case "$value" in
    replace-*|your-*|https://your-project.supabase.co|sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxx)
      return 0
      ;;
  esac
  return 1
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      found = 1
      next
    }
    { print }
    END {
      if (!found) {
        print key "=" value
      }
    }
  ' "$ENV_FILE" > "$tmp"

  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi
  date -u +%s%N | sha256sum | awk '{print $1}'
}

ensure_secret() {
  local key="$1"
  local prefix="${2:-}"
  local current
  current="$(get_env_value "$key")"
  if is_placeholder "$current"; then
    set_env_value "$key" "${prefix}$(generate_secret)"
    echo "$key generated."
  else
    echo "$key already set."
  fi
}

read_value() {
  local key="$1"
  local label="$2"
  local current
  local value
  current="$(get_env_value "$key")"

  if is_placeholder "$current"; then
    printf "%s: " "$label"
  else
    printf "%s is already set. Press Enter to keep it, or type a new value: " "$label"
  fi

  if [ "$VISIBLE_SECRETS" = "true" ]; then
    IFS= read -r value
  else
    IFS= read -r -s value
    echo
  fi

  if [ -n "$value" ]; then
    set_env_value "$key" "$value"
    echo "$key saved."
  elif is_placeholder "$current"; then
    echo "$key skipped."
  else
    echo "$key kept."
  fi
}

set_env_value ASSISTANT_ENABLED true
set_env_value ASSISTANT_AI_PROVIDER rules
set_env_value ASSISTANT_MAX_MESSAGE_CHARS 1600
set_env_value ASSISTANT_MAX_REPLY_CHARS 700
set_env_value ASSISTANT_RATE_LIMIT_MAX 20
set_env_value ASSISTANT_META_GRAPH_VERSION v23.0
set_env_value ASSISTANT_META_SEND_TIMEOUT_MS 10000

ensure_secret TELEGRAM_WEBHOOK_SECRET
ensure_secret ASSISTANT_META_VERIFY_TOKEN allonahub-meta-

echo
echo "Enter channel credentials. Leave a value empty to skip or keep the existing value."
echo "Set VISIBLE_SECRETS=true before this script if you want typed values to be visible."
echo

read_value ASSISTANT_TELEGRAM_BOT_TOKEN "Telegram bot token"
read_value ASSISTANT_META_APP_SECRET "Meta app secret"
read_value ASSISTANT_META_WHATSAPP_ACCESS_TOKEN "WhatsApp Cloud API access token"
read_value ASSISTANT_META_WHATSAPP_PHONE_NUMBER_ID "WhatsApp phone number id"
read_value ASSISTANT_META_INSTAGRAM_ACCESS_TOKEN "Instagram messaging access token"
read_value ASSISTANT_META_FACEBOOK_PAGE_ACCESS_TOKEN "Facebook Messenger page access token"

current_instagram_graph_id="$(get_env_value ASSISTANT_META_INSTAGRAM_GRAPH_ID)"
if is_placeholder "$current_instagram_graph_id"; then
  set_env_value ASSISTANT_META_INSTAGRAM_GRAPH_ID me
fi

current_facebook_page_id="$(get_env_value ASSISTANT_META_FACEBOOK_PAGE_ID)"
if is_placeholder "$current_facebook_page_id"; then
  set_env_value ASSISTANT_META_FACEBOOK_PAGE_ID me
fi

read_value ASSISTANT_META_FACEBOOK_PAGE_ID "Facebook Page id or me"

echo
echo "Assistant channel environment is ready at:"
echo "$ENV_FILE"
echo
echo "Next:"
echo "1. Redeploy the backend container."
echo "2. Register Telegram webhook."
echo "3. Add the Meta callback URL in Meta Developer settings."
