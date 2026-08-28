#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.allonahub.com}"
ENDPOINT="${API_URL%/}/v1/assistant/messages"
NODE_BIN="${NODE_BIN:-node}"
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

if command -v "$NODE_BIN" >/dev/null 2>&1; then
  "$NODE_BIN" - "$TMP_FILE" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const body = JSON.parse(fs.readFileSync(file, "utf8"));
const message = String(body.message || "");
const actions = Array.isArray(body.actions) ? body.actions : [];
const openUrlActions = actions.filter((action) => action && action.type === "open_url");
const urls = openUrlActions.map((action) => String(action.url || "").trim().toLowerCase()).filter(Boolean);

if (actions.length > 3) {
  console.error(`Assistant smoke test failed: expected at most 3 actions, got ${actions.length}.`);
  process.exit(1);
}

if (actions.length && /https?:\/\//i.test(message)) {
  console.error("Assistant smoke test failed: response includes raw URL text while action buttons are present.");
  process.exit(1);
}

if (new Set(urls).size !== urls.length) {
  console.error("Assistant smoke test failed: duplicate action URLs were returned.");
  process.exit(1);
}
NODE
else
  echo "Node.js was not found; skipped assistant response-shape checks." >&2
fi

echo "Assistant smoke test passed."
