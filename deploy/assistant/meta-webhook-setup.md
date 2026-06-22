# AllonaHub Meta Assistant Webhook

## Callback URL

Use this callback URL in the Meta Developer App webhook settings:

```text
https://api.allonahub.com/v1/meta/webhook
```

## Required Production Environment Variables

```env
ASSISTANT_META_VERIFY_TOKEN=replace-with-long-random-meta-verify-token
ASSISTANT_META_APP_SECRET=replace-with-meta-app-secret
ASSISTANT_META_GRAPH_VERSION=v23.0
```

## WhatsApp Cloud API

```env
ASSISTANT_META_WHATSAPP_ACCESS_TOKEN=replace-with-whatsapp-system-user-token
ASSISTANT_META_WHATSAPP_PHONE_NUMBER_ID=replace-with-phone-number-id
```

Subscribe the Meta webhook to WhatsApp messages for the WhatsApp Business Account.

## Instagram Messaging

```env
ASSISTANT_META_INSTAGRAM_ACCESS_TOKEN=replace-with-instagram-or-page-access-token
ASSISTANT_META_INSTAGRAM_GRAPH_ID=me
```

Connect an Instagram Professional account to a Facebook Page, install the app for the account, and subscribe the webhook to Instagram messaging events.

## Facebook Messenger

```env
ASSISTANT_META_FACEBOOK_PAGE_ACCESS_TOKEN=replace-with-facebook-page-access-token
ASSISTANT_META_FACEBOOK_PAGE_ID=me
```

Connect the Facebook Page to the Meta Developer App, add the Messenger product, and subscribe the webhook to page messaging events.

## Smoke Test

Webhook verification:

```bash
cd /opt/allonahub
API_URL=https://api.allonahub.com sh deploy/assistant/smoke-test-meta-webhook.sh
```

Signed POST test, only after `ASSISTANT_META_APP_SECRET` is set:

```bash
cd /opt/allonahub
META_WEBHOOK_POST_TEST=true API_URL=https://api.allonahub.com sh deploy/assistant/smoke-test-meta-webhook.sh
```

The signed POST test sends a synthetic WhatsApp text event into the assistant pipeline by default. To test other Meta channels:

```bash
cd /opt/allonahub
META_WEBHOOK_POST_TEST=true META_WEBHOOK_TEST_CHANNEL=instagram API_URL=https://api.allonahub.com sh deploy/assistant/smoke-test-meta-webhook.sh
META_WEBHOOK_POST_TEST=true META_WEBHOOK_TEST_CHANNEL=facebook API_URL=https://api.allonahub.com sh deploy/assistant/smoke-test-meta-webhook.sh
```

If the relevant access token is not configured, the webhook still processes and logs the assistant response, but `delivered` remains false.
