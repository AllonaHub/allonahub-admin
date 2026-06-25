#!/usr/bin/env sh
set -eu

API_URL="${API_URL:-https://api.allonahub.com}"
VERIFY_TOKEN="${ASSISTANT_META_VERIFY_TOKEN:-${META_WEBHOOK_VERIFY_TOKEN:-}}"
APP_SECRET="${ASSISTANT_META_APP_SECRET:-${META_APP_SECRET:-}}"
ENDPOINT="${API_URL%/}/v1/meta/webhook"
CHALLENGE="allonahub-meta-webhook-ok"

if [ -z "$VERIFY_TOKEN" ]; then
  echo "Set ASSISTANT_META_VERIFY_TOKEN or META_WEBHOOK_VERIFY_TOKEN before testing Meta webhook verification." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for the Meta webhook smoke test." >&2
  exit 1
fi

VERIFY_RESPONSE="$(curl -fsS "${ENDPOINT}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${CHALLENGE}")"
if [ "$VERIFY_RESPONSE" != "$CHALLENGE" ]; then
  echo "Meta webhook verification failed." >&2
  echo "Expected: $CHALLENGE" >&2
  echo "Actual:   $VERIFY_RESPONSE" >&2
  exit 1
fi

echo "Meta webhook verification passed: $ENDPOINT"

if [ "${META_WEBHOOK_POST_TEST:-false}" != "true" ]; then
  echo "Skipping signed POST test. Set META_WEBHOOK_POST_TEST=true to send a synthetic WhatsApp event."
  exit 0
fi

if [ -z "$APP_SECRET" ]; then
  echo "Set ASSISTANT_META_APP_SECRET or META_APP_SECRET for the signed POST test." >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required for the signed POST test." >&2
  exit 1
fi

TEST_CHANNEL="${META_WEBHOOK_TEST_CHANNEL:-whatsapp}"
case "$TEST_CHANNEL" in
  whatsapp)
    PAYLOAD='{"object":"whatsapp_business_account","entry":[{"id":"test-waba","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"15550000000","phone_number_id":"test-phone-number"},"contacts":[{"profile":{"name":"Meta Smoke Test"},"wa_id":"15551234567"}],"messages":[{"from":"15551234567","id":"wamid.smoke-test","timestamp":"1782139200","type":"text","text":{"body":"Merhaba, partner olmak istiyorum"}}]}}]}]}'
    ;;
  instagram)
    PAYLOAD='{"object":"instagram","entry":[{"id":"test-instagram","time":1782139200,"messaging":[{"sender":{"id":"17841400000000000"},"recipient":{"id":"17841499999999999"},"timestamp":1782139200,"message":{"mid":"igmid.smoke-test","text":"Merhaba, akademi hakkinda bilgi alabilir miyim?"}}]}]}'
    ;;
  facebook)
    PAYLOAD='{"object":"page","entry":[{"id":"test-page","time":1782139200,"messaging":[{"sender":{"id":"1234567890"},"recipient":{"id":"test-page"},"timestamp":1782139200,"message":{"mid":"fbmid.smoke-test","text":"Merhaba, destek almak istiyorum"}}]}]}'
    ;;
  *)
    echo "Unsupported META_WEBHOOK_TEST_CHANNEL: $TEST_CHANNEL" >&2
    echo "Use whatsapp, instagram, or facebook." >&2
    exit 1
    ;;
esac

SIGNATURE="$(printf "%s" "$PAYLOAD" | openssl dgst -sha256 -hmac "$APP_SECRET" | awk '{print $NF}')"

curl -fsS "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=${SIGNATURE}" \
  -d "$PAYLOAD"

echo
echo "Meta webhook signed POST test completed."
