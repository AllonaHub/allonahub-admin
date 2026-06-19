# AllonaHub

Bu repository artık AllonaHub'un ana geliştirme reposudur. `index.html`, AllonaHub süper uygulama ekosisteminin halka açık ana sayfasıdır.

Yeni mimaride ana sayfanın kaynak kabul edilen tasarımı `index.html` dosyasıdır ve aynı kod `docs/architecture/allonahub-superapp-homepage-canonical.html` altında referans olarak saklanır. Kullanıcı tarafından verilen ana sayfa tasarımı korunur; bakım kolaylığı için stiller `css/allonahub-home.css`, davranış kodları `js/allonahub-home.js` dosyasında tutulur. Yeni özellikler, modül sayfaları, destek sayfaları ve e-ticaret altyapısı bu anasayfa kararına göre geliştirilir.

Platform genelinde ortak footer `js/layout.v3.js` tarafından üretilir ve sayfalarda `data-layout="footer"` alanına basılır. Dil seçimi, tema seçimi, boş link güvenli yönlendirmesi ve gelecekteki internet tabanlı çeviri entegrasyonu `js/platform.js`, `css/platform.css` ve `i18n/` paketleri üzerinden yönetilir.

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
index.html
odeme.html
shop.html
product.html
cart.html
checkout.html
login.html
register.html
forgot-password.html
profile.html
addresses.html
orders.html
favorites.html
hakkimizda.html
iletisim.html
teslimat-kargo.html
iade-politikasi.html
mesafeli-satis.html
mesafeli-satis-sozlesmesi.html
on-bilgilendirme.html
gizlilik.html
kvkk.html
cerez.html
kullanim-sartlari.html
admin/
partner/
css/
js/
i18n/
images/
assets/
docs/
supabase/
```

## Geliştirme İlkeleri

- Ürünler `products` tablosundan okunur ve yalnızca `status = active` ürünler listelenir.
- Kart bilgisi frontend veya Supabase veritabanında tutulmaz; ödeme iyzico CheckoutForm ekranında tamamlanır.
- Checkout öncesinde teslimat, fatura, sipariş özeti, kupon, kargo ve yasal onaylar tamamlanır.
- Güvenlik Supabase RLS, Edge Functions ve minimum yetki prensibiyle ilerler.
- Kurumsal güvenlik yaklaşımı Zero Trust, least privilege, MFA, audit log ve emergency switch prensipleriyle `docs/security/enterprise-security-program.md` altında tanımlanır.
- Service role key ve iyzico secret değerleri frontend'e yazılmaz; Hetzner backend veya Supabase Edge Function secret ortamında tutulur.
- Var olan çalışan özellikler silinmez; değişiklikler geriye dönük uyumluluğu korur.
- `index.html` yeni AllonaHub süper uygulama anasayfa kaynağıdır; destekleyici mimari bu sayfanın marka, modül, premium ve partner ekosistemi mesajlarına göre kurulmalıdır.
- Footer, dil seçici ve tema seçici bütün mevcut ve yeni modüllerde ortak platform davranışı olarak korunur.
- İç linkler 404 üretmemeli; yeni aksiyonlar gerçek sayfaya, ilgili modüle veya arama/destek akışına yönlenmelidir.

Detaylı yön için `docs/architecture/ALLONA_SHOP_ARCHITECTURE.md`, `docs/security/enterprise-security-program.md`, `TASKS.md`, `DATABASE.md`, `API.md`, `DEPLOY.md` ve `STYLE_GUIDE.md` dosyalarını kullan.
