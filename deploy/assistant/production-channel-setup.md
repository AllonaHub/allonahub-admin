# AllonaHub Assistant Production Channel Setup

These commands prepare the production assistant backend for Telegram, WhatsApp, and Instagram without storing any secret in source code.

Run on the Hetzner production server:

```bash
cd /opt/allonahub
git fetch origin main
git merge --ff-only origin/main
```

Configure channel credentials:

```bash
VISIBLE_SECRETS=true bash deploy/assistant/configure-channel-env.sh
```

Use `VISIBLE_SECRETS=false` or omit it if you want hidden input.

Redeploy the backend:

```bash
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build allonahub-api
```

If Docker reports that `allonahub-api` is already in use:

```bash
docker rm -f allonahub-api
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d allonahub-api
```

Register available webhooks and verify callback URLs:

```bash
bash deploy/assistant/register-production-webhooks.sh
```

Check production status:

```bash
bash deploy/assistant/assistant-production-status.sh
```

## Meta Dashboard Values

Use this callback URL:

```text
https://api.allonahub.com/v1/meta/webhook
```

Use the generated value from `ASSISTANT_META_VERIFY_TOKEN` as the webhook verify token.

WhatsApp requires:

- `ASSISTANT_META_WHATSAPP_ACCESS_TOKEN`
- `ASSISTANT_META_WHATSAPP_PHONE_NUMBER_ID`

Instagram requires:

- `ASSISTANT_META_INSTAGRAM_ACCESS_TOKEN`
- `ASSISTANT_META_INSTAGRAM_GRAPH_ID`

## Supabase Log Check

```sql
select id, channel, sender_type, message, metadata, created_at
from public.conversation_logs
where channel in ('webchat', 'telegram', 'whatsapp', 'instagram')
order by created_at desc
limit 30;
```
