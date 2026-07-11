# AVM Dünyası Admin Repo Entegrasyonu

Bu entegrasyon, mevcut `allonahub-admin` statik sayfalarını ve backend deploy hattını bozmadan AVM Dünyası yüzeyini aynı repoya ekler.

## Korunan Alanlar

- `pages/ecosystem/allonaavm.html` eski URL olarak korunur.
- `pages/partner/index.html`, `js/layout.v3.js` ve `css/styles.v2.css` üzerine yazılmaz.
- Mevcut backend ve admin panel dosyaları silinmez.
- AVM için yeni root sayfaları ve ayrı `css/styles.css` / `js/layout.js` dosyaları kullanılır.
- `partner/index.html`, mevcut `pages/partner/index.html` ile çakışmayan yeni AVM partner panelidir.

## Yeni Yayın Rotaları

- `/avm-dunyasi.html`
- `/avm-detay.html?item=<public-id>`
- `/avm-partner.html`
- `/admin/avm.html`
- `/partner/index.html#avm-submissions`

Eski AVM bağlantısı ve diğer modül rotaları erişilebilir kalır; ana AVM kartları yeni ziyaretçi sayfasına yönlenir.

## Supabase

`supabase/migrations/20260711*.sql` ve `supabase/migrations/20260712*.sql` dosyaları AVM migration zinciridir. Production Supabase projesinde migration geçmişi kontrol edilerek tarih sırasıyla uygulanmalıdır. Zincir `20260712015000_add_avm_transport_routes.sql`, `20260712016000_add_avm_operational_notices.sql` ve `20260712017000_add_avm_favorite_interactions.sql` ile günceldir.

Migration sonrası gerçek merkez, saat, kat planı, bölge, katalog, hizmet, otopark, ulaşım, operasyon duyurusu ve partner kayıtları admin ekranından taslak olarak girilir. Operasyon onayı olmadan kayıtlar `active` yapılmaz. Katalog Kaydet aksiyonu günlük tekil `favorite_save` etkileşimini mevcut admin/partner rapor sözleşmesine ekler.

## Yayın Sırası

1. Admin repo production branch snapshot/backup alır.
2. AVM migration zinciri uygulanır ve tablolar/RPC'ler doğrulanır.
3. `mall-assets` bucket'ı ve gerçek AVM asset'leri hazırlanır.
4. Static frontend deploy'u mevcut Cloudflare/GitHub Pages hattından yapılır.
5. `/avm-dunyasi.html`, `/avm-detay.html`, `/admin/avm.html` ve `/partner/index.html` smoke test edilir.
6. Eski admin, partner ve `pages/ecosystem/allonaavm.html` rotaları ayrıca kontrol edilir.

Bu dosyadaki entegrasyon branch'i, mevcut çalışma ağacındaki kullanıcı değişikliklerini stage etmez veya silmez. Production push öncesi yalnızca AVM entegrasyon dosyaları ayrı commitlenmelidir.
