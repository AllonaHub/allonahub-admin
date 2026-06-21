# AllonaHub Central Assistant Service

This document defines the first production-safe foundation for the AllonaHub multi-channel AI support assistant.

## Scope

The assistant backend is channel independent. Current supported channels are:

- `webchat`
- `telegram`
- `partner_panel`
- `admin_panel`
- `whatsapp`
- `instagram`

The first two are wired as endpoints now. The remaining channels use the same `/v1/assistant/messages` contract and can be connected by adapters later.

## Backend Endpoints

### `POST /v1/assistant/messages`

Receives a support message and returns a short assistant reply.

Important fields:

- `message`: user message, max length controlled by `ASSISTANT_MAX_MESSAGE_CHARS`
- `channel` or `source`: channel identifier
- `conversationId`: stable client-side conversation id
- `orderId` or `orderReference`: optional secure order lookup reference
- `createSupportTicket`: explicit ticket creation flag
- `metadata`: sanitized channel/page metadata

Security behavior:

- `admin_panel` requires an authenticated `admin` or `super_admin`.
- `partner_panel` requires an authenticated `partner`, `admin` or `super_admin`.
- Public `webchat`, `telegram`, `whatsapp` and `instagram` channels do not receive privileged data.
- Order details are returned only for the signed-in owner or admin.
- The second-stage production mode is fully rule-based: set `ASSISTANT_AI_PROVIDER=rules`.
- If a paid AI key is present by accident, `ASSISTANT_AI_PROVIDER=rules` still prevents outbound AI calls.

### `POST /v1/telegram/webhook`

Receives Telegram webhook updates and routes the text into the same assistant pipeline.

Production notes:

- Set `TELEGRAM_WEBHOOK_SECRET` and configure Telegram with the same secret token.
- Set `ASSISTANT_TELEGRAM_BOT_TOKEN` to send replies back to Telegram.
- If the bot token is missing, the endpoint still generates and logs replies but does not deliver them to Telegram.

## Database

Migration: `supabase/migrations/20260621223000_create_conversation_logs.sql`

Table: `public.conversation_logs`

Columns:

- `id`
- `user_id`
- `channel`
- `sender_type`
- `message`
- `metadata`
- `created_at`

RLS:

- `anon` has no direct table access.
- authenticated users can read and insert only their own rows.
- admins can read logs through `public.is_admin()`.
- backend `service_role` can insert public channel logs.

## Web Widget

File: `js/assistant-widget.js`

The public homepage loads this widget through:

```html
<script src="js/assistant-widget.js?v=20260621-rules1" defer data-channel="webchat"></script>
```

Embed example:

```html
<script src="/js/config.js"></script>
<script src="/js/core.js"></script>
<script src="/js/auth.js"></script>
<script src="/js/assistant-widget.js" defer data-channel="webchat"></script>
```

For manual mounting:

```html
<script src="/js/assistant-widget.js" defer data-auto-mount="false"></script>
<script>
  window.Allona.assistantWidget.mount({ channel: "webchat" });
</script>
```

## Supported Flows

- Order status: secure lookup by authenticated owner/admin, otherwise login or support guidance.
- Partner application: routes users to the partner application flow.
- FAQ: answers AllonaHub support questions briefly and directs to support when needed.
- AllonaHub Academy: routes users to the Academy surface.
- Support ticket: creates `support_tickets` or partner tickets when explicitly requested.

## Secret Handling

Never place these values in frontend files:

- `ASSISTANT_AI_API_KEY`
- `OPENAI_API_KEY`
- `ASSISTANT_TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- Supabase service role or secret keys

All secrets must be deployed as environment variables in the backend runtime.

## Stage 2 Production Runbook

### 1. Apply Supabase Migration

Required local/server environment:

- `SUPABASE_DB_URL`, `DATABASE_URL` or `POSTGRES_URL`
- `psql`

Command:

```bash
SUPABASE_DB_URL="postgresql://..." ./deploy/assistant/apply-assistant-migration.sh
```

### 2. Backend Environment Variables

Required for rule-based assistant production:

- `ASSISTANT_ENABLED=true`
- `ASSISTANT_AI_PROVIDER=rules`
- `ASSISTANT_AI_API_KEY=` blank
- `OPENAI_API_KEY=` blank
- `ASSISTANT_MAX_MESSAGE_CHARS=1600`
- `ASSISTANT_MAX_REPLY_CHARS=700`
- `ASSISTANT_RATE_LIMIT_MAX=20`
- `ASSISTANT_TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- existing backend values from `deploy/hetzner/.env.production.example`

### 3. Deploy Backend

Coolify/Traefik path:

```bash
cd /opt/allonahub
git pull
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build
curl -fsS https://api.allonahub.com/health
curl -fsS https://api.allonahub.com/ready
```

Plain Docker/Nginx path:

```bash
cd /opt/allonahub
git pull
docker compose -f deploy/compose/docker-compose.prod.yml up -d --build
curl -fsS https://api.allonahub.com/health
curl -fsS https://api.allonahub.com/ready
```

### 4. Register Telegram Webhook

Required environment:

- `ASSISTANT_TELEGRAM_BOT_TOKEN` or `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `API_URL=https://api.allonahub.com`

Command:

```bash
ASSISTANT_TELEGRAM_BOT_TOKEN="..." TELEGRAM_WEBHOOK_SECRET="..." ./deploy/assistant/register-telegram-webhook.sh
```

### 5. Smoke Test

```bash
API_URL=https://api.allonahub.com ./deploy/assistant/smoke-test-assistant.sh
```

Expected behavior:

- The endpoint returns `ok=true`.
- The reply is short, Turkish and support-focused.
- `provider` in conversation metadata should be `fallback` while `ASSISTANT_AI_PROVIDER=rules`.
- `conversation_logs` receives user and assistant rows after the migration is applied.
