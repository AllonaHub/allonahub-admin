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
- Payment: iyzico CheckoutForm
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
- Kart bilgisi frontend veya Supabase veritabanında tutulmaz; ödeme iyzico CheckoutForm ekranında tamamlanır.
- Checkout öncesinde teslimat, fatura, sipariş özeti, kupon, kargo ve yasal onaylar tamamlanır.
- Güvenlik Supabase RLS, Edge Functions ve minimum yetki prensibiyle ilerler.
- Kurumsal güvenlik yaklaşımı Zero Trust, least privilege, MFA, audit log, emergency switch ve auto-defense prensipleriyle `docs/security/enterprise-security-program.md` ve `docs/security/incident-response-auto-defense.md` altında tanımlanır.
- Service role key ve iyzico secret değerleri frontend'e yazılmaz; Hetzner backend veya Supabase Edge Function secret ortamında tutulur.
- Var olan çalışan özellikler silinmez; değişiklikler geriye dönük uyumluluğu korur.
- `/index.html` yeni AllonaHub süper uygulama anasayfa kaynağıdır; destekleyici mimari bu sayfanın marka, modül, premium ve partner ekosistemi mesajlarına göre kurulmalıdır.
- Footer, dil seçici ve tema seçici bütün mevcut ve yeni modüllerde ortak platform davranışı olarak korunur.
- İç linkler 404 üretmemeli; yeni aksiyonlar gerçek sayfaya, ilgili modüle veya arama/destek akışına yönlenmelidir.

Detaylı yön için `docs/architecture/ALLONA_SHOP_ARCHITECTURE.md`, `docs/security/enterprise-security-program.md`, `docs/security/incident-response-auto-defense.md`, `docs/reference/TASKS.md`, `docs/reference/DATABASE.md`, `docs/reference/API.md`, `docs/reference/DEPLOY.md` ve `docs/reference/STYLE_GUIDE.md` dosyalarını kullan.
