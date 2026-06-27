# ETBIS ve Guven Damgasi Sorumlusu

Son kontrol: 28.06.2026

Bu dosya AllonaHub icin ETBIS kaydi ve Guven Damgasi basvurusu oncesi hazirlik, eksik, engel ve takip maddelerini toplar. Canli site denetimi `https://allonahub.com`, API denetimi `https://api.allonahub.com`, resmi Guven Damgasi kaynagi `https://www.guvendamgasi.org.tr` ve ETBIS portali `https://www.eticaret.gov.tr` uzerinden yapildi.

## Resmi basvuru dayanaklari

- Guven Damgasi saglayicisi TOBB'dur ve basvuru `www.guvendamgasi.org.tr` uzerinden yapilir.
- TOBB basvuru sureci; basvuru formu, belge yukleme, guvenlik testi, basvuru ucreti ve islak imzali/kaseli belgelerin TOBB'a iletilmesini ister.
- Guvenlik testi basvurudan en fazla 3 ay once yaptirilmis olmali; test TSE tarafindan yetkilendirilen A veya B sinifi sizma testi firmasi tarafindan yapilmalidir.
- EV SSL belgesi basvuru evraklari arasindadir. TOBB SSS'ye gore EV SSL sertifika suresi basvuru tarihinden itibaren en az 13 ay olmalidir.
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

## Basvuruya engel kalan dis bagimliliklar

1. EV SSL yok.
   - Canli `allonahub.com` sertifikasi Let's Encrypt, CN=`allonahub.com`, gecerlilik 29.05.2026 - 27.08.2026.
   - Bu sertifika EV SSL degil ve TOBB'un 13 ay EV SSL beklentisini karsilamiyor.
   - Aksiyon: Basvuru oncesi EV SSL satin alinmali ve Cloudflare/origin kurulum modeli netlestirilmeli.

2. TSE onayli sizma testi henuz yok.
   - Basvurudan en fazla 3 ay once yaptirilmis TSE A/B sinifi firma testi ve dogrulama testi gerekli.
   - Kapsam: ana web, API, Supabase/RLS yuzeyi, odeme akisi, admin/partner panelleri, dosya yukleme, WAF ve rate-limit.

3. KEP ve ticaret sicil numarasi dogrulanmali.
   - Iletisim sayfasinda unvan, adres, MERSIS, vergi dairesi/no ve telefon var.
   - KEP adresi ve ticaret sicil numarasi resmi kayittan dogrulanmadan tahmini deger girilmedi.

4. ETBIS kaydi ve TOBB basvurusu resmi olarak tamamlanmali.
   - Repo tarafinda bilgi alani hazir.
   - Kayit/tahsis tamamlandiginda resmi dogrulama linki ve TOBB tarafindan verilen kullanim kodu eklenmeli.

5. Canli edge/WAF davranisi tekrar kontrol edilmeli.
   - `checkout.html` canlida Cloudflare challenge'a dusebiliyordu; repo tarafinda guvenli odeme sayfasina yonlendirme mevcut.
   - Deploy sonrasi path bazli WAF/redirect sirasi canlida test edilmeli.

## Basvuru oncesi operasyonel kontrol listesi

- EV SSL sertifikasini satin al ve en az 13 ay sartini belgeyle dogrula.
- TSE yetkili A/B sinifi sizma testi firmasi sec; testi basvuru tarihinden en fazla 3 ay once yaptir.
- Vergi levhasi, imza sirkuleri, adli sicil belgeleri, yetkili beyanlari ve basvuru dekontunu hazirla.
- ETBIS kaydini tamamla; kayit bilgisi geldikten sonra `pages/legal/etbis-guven-damgasi.html` ve footer dogrulama linklerini guncelle.
- Partner urunlerinde public satici alanlarini veri giris formuna zorunlu/opsiyonlu olarak ekle: ticari unvan, sehir, destek iletisim, vergi no maskesi, fatura sorumlulugu.
- Yasakli/sarta bagli urun listesi ve kategori bazli admin onay kontrolunu partner urun yukleme akisina ekle.
- Cerez riza paneli, analitik/pazarlama ayrimi ve IYS onay-ret surecini canli akis uzerinde ayri kontrol et.

## Kaynaklar

- TOBB Guven Damgasi: https://www.guvendamgasi.org.tr
- Guven Damgasi basvuru sureci: https://www.guvendamgasi.org.tr/view/menu/goster.php?Guid=f3dd28cf-88cc-11e8-99c0-7bf55dee941b
- Guven Damgasi SSS: https://www.guvendamgasi.org.tr/view/sss/sssFull.php
- Ticaret Bakanligi / ETBIS: https://www.eticaret.gov.tr
- E-Ticaret Kanunu: http://www.resmigazete.gov.tr/eskiler/2014/11/20141105-1.htm
