# ETBIS ve Guven Damgasi Basvuru Runbook

Son guncelleme: 29.06.2026

Bu runbook, AllonaHub icin ETBIS kaydi ve Guven Damgasi basvurusu oncesi sirali operasyon adimlarini toplar. Teknik repo hazirliklari ayri commit ile yayina alinacak; kurumsal satin alma, resmi belge ve basvuru adimlari yetkili sirket temsilcisi tarafindan tamamlanmalidir.

## 1. EV SSL satin alma

Amac: `allonahub.com` icin tarayicida gorunen sertifikanin EV SSL olmasi ve Guven Damgasi basvuru tarihinden itibaren en az 13 ay gecerlilik beklentisini karsilamasi.

Zamanlama: ETBIS kaydi onaylandiktan sonra, Guven Damgasi basvurusu fazinda baslatilacak.

Baslatilacak isler:

- EV SSL veren CA/bayi sec: DigiCert, Sectigo veya Turkiye'de kurumsal EV dogrulama saglayan yetkili bayi.
- Sertifika kapsami: `allonahub.com` ve gerekiyorsa `www.allonahub.com`.
- Sirket dogrulama evraklari: ticaret sicil gazetesi, vergi levhasi, imza sirkuleri, yetkili kisi bilgileri, telefon/adres dogrulama.
- Cloudflare modeli: EV sertifika edge'de gorunecekse Cloudflare Custom SSL/Advanced Certificate Manager uygunlugu kontrol edilmeli; aksi halde tarayicida Cloudflare/Let's Encrypt gorunmeye devam eder.
- Kurulum sonrasi kontrol komutu:

```bash
openssl s_client -servername allonahub.com -connect allonahub.com:443 </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -dates -serial -fingerprint -sha256
```

Kabul kriteri:

- Issuer EV SSL saglayicisi olmalı.
- Subject/organization sirket unvaniyla uyumlu olmalı.
- Gecerlilik basvuru tarihinde en az 13 ay sartini karsilamali.

## 2. TSE A/B sinifi sizma testi

Amac: Guven Damgasi basvurusundan en fazla 3 ay once alinmis, TSE tarafindan yetkilendirilmis A veya B sinifi sizma testi firmasina ait test ve kapanis/dogrulama raporunu hazirlamak.

Zamanlama: ETBIS onayi ve EV SSL kurulumu sonrasinda, Guven Damgasi basvurusundan en fazla 3 ay once baslatilacak.

Teklif kapsaminda istenecek yuzeyler:

- `https://allonahub.com`
- `https://api.allonahub.com`
- Admin panel ve partner paneli
- Uye kayit/giris, sepet, odeme, siparis, kupon ve bildirim akisleri
- Urun yukleme, seller/compliance alanlari, dosya yukleme varsa dosya yuzeyi
- Supabase RLS/policy, public anon key kullanim yuzeyi, storage bucket izinleri
- Cloudflare WAF, rate limit, header ve redirect kurallari

Firmadan istenecek ciktılar:

- TSE A/B sinifi yetki sinifini gosteren guncel belge veya resmi liste referansi
- Test plani ve kapsam onayi
- Bulgu raporu
- Kapanis/dogrulama testi raporu
- Guven Damgasi basvurusunda kullanilabilecek imzali/kaseli rapor veya dogrulanabilir PDF

Kabul kriteri:

- Kritik/yuksek bulgu kalmamali.
- Orta bulgular icin risk kabul veya duzeltme plani yazili olmali.
- Rapor tarihi basvuru tarihinden geriye en fazla 3 ay icinde olmali.

## 3. KEP ve ticaret sicil dogrulamasi

Durum: KEP adresi ve ticaret sicil numarasi sirket tarafindan iletildi ve yasal metinlere eklendi.

- KEP adresi: `allworksinbusiness@hs01.kep.tr`
- Ticaret sicil numarasi: `376656-5`
- Ticaret sicil mudurlugu: resmi kayittan ayrica teyit edilirse eklenecek.

Dogrulama kaynaklari:

- MERSIS / sirket yetkili paneli
- Ticaret Sicili Gazetesi
- ITO veya ilgili ticaret odasi firma kaydi
- Sirket KEP hizmet saglayici paneli

Guncellenen sayfalar:

- `legal/index.html`
- `pages/legal/on-bilgilendirme.html`
- `pages/legal/mesafeli-satis.html`
- `pages/legal/iade-politikasi.html`
- `pages/legal/kvkk.html`
- `pages/legal/gizlilik.html`
- `pages/legal/kullanim-sartlari.html`
- `pages/legal/etbis-guven-damgasi.html`

## 4. Canli teknik uygulama sirasi

1. Cloudflare rule scripti 29.06.2026 tarihinde uygulandi; yeni degisiklik gerekirse script tekrar calistirilabilir.
2. Supabase migration'i canli DB'ye uygula.
3. Yeni admin urun onay ekranini deploy et.
4. Header ve redirect canli kontrollerini tekrar calistir.
5. ETBIS kaydi tamamlaninca yasal sayfadaki resmi dogrulama bilgisini guncelle.
6. Guven Damgasi fazinda EV SSL kurulumu tamamlaninca sertifika komutuyla sonucu kaydet.
7. Guven Damgasi fazinda sızma testi tamamlaninca bulgulari issue/checklist olarak takip et.

## Resmi kaynaklar

- Guven Damgasi: https://www.guvendamgasi.org.tr
- Guven Damgasi basvuru sureci: https://www.guvendamgasi.org.tr/view/menu/goster.php?Guid=f3dd28cf-88cc-11e8-99c0-7bf55dee941b
- Guven Damgasi SSS: https://www.guvendamgasi.org.tr/view/sss/sssFull.php
- ETBIS: https://www.eticaret.gov.tr
