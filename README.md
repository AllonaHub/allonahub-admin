# AllonaHub

Bu repository artık AllonaHub'un ana geliştirme reposudur. `/index.html`, AllonaHub süper uygulama ekosisteminin halka açık ana sayfasıdır.

Yeni mimaride ana sayfanın kaynak kabul edilen tasarımı `/index.html` dosyasıdır ve aynı kod `docs/architecture/allonahub-superapp-homepage-canonical.html` altında referans olarak saklanır. Kullanıcı tarafından verilen ana sayfa tasarımı korunur; bakım kolaylığı için stiller `/css/allonahub-home.css`, davranış kodları `/js/allonahub-home.js` dosyasında tutulur. Yeni özellikler, modül sayfaları, destek sayfaları ve e-ticaret altyapısı bu anasayfa kararına göre geliştirilir.

Platform genelinde ortak footer `/js/layout.v3.js` tarafından üretilir ve sayfalarda `data-layout="footer"` alanına basılır. Dil seçimi, tema seçimi, boş link güvenli yönlendirmesi ve gelecekteki internet tabanlı çeviri entegrasyonu `/js/platform.js`, `/css/platform.css` ve `/i18n/` paketleri üzerinden yönetilir.

## Teknoloji

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Supabase
- Production API: Hetzner CPX31 üzerinde Docker + Coolify/Traefik ile `api.allonahub.com`
- Auth: Supabase Auth
- Database: PostgreSQL (Supabase)
- Storage: Supabase Storage
- Payment: Bank API + hosted secure payment page
- Maps: Leaflet + OpenStreetMap
- Hosting: GitHub, Cloudflare, özel domain

## Yapı

```text
/index.html
admin/
/css/
/js/
/i18n/
/images/
/images/brand/
/images/modules/
/pages/account/
/pages/career/
/pages/commerce/
/pages/company/
/pages/ecosystem/
/pages/legal/
/pages/partner/
/pages/search/
/pages/wallet/
deploy/
docs/
supabase/
```

Kökte yalnızca yayın için gerekli ana dosyalar tutulur: `index.html`, `favicon.ico`, `_redirects`, Pinterest doğrulama dosyası, README ve temel repo konfigürasyonları. Eski kök URL'ler Cloudflare Pages `_redirects` dosyasıyla yeni klasör yollarına yönlendirilir.

## Geliştirme İlkeleri

- Ürünler `products` tablosundan okunur ve yalnızca `status = active` ürünler listelenir.
- Kart bilgisi frontend veya Supabase veritabanında tutulmaz; ödeme banka ödeme formu ekranında tamamlanır.
- Checkout öncesinde teslimat, fatura, sipariş özeti, kupon, kargo ve yasal onaylar tamamlanır.
- Güvenlik Supabase RLS, Edge Functions ve minimum yetki prensibiyle ilerler.
- Kurumsal güvenlik yaklaşımı Zero Trust, least privilege, MFA, audit log, emergency switch ve auto-defense prensipleriyle `docs/security/enterprise-security-program.md` ve `docs/security/incident-response-auto-defense.md` altında tanımlanır.
- Service role key ve banka ödeme secret değerleri frontend'e yazılmaz; Hetzner backend veya Supabase Edge Function secret ortamında tutulur.
- Var olan çalışan özellikler silinmez; değişiklikler geriye dönük uyumluluğu korur.
- `/index.html` yeni AllonaHub süper uygulama anasayfa kaynağıdır; destekleyici mimari bu sayfanın marka, modül, premium ve partner ekosistemi mesajlarına göre kurulmalıdır.
- Footer, dil seçici ve tema seçici bütün mevcut ve yeni modüllerde ortak platform davranışı olarak korunur.
- İç linkler 404 üretmemeli; yeni aksiyonlar gerçek sayfaya, ilgili modüle veya arama/destek akışına yönlenmelidir.

## Merkezi AI Destek Asistanı

Backend içinde kanal bağımsız assistant servisi hazırlanmıştır:

- `POST /v1/assistant/messages`: webchat, partner panel, admin panel ve ileride WhatsApp/Instagram gibi kanallardan mesaj alır.
- `POST /v1/telegram/webhook`: Telegram webhook güncellemelerini alır, yanıt üretir ve bot token tanımlıysa Telegram'a cevap gönderir.
- `conversation_logs`: kullanıcı ve asistan mesajlarını `channel`, `sender_type`, `metadata` ve `created_at` alanlarıyla saklar.
- `js/assistant-widget.js`: web sitesine gömülebilecek canlı destek widget altyapısıdır.

AI sağlayıcı anahtarı, Telegram bot tokenı ve webhook secret değerleri kesinlikle frontend'e yazılmaz. İkinci aşama üretim modu ücretsiz ve kural tabanlıdır: `ASSISTANT_AI_PROVIDER=rules`, `ASSISTANT_AI_API_KEY=` ve `OPENAI_API_KEY=` boş kalmalıdır. Telegram için `ASSISTANT_TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` ve ilgili rate limit ayarları environment variable olarak tanımlanmalıdır.

## Merkezi e-Dönüşüm ve Fatura Yönetimi

Multi-tenant organization/legal entity/seller/store ayrımı, seller sub-order katmanı, private PDF/XML, provider ve satış kanalı adapter sözleşmeleri, idempotent job/outbox akışı ve RLS temeli `supabase/migrations/20260827120000_create_e_invoicing_center.sql` migration'ında hazırlanmıştır. Mimari ve güvenlik sınırları `docs/architecture/e-invoicing-center.md`; staging, RLS, mock provider ve production açılış kapıları `docs/runbooks/e-invoicing-production-readiness.md` içindedir. Migration veya provider bağlantısı bu repository değişikliğiyle production'a otomatik uygulanmaz.

## Kurumsal E-posta Yönlendirme

`info@allonahub.com`, `legal@allonahub.com`, `destek@allonahub.com`, `iletisim@allonahub.com`, `partner.destek@allonahub.com`, `teknik.destek@allonahub.com` ve `basvuru@allonahub.com` adresleri için Hetzner Postfix forwarding paketi `deploy/hetzner/setup-mail-forwarding.sh` altında tutulur. Gmail'den bu adreslerle cevap göndermek için `deploy/hetzner/setup-mail-submission.sh` authenticated SMTP/DKIM paketini hazırlar. DNS ve canlı sunucu adımları `docs/deploy/hetzner-email-forwarding.md` ve `docs/deploy/hetzner-email-outbound-identities.md` dosyalarındadır.

Detaylı yön için `docs/architecture/ALLONA_SHOP_ARCHITECTURE.md`, `docs/security/enterprise-security-program.md`, `docs/security/incident-response-auto-defense.md`, `docs/reference/TASKS.md`, `docs/reference/DATABASE.md`, `docs/reference/API.md`, `docs/reference/DEPLOY.md` ve `docs/reference/STYLE_GUIDE.md` dosyalarını kullan.

AllonaHub 2030 Country Engine, Türk Dünyası Hub, Partner Passport, B2B, cross-border commerce ve provider sözleşmeleri için `docs/architecture/allonahub-2030-turkic-commerce-corridor.md`; güvenli production sırası için `docs/runbooks/country-engine-production-readiness.md` kaynaktır.
