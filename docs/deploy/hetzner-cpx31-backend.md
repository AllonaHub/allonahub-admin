# Hetzner CPX31 Production Backend

Bu doküman AllonaHub frontend'i GitHub Pages/Cloudflare tarafında bırakıp backend API'yi Hetzner CPX31 üzerinde `api.allonahub.com` olarak çalıştırmak içindir.

## SSH Kontrolü

Gerçek IP placeholder olmadığı zaman:

```bash
ssh -p 22 root@SUNUCU_IP
# veya
ssh -p 22 deploy@SUNUCU_IP
```

Sunucu kontrol scripti:

```bash
chmod +x deploy/hetzner/server-check.sh
./deploy/hetzner/server-check.sh
```

Uzaktan tek komutla:

```bash
scp -P 22 deploy/hetzner/server-check.sh root@SUNUCU_IP:/tmp/server-check.sh
ssh -p 22 root@SUNUCU_IP 'bash /tmp/server-check.sh'
```

## Mimari

- Frontend: GitHub Pages + Cloudflare
- Backend API: Hetzner CPX31, Docker container, `127.0.0.1:3000`
- Reverse proxy: Nginx, `api.allonahub.com`
- Database/Auth: Supabase devam eder
- Secrets: Sadece sunucuda `deploy/hetzner/.env.production`
- Service role key: Frontend'e konmaz, sadece backend container environment içinde tutulur

## Coolify Kararı

Sunucuda Coolify varsa önerilen ayar:

- App type: Dockerfile
- Build context: `backend`
- Dockerfile: `backend/Dockerfile`
- Port: `3000`
- Domain: `https://api.allonahub.com`
- Healthcheck path: `/health`
- Environment variables: `.env.production.example` listesindeki gerçek değerler

Coolify yoksa veya sade yapı tercih edilirse `deploy/compose/docker-compose.prod.yml + Nginx` kullanılır.

Mevcut sunucuda Coolify proxy zaten 80/443 portlarını yönetiyorsa Nginx kurmayın.
Bu durumda backend API ayrı container olarak Traefik'e bağlanır:

```bash
cd /opt/allonahub
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml ps
curl https://api.allonahub.com/health
```

## Docker ve Nginx Kurulumu

Ubuntu üzerinde:

```bash
apt update
apt install -y ca-certificates curl gnupg ufw nginx certbot python3-certbot-nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker nginx
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## Deploy

Sunucuda repo:

```bash
mkdir -p /opt/allonahub
cd /opt/allonahub
git clone https://github.com/AllonaHub/allonahub-admin.git .
cp deploy/hetzner/.env.production.example deploy/hetzner/.env.production
nano deploy/hetzner/.env.production
```

Gerçek secretlar yalnızca bu dosyada tutulur:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
IYZICO_API_KEY
IYZICO_SECRET_KEY
IYZICO_BASE_URL
SITE_URL
API_URL
ALLOWED_ORIGINS
CV_PRICE_TRY
CRON_SECRET
```

Container:

```bash
docker compose -f deploy/compose/docker-compose.prod.yml up -d --build
docker compose -f deploy/compose/docker-compose.prod.yml logs -f --tail=100
curl http://127.0.0.1:3000/health
```

Coolify/Traefik olan sunucuda:

```bash
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml logs -f --tail=100
curl https://api.allonahub.com/health
```

## Nginx ve SSL

DNS:

- `api.allonahub.com` A kaydı Hetzner IP'ye gider.
- Cloudflare proxy açık olabilir.
- SSL mode: Full Strict

İlk sertifika:

```bash
certbot --nginx -d api.allonahub.com
```

Sonrasında repo config'i:

```bash
cp deploy/hetzner/nginx/api.allonahub.com.conf /etc/nginx/sites-available/api.allonahub.com
ln -sf /etc/nginx/sites-available/api.allonahub.com /etc/nginx/sites-enabled/api.allonahub.com
nginx -t
systemctl reload nginx
curl https://api.allonahub.com/health
```

## API Endpointleri

- `GET /health`
- `GET /ready`
- `POST /v1/orders`
- `POST /v1/payments/iyzico/checkout`
- `GET|POST /v1/payments/iyzico/callback`
- `POST /v1/cv/checkout`
- `GET /v1/partner/commission/preview`
- `POST /v1/hp-wallet/ledger`
- `POST /v1/cron/reconcile-payments`

## Cron

Örnek:

```bash
0 * * * * curl -fsS -X POST https://api.allonahub.com/v1/cron/reconcile-payments -H "x-cron-secret: GERCEK_CRON_SECRET" >/dev/null
```

## Cloudflare Güvenlik

- SSL/TLS: Full Strict
- WAF Managed Rules: açık
- Bot Fight Mode: açık
- Rate limit:
  - `/v1/payments/*`
  - `/v1/cv/checkout`
  - `/v1/orders`
  - `/v1/cron/*`
- Cache: `api.allonahub.com` için bypass
- Minimum TLS: 1.2

## Güncelleme

```bash
cd /opt/allonahub
git pull
docker compose -f deploy/compose/docker-compose.prod.yml up -d --build
docker image prune -f
curl https://api.allonahub.com/health
```
