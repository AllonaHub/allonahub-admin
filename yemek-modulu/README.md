# Yemek Modülü

Bu klasör yemek modülünün uygulama reposuna taşınabilir teknik temelini içerir. Mevcut çalışma alanında çalışan frontend/backend uygulaması bulunmadığı için burada Supabase şeması, partner ürün akışı, satışa hazır demo katalog, görsel denetim notları, kurye entegrasyonu hazırlığı ve saf JavaScript sözleşme testleri eklendi.

## Dosya Haritası

| Yol | Açıklama |
| --- | --- |
| `KURULUM.md` | Supabase ve lokal doğrulama adımları |
| `supabase/migrations/20260627000100_yemek_modulu.sql` | Tablo, RLS, storage, audit ve kurye handoff şeması |
| `supabase/seed/20260627000100_yemek_modulu_seed.sql` | Demo partner, kategori, aktif ürün ve kurulum verisi |
| `assets/data/sale-ready-products.json` | Satışa hazır örnek ürün katalog verisi |
| `assets/img/*.png` | Ürün adıyla uyumlu katalog görselleri |
| `src/food-module-contract.mjs` | Buton aksiyonları, ürün validasyonu, görsel eşleşme ve kurye payload sözleşmesi |
| `src/food-supabase-repository.mjs` | Supabase client ile kullanılacak repository fonksiyonları |
| `src/supabase-health-check.mjs` | Supabase bağlantısı ve `food_products` erişim kontrolü |
| `tests/food-module-contract.test.mjs` | Saf sözleşme testleri |
| `docs/GORSEL-DENETIM.md` | Görsel üretim ve uyumluluk raporu |
| `docs/MOBIL-GORUNUM.md` | Yemek modülü frontend'i eklendiğinde merkezi mobil çekirdek kullanım standardı |

## Hızlı Kontrol

```bash
node --test yemek-modulu/tests/food-module-contract.test.mjs
```

Supabase canlı kontrolü için:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="ANON_KEY" \
node yemek-modulu/src/supabase-health-check.mjs
```

## Modül Ayrışma Kuralı

- Tablo adları `food_` ile başlar.
- Event adları `food.` prefix'i kullanır.
- Görsel bucket adı `food-product-images`.
- Kurye modülüne doğrudan bağımlılık yoktur; bağlantı `food_delivery_handoffs` ve `food-courier-handoff.v1` payload üzerinden kurulur.
- Frontend eklendiğinde mobil görünüm `../shared/mobile/mobile-core.css` ve `../shared/mobile/mobile-core.js` üzerinden tek merkezden yönetilir.
