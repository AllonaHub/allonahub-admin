# AVM Erişilebilir Ziyaret Desteği Entegrasyonu

- Kaynak repo: `AllonaHub/allonahub-site`
- Kaynak commit: `4a74729602d00f740efa430d14abb09a83b8767e`
- Admin baseline: `9e600ddd69bc28e79c56e481e88493da85efd323`
- Aktarılan yüzeyler: `avm-dunyasi.html`, `admin/avm.html`, `css/styles.css`, `js/avm-page.js`, `js/avm-admin.js`
- Migration: `supabase/migrations/20260712018000_add_avm_accessibility_requests.sql`

Kök kaynak dokümanları admin `origin/main` dosya mimarisinde bulunmadığı için yeniden oluşturulmadı. Canlı veri yazımı, migration onaylı production Supabase projesine uygulanana kadar etkin değildir. Migration yeni tablo, indeks, trigger ve RLS policy ekler; veri silmez ve secret içermez.

Canlı smoke hedefleri:

- `https://allonahub.com/avm-dunyasi.html#avm-assistance`
- `https://allonahub.com/admin/avm.html#accessibility-requests`
- Migration sonrasında test talebinin `new`, `confirmed`, `completed`, `archived` akışını doğrula.
- Partner AVM yayın talepleri ekranında ziyaretçi iletişim verisinin görünmediğini doğrula.
