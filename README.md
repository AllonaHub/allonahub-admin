# AllonaHub / Allona Shop

Bu repository artık AllonaHub'un ana geliştirme reposudur. Allona Shop, AllonaHub ekosisteminin halka açık online alışveriş mağazasıdır.

Yeni mimaride ana sayfanın kaynak kabul edilen tasarımı `index.html` dosyasıdır ve aynı kod `docs/architecture/allona-shop-homepage-canonical.html` altında referans olarak saklanır. Ana sayfa kodu kullanıcı tarafından verilen tek dosyalık HTML/CSS yapıdır. Açık talimat gelmedikçe bu kod değiştirilmez; yeni özellikler, destek sayfaları ve e-ticaret altyapısı bu anasayfa kararına göre geliştirilir.

## Teknoloji

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Supabase
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
- Var olan çalışan özellikler silinmez; değişiklikler geriye dönük uyumluluğu korur.
- `index.html` yeni Allona Shop anasayfa kaynağıdır; destekleyici mimari bu sayfanın marka, renk, kategori ve güven mesajlarına göre kurulmalıdır.

Detaylı yön için `docs/architecture/ALLONA_SHOP_ARCHITECTURE.md`, `TASKS.md`, `DATABASE.md`, `API.md`, `DEPLOY.md` ve `STYLE_GUIDE.md` dosyalarını kullan.
