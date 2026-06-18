# AllonaHub / AllonaHub

Bu repository artık AllonaHub'un ana geliştirme reposudur. AllonaHub, AllonaHub ekosisteminin ilk halka açık modülüdür. Bu repo şu an yalnızca profesyonel e-ticaret deneyimine odaklanır; yemek, market, taksi, sağlık ve diğer modüller altyapıda düşünülür ama kullanıcı arayüzünde gösterilmez.

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
supabase/
```

## Geliştirme İlkeleri

- Ürünler `products` tablosundan okunur ve yalnızca `status = active` ürünler listelenir.
- Kart bilgisi frontend veya Supabase veritabanında tutulmaz; ödeme iyzico CheckoutForm ekranında tamamlanır.
- Checkout öncesinde teslimat, fatura, sipariş özeti, kupon, kargo ve yasal onaylar tamamlanır.
- Güvenlik Supabase RLS, Edge Functions ve minimum yetki prensibiyle ilerler.
- Var olan çalışan özellikler silinmez; değişiklikler geriye dönük uyumluluğu korur.

Detaylı yön için `TASKS.md`, `DATABASE.md`, `API.md`, `DEPLOY.md` ve `STYLE_GUIDE.md` dosyalarını kullan.
