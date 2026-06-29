# ETBIS ve Guven Damgasi Sorumlusu

Son kontrol: 29.06.2026

Bu dosya AllonaHub icin ETBIS kaydi ve Guven Damgasi basvurusu oncesi hazirlik, eksik, engel ve takip maddelerini toplar. Canli site denetimi `https://allonahub.com`, API denetimi `https://api.allonahub.com`, resmi Guven Damgasi kaynagi `https://www.guvendamgasi.org.tr` ve ETBIS portali `https://www.eticaret.gov.tr` uzerinden yapildi.

## Resmi basvuru dayanaklari

- Guven Damgasi saglayicisi TOBB'dur ve basvuru `www.guvendamgasi.org.tr` uzerinden yapilir.
- TOBB basvuru sureci; basvuru formu, belge yukleme, guvenlik testi, basvuru ucreti ve islak imzali/kaseli belgelerin TOBB'a iletilmesini ister.
- Guven Damgasi basvurusu icin guvenlik testi basvurudan en fazla 3 ay once yaptirilmis olmali; test TSE tarafindan yetkilendirilen A veya B sinifi sizma testi firmasi tarafindan yapilmalidir.
- Guven Damgasi basvurusu icin EV SSL belgesi basvuru evraklari arasindadir. TOBB SSS'ye gore EV SSL sertifika suresi basvuru tarihinden itibaren en az 13 ay olmalidir.
- Guven Damgasi 1 yil gecerlidir; tahsis sonrasi sikayet uzerine her zaman ve her takvim yilinda en az bir defa denetim yapilabilir.

## Bu turda tamamlanan repo/site hazirliklari

1. Eski yasal metinlerin geri basma riski azaltildi.
   - `pages/legal/mesafeli-satis.html`, `on-bilgilendirme.html`, `iade-politikasi.html`, `kvkk.html`, `gizlilik.html`, `cerez-politikasi.html` guncellendi.
   - `pages/legal/cerez.html` eski metin yerine guncel cerez politikasina yonlendirme sayfasi oldu.
   - `legal/index.html` eski "taslak/nihai gorus degil" ifadelerinden temizlenerek guncel yasal merkeze donusturuldu.

2. ETBIS ve Guven Damgasi durumu icin seffaf bilgilendirme sayfasi eklendi.
   - `pages/legal/etbis-guven-damgasi.html` yayina hazirlandi.
   - Guven Damgasi tahsis edilmeden rozet/logo veya tahsis izlenimi kullanilmamasi ozellikle belirtildi.
   - Footer, iletisim sayfasi, sitemap ve kisa URL yonlendirmeleri bu sayfaya baglandi.

3. Urun, sepet ve odeme akisi satıcı bilgilendirmesi icin genisletildi.
   - `js/core.js` urun verisinde `seller_public_name`, `seller_kind`, `seller_legal_name`, `seller_city`, `seller_contact`, `seller_tax_number_masked`, `invoice_responsibility` ve `seller_disclosure` alanlarini tasir hale geldi.
   - Urun kartlari ve urun detayinda satici tipi/ad bilgisi gorunur oldu.
   - Sepet ve odeme ozetinde satici, yasal metinler ve fatura/teslimat bilgilendirmesi gorunur hale geldi.
   - Odeme formuna ayri "satici, teslimat, fatura ve iade/cayma bilgilendirmesini kontrol ettim" onayi eklendi.

4. Guvenlik basliklari icin statik hosting hazirligi yapildi.
   - `_headers` dosyasina HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy ve Permissions-Policy eklendi.
   - Deploy sonrasi hosting/edge tarafinda bu basliklarin canli yanita yansidigi tekrar dogrulanmali.

5. Sitemap ve eski URL girisleri guncellendi.
   - `sitemap.xml` yeni yasal sayfa ve 28.06.2026 lastmod tarihleriyle guncellendi.
   - `_redirects` ve `js/core.js` legacy route haritasina `etbis.html`, `etbis-guven-damgasi.html`, `guven-damgasi.html` eklendi.

6. 29.06.2026 canli kontrol sonrasi kisa URL ve partner urun veri eksikleri kapatilmaya baslandi.
   - Canlida `https://allonahub.com/pages/legal/etbis-guven-damgasi.html` ve odeme onaylari gorunur durumda.
   - Canlida `/etbis.html` 404 dondugu icin root seviyesinde `etbis.html`, `guven-damgasi.html` ve `etbis-guven-damgasi.html` fiziksel yonlendirme sayfalari eklendi.
   - Canlida `/checkout.html` Cloudflare challenge'a dustugu icin root seviyesinde `checkout.html` fiziksel yonlendirme sayfasi eklendi; WAF kurali yine ayrica kontrol edilmeli.
   - Partner urun formuna kamuya acik satici/fatura bilgilendirme alanlari eklendi.
   - `products` tablosu icin satici bilgilendirme ve compliance review alanlarini ekleyen migration hazirlandi.
   - Partner urunleri varsayilan olarak admin onayina gidecek sekilde `draft/pending` akisa alindi.
   - Alkol, tutun, silah, ilac, kumar, yetiskin icerik ve canli hayvan gibi riskli ifadeler icin ilk client-side urun yukleme bariyeri eklendi.
   - Admin Operasyon Paneline `Ürün Onayı` gorunumu eklendi; admin urunu yayina alabilir, revizyon isteyebilir veya reddedebilir.
   - Cloudflare header/redirect kurallari icin `deploy/cloudflare/apply-allonahub-rules.mjs` ve runbook eklendi.
   - Supabase migration uygulamasi icin `deploy/hetzner/apply-supabase-migration.sh` eklendi.
   - Eski `iptal-iade.html` ve Turkce karakterli `kullanım-sartları.html` sayfalari kanonik guncel yasal metinlere yonlendirme sayfasina cevrildi.
   - `page.sl/pages/legal/mesafeli-satis-sozlesmesi.html` altindaki eski yasal kopya kaldirildi.
   - EV SSL, TSE A/B sinifi sizma testi, KEP/ticaret sicil dogrulamasi ve canli uygulama sirasi icin `docs/runbooks/etbis-guven-damgasi-basvuru-runbook.md` eklendi.
   - KEP adresi `allworksinbusiness@hs01.kep.tr` ve ticaret sicil no `376656-5` yasal merkez ve ana yasal metinlere eklendi.
   - Cloudflare token, zone id ve Supabase DB URL alma/terminalden calistirma adimlari icin `docs/runbooks/live-access-env-setup.md` eklendi.
   - 29.06.2026 tarihinde Cloudflare header/redirect kurallari canlida uygulandi.
   - Canli kontrolde `allonahub.com` ve `www.allonahub.com` yanitlarinda HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy ve Permissions-Policy goruldu.
   - Canli kontrolde `/checkout.html` Cloudflare challenge'a dusmeden `/pages/commerce/guvenli-odeme.html` adresine 301 yonleniyor.

## Kalan dis bagimliliklar ve faz ayrimi

1. Guven Damgasi fazi icin EV SSL yok.
   - Kaynak: `openssl s_client -servername allonahub.com -connect allonahub.com:443 | openssl x509 -noout -issuer -subject -dates` komutu.
   - Canli `allonahub.com` sertifikasi Let's Encrypt, issuer CN=`YE2`, subject CN=`allonahub.com`, gecerlilik 29.05.2026 - 27.08.2026.
   - Bu sertifika EV SSL degil ve TOBB'un 13 ay EV SSL beklentisini karsilamiyor.
   - Aksiyon: ETBIS kaydi tamamlandiktan sonra Guven Damgasi basvurusu oncesi EV SSL satin alinmali ve Cloudflare/origin kurulum modeli netlestirilmeli.

2. Guven Damgasi fazi icin TSE onayli sizma testi henuz yok.
   - Basvurudan en fazla 3 ay once yaptirilmis TSE A/B sinifi firma testi ve dogrulama testi gerekli.
   - Kapsam: ana web, API, Supabase/RLS yuzeyi, odeme akisi, admin/partner panelleri, dosya yukleme, WAF ve rate-limit.
   - Aksiyon: ETBIS onayi sonrasi EV SSL tamamlaninca TSE A/B sinifi sizma testi sureci baslatilacak.

3. KEP ve ticaret sicil numarasi eklendi.
   - KEP: `allworksinbusiness@hs01.kep.tr`
   - Ticaret sicil no: `376656-5`
   - Yasal merkez, on bilgilendirme, mesafeli satis, iade, KVKK, gizlilik, kullanim sartlari ve ETBIS/Güven Damgasi sayfalarina islendi.

4. ETBIS kaydi resmi olarak tamamlanmali.
   - Repo tarafinda bilgi alani hazir.
   - Kayit tamamlandiginda resmi dogrulama linki ve ETBIS bilgisi yasal sayfalara eklenmeli.

5. Canli edge/header davranisi duzeltildi.
   - `checkout.html` artik Cloudflare challenge'a dusmeden guvenli odeme sayfasina 301 yonleniyor.
   - Ana domain ve `www` yanitlarinda guvenlik basliklari canlida goruluyor.
   - Cloudflare API token gecici olarak kullanildi; islem tamamlandigi icin token Cloudflare panelinden revoke edilmelidir.

6. Supabase canli migration henuz uygulanmadi.
   - `products` tablosu icin seller/compliance alanlarini ekleyen migration hazir.
   - Canli DB icin `SUPABASE_DB_URL`, `DATABASE_URL` veya `POSTGRES_URL` ve `psql`/SQL Editor uygulamasi gerekiyor.

## Basvuru oncesi operasyonel kontrol listesi

- EV SSL sertifikasini ETBIS onayi sonrasi Guven Damgasi fazinda satin al ve en az 13 ay sartini belgeyle dogrula.
- TSE yetkili A/B sinifi sizma testi firmasini EV SSL sonrasi Guven Damgasi fazinda sec; testi basvuru tarihinden en fazla 3 ay once yaptir.
- Vergi levhasi, imza sirkuleri, adli sicil belgeleri, yetkili beyanlari ve basvuru dekontunu hazirla.
- ETBIS kaydini tamamla; kayit bilgisi geldikten sonra `pages/legal/etbis-guven-damgasi.html` ve footer dogrulama linklerini guncelle.
- Partner urunlerinde public satici alanlarini veri giris formuna gir; ticari unvan, sehir, destek iletisim, vergi no maskesi ve fatura sorumlulugu admin onay ekraninda kontrol edilebilir.
- Yasakli/sarta bagli urun listesi ve kategori bazli admin onay kontrolunu canlida test et; ilk kelime bariyeri ve admin inceleme/ret/onay akisi repo tarafinda hazir.
- Cloudflare token'i revoke et; header ve `/checkout.html` redirect davranisi canlida uygulandi.
- Cerez riza paneli, analitik/pazarlama ayrimi ve IYS onay-ret surecini canli akis uzerinde ayri kontrol et.

## Kaynaklar

- TOBB Guven Damgasi: https://www.guvendamgasi.org.tr
- Guven Damgasi basvuru sureci: https://www.guvendamgasi.org.tr/view/menu/goster.php?Guid=f3dd28cf-88cc-11e8-99c0-7bf55dee941b
- Guven Damgasi SSS: https://www.guvendamgasi.org.tr/view/sss/sssFull.php
- Ticaret Bakanligi / ETBIS: https://www.eticaret.gov.tr
- E-Ticaret Kanunu: http://www.resmigazete.gov.tr/eskiler/2014/11/20141105-1.htm
