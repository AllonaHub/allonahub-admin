# AVM Sponsor Yerleşimi Production Devri

- Kaynak repo commit: `b63c7ddb799696fdcb6f11c6f6590157cd194f68`
- Kaynak handoff commit: `2e5573c208738868cc616ec1da8c4468b381ea44`
- Admin baseline: `c062c140af6c732e2ce9abca987dfeb25edd88d6`
- Migration: `supabase/migrations/20260712020000_add_avm_sponsored_placements.sql`

## Entegrasyon kapsamı

- `partner/index.html` genel partner yönlendirmesi korunur; AVM form hunkları canonical `partner/avm.html` yüzeyine uygulanır.
- `admin/avm.html`, `avm-dunyasi.html`, `css/styles.css`, `js/avm-admin.js`, `js/avm-page.js`, `js/partner.js` sponsor yayın sözleşmesini taşır.
- `scripts/smoke-avm-sponsored.cjs` admin repo canonical partner rotasıyla desktop/mobile ziyaretçi, admin form ve partner talep akışını doğrular.
- Production Supabase schema bu commit ile otomatik değiştirilmez. Migration ayrı production SQL uygulaması/onayı gerektirir; seed, secret veya destructive işlem içermez.

## Canlı kabul

- `https://allonahub.com/avm-dunyasi.html`: aktif sponsor yoksa bölüm gizli; gerçek onaylı yerleşim yalnız geçerli zaman aralığında görünür.
- `https://allonahub.com/admin/avm.html#ad-slots`: eksik görsel/CTA/tarih ile aktif kayıt reddedilir.
- `https://allonahub.com/partner/avm.html#avm-submissions`: reklam talebinde görsel/alt metin ve iki tarih zorunludur.
- Gerçek kayıt smoke'u AVM migration zinciri canlı Supabase'e uygulandıktan sonra admin/partner hesaplarıyla tamamlanmalıdır.
