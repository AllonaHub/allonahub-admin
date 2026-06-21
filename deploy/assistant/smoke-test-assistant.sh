#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.allonahub.com}"
ENDPOINT="${API_URL%/}/v1/assistant/messages"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for the assistant smoke test." >&2
  exit 1
fi

echo "Testing assistant endpoint: $ENDPOINT"
HTTP_CODE="$(curl -sS -o "$TMP_FILE" -w "%{http_code}" "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"channel":"webchat","conversationId":"smoke-test-rules","message":"Partner başvurusu yapmak istiyorum","metadata":{"source":"deploy_smoke_test"}}')"

cat "$TMP_FILE"
echo

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "Assistant smoke test failed with HTTP $HTTP_CODE." >&2
  exit 1
fi

if ! grep -q '"ok":true' "$TMP_FILE"; then
  echo "Assistant smoke test response did not include ok=true." >&2
  exit 1
fi

echo "Assistant smoke test passed."

