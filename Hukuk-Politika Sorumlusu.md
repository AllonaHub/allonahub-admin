# Hukuk-Politika Sorumlusu

Bu doküman 27 Haziran 2026 itibarıyla ALLONAHUB proje yönetimi kapsamında hukuk, resmi politika, yasal metin, footer içerikleri ve ticari uygunluk denetiminden sorumlu rolün görev alanını tanımlar.

Not: Bu rol hukuki riskleri erken tespit eder, resmi kaynak araştırması yapar, rapor ve düzeltme önerisi hazırlar. Nihai hukuki görüş, sözleşme onayı ve mevzuata kesin uyumluluk kararı gerektiğinde avukat, mali müşavir veya ilgili uzman tarafından doğrulanmalıdır.

## Amaç

- ALLONAHUB sitesinin ve modüllerinin hukuki, ticari ve resmi politika açısından güvenli şekilde ilerlemesini sağlamak.
- Footer, yasal sayfalar, kullanıcı metinleri, formlar, izinler, sözleşmeler ve ticari beyanları düzenli denetlemek.
- KVKK, tüketici hukuku, e-ticaret, ticari iletişim, reklam, ödeme, içerik sorumluluğu ve uluslararası açılım risklerini erken tespit etmek.
- Kritik veya sakıncalı durumları proje sahibine hızlıca bildirmek ve uygulanabilir düzeltme önerileri sunmak.
- Türkiye odaklı mevcut uyumluluğu korurken ileride global pazarlara açılmaya uygun politika altyapısı kurmak.

## Kapsam

- Web sitesi footer alanındaki tüm bağlantılar, metinler ve yasal yönlendirmeler
- Gizlilik politikası, KVKK aydınlatma metni, çerez politikası, kullanım şartları ve açık rıza metinleri
- Üyelik, teklif, iletişim, destek, partner, admin, kullanıcı ve bot akışlarında gösterilen hukuki metinler
- Mesafeli satış, iade, iptal, teslimat, ödeme, fatura ve ticari koşullar
- Partner, mağaza, AVM, taksi, denizcilik, sosyal medya ve ileride eklenecek modüllerin özel hukuki riskleri
- Reklam, kampanya, kupon, yorum, puanlama, içerik yayını ve sosyal medya paylaşımları
- Bakanlık, resmi kurum, sektör regülasyonu ve global açılım gereksinimleri
- Kullanıcı verisi, kişisel veri, hassas veri, konum verisi, iletişim izni ve saklama politikaları

## Temel İlkeler

- Hukuki metinler görünür, erişilebilir, anlaşılır ve güncel olmalıdır.
- Kullanıcıdan alınan her veri için amaç, kapsam, saklama süresi ve hukuki dayanak net olmalıdır.
- Açık rıza, ticari ileti izinleri ve zorunlu bilgilendirme metinleri birbirine karıştırılmamalıdır.
- Sitede yanıltıcı, abartılı, belirsiz veya resmi onay varmış izlenimi veren ifadeler kullanılmamalıdır.
- Ödeme, iade, iptal, kupon, kampanya ve hizmet koşulları kullanıcı açısından açık olmalıdır.
- Footer bağlantıları boş, kırık, eksik, kopya, eski veya yayına uygun olmayan taslak içerik göstermemelidir.
- Uluslararası açılım hedefi olan alanlarda KVKK yanında GDPR, çerez rızası, veri aktarımı ve yerel tüketici kuralları için hazırlık yapılmalıdır.

## Mevcut Repo Bulgusu

| Alan | Durum | Not |
| --- | --- | --- |
| Hukuk-politika dokümanı | Bu dosya ile oluşturuldu | Önceki durumda ayrı hukuk-politika sorumlusu dosyası yoktu. |
| Footer gereksinimi | Var | Anasayfa ve Hizmetler dokümanında footer alanı yasal ve ek bağlantılar için tanımlanmış. |
| KVKK ihtiyacı | Var | User Panel, Partner Panel, Bot ve Taksi dokümanlarında KVKK/izin/saklama ihtiyacı geçiyor. |
| Sözleşme ihtiyacı | Var | Partner Panel dokümanında partner kabul metinleri ve içerik sorumluluğu eksik olarak işaretlenmiş. |
| Güvenlik dayanağı | Var | Genel Güvenlik dokümanı kişisel veri, log, erişim ve olay müdahalesi kontrollerini tanımlıyor. |
| Çalışan ana site kodu | Sınırlı | Klasörde modül kodları var; ana site footer ve yasal sayfa kodu bu incelemede net görünmüyor. |

## Kritik Bildirim Kuralı

Aşağıdaki durumlardan biri görülürse proje sahibine "Kritik Hukuki Risk" olarak hemen bildirilmelidir:

| Risk | Neden Kritik | İlk Aksiyon |
| --- | --- | --- |
| KVKK/gizlilik metni olmadan kişisel veri toplama | Veri işleme dayanağı ve bilgilendirme eksik kalır | Form yayını durdurulmalı veya metin/izin akışı eklenmeli |
| Açık rıza ile zorunlu kullanım şartlarının karıştırılması | Rızanın geçerliliği tartışmalı hale gelir | Zorunlu bilgilendirme ve isteğe bağlı rıza ayrılmalı |
| Ticari ileti izni olmadan pazarlama mesajı | İYS ve ticari ileti riski doğar | Pazarlama izni ayrı onayla alınmalı |
| İade/iptal/mesafeli satış koşulu belirsizliği | Tüketici uyuşmazlığı riski artar | Satış akışı netleşmeden yasal metin hazırlanmalı |
| Yanıltıcı kampanya, kupon veya fiyat beyanı | Reklam ve tüketici hukuku riski oluşur | Kampanya koşulları açık, tarihli ve sınırlı yazılmalı |
| Partnerin hukuki sorumluluğu tanımsız | Üçüncü taraf içeriklerinden platform sorumlu tutulabilir | Partner sözleşmesi ve içerik onay akışı hazırlanmalı |
| Çerez banner/politikası olmadan takip çerezi kullanımı | Rıza ve bilgilendirme eksik kalır | Çerez envanteri çıkarılıp rıza yönetimi eklenmeli |
| Konum verisi veya hassas veri gereksiz saklanması | Yüksek kişisel veri riski doğar | Veri minimizasyonu ve saklama süresi uygulanmalı |
| Resmi kurum, bakanlık veya yetki izlenimi veren yanlış ifade | Güven ve idari yaptırım riski doğar | Metin derhal revize edilmeli |
| Kırık veya boş yasal footer linkleri | Yayın güveni ve uyumluluk zayıflar | Linkler yayın öncesi tamamlanmalı veya kaldırılmalı |

## Footer Denetim Listesi

Footer alanındaki tüm içerikler düzenli olarak tek tek açılıp okunmalıdır.

| Footer İçeriği | Beklenen Durum | Risk Kontrolü |
| --- | --- | --- |
| Gizlilik Politikası | Kişisel veri işleme amaçları, kapsamı ve iletişim bilgisi açık olmalı | Eksik veya kopya metin olmamalı |
| KVKK Aydınlatma Metni | Veri sorumlusu, amaç, yöntem, hukuki sebep, haklar ve başvuru kanalı yazılmalı | Genel gizlilik metniyle karıştırılmamalı |
| Çerez Politikası | Zorunlu, analitik, reklam ve üçüncü taraf çerezler ayrılmalı | Rıza gerektiren çerezler izinsiz çalışmamalı |
| Kullanım Şartları | Site kullanımı, hesap, yasaklı davranış, sorumluluk ve uyuşmazlık maddeleri yer almalı | Tek taraflı ve belirsiz hükümler azaltılmalı |
| Üyelik Sözleşmesi | Kullanıcı hesabı, doğrulama, güvenlik, askıya alma ve fesih kuralları yazılmalı | Kullanıcının temel haklarını belirsiz bırakmamalı |
| Mesafeli Satış Sözleşmesi | Satış varsa ürün/hizmet, ödeme, teslim, cayma, iade ve taraf bilgileri bulunmalı | Satış yoksa yanlış vaat olarak footerda durmamalı |
| İade ve İptal Politikası | Süre, koşul, istisna, ücret iadesi ve başvuru kanalı net olmalı | Hizmet türüne göre istisnalar belirtilmeli |
| Teslimat/Hizmet Süreci | Fiziksel veya dijital teslim şekli açıklanmalı | Gerçek süreçle uyumsuz olmamalı |
| Ticari İletişim İzni | Pazarlama izni ayrı ve isteğe bağlı alınmalı | KVKK onayıyla birleştirilmemeli |
| İletişim | Şirket unvanı, adres, e-posta, telefon ve destek kanalı güncel olmalı | Sahte, eksik veya kişisel iletişimle sınırlı kalmamalı |
| Şirket Bilgileri | Ticaret unvanı, MERSIS/vergi bilgisi gerekiyorsa yer almalı | Şirketleşme durumu ile uyumsuz beyan yapılmamalı |
| Partner Başvuru Koşulları | Partner sorumlulukları, onay süreci ve içerik kuralları yazılmalı | Partnerin yayınladığı içerik sahipsiz bırakılmamalı |
| Sosyal Medya Linkleri | Doğru resmi hesaplara gitmeli | Yanlış veya sahte hesap riski olmamalı |

## Modül Bazlı Hukuki Riskler

| Modül/Alan | Kontrol Edilecek Konu | Öncelik |
| --- | --- | --- |
| User Panel | Kayıt, profil, hesap silme, veri indirme, izinler ve KVKK akışı | Kritik |
| Partner Panel | Partner sözleşmesi, içerik sorumluluğu, veri işleme, yetki ve onay akışı | Kritik |
| Admin Panel | Yetki, audit log, kişisel veri görüntüleme ve veri dışa aktarma kuralları | Kritik |
| Bot | Otomatik cevap sınırları, kişisel veri alma, insan devri ve yanlış yönlendirme riski | Yüksek |
| Taksi Modülü | Konum verisi, sürücü/yolcu bilgisi, şikayet, güvenlik ve saklama süresi | Kritik |
| AVM Dünyası | Mağaza bilgileri, kampanya, kupon, yorum, çalışma saati ve reklam beyanları | Yüksek |
| Denizcilik Modülü | Teklif, operasyon bilgisi, ticari şart, sorumluluk sınırı ve belge yönetimi | Yüksek |
| Sosyal Medya | Marka hesabı, kullanıcı yorumu, içerik izni, reklam ve kampanya kuralları | Yüksek |
| Güvenlik | Veri ihlali, erişim, loglama ve resmi bildirim süreci | Kritik |

## Araştırılacak Resmi Kaynak Alanları

Hukuk-politika sorumlusu mevzuat kontrolünde mümkün olduğunca resmi ve birincil kaynakları esas almalıdır.

| Alan | Kontrol Edilecek Kaynak Türü |
| --- | --- |
| KVKK ve kişisel veri | KVKK Kurumu kararları, rehberleri ve ilgili kanun/metinler |
| Tüketici ve mesafeli satış | Ticaret Bakanlığı düzenlemeleri, tüketici mevzuatı ve mesafeli sözleşme kuralları |
| E-ticaret ve pazaryeri | Ticaret Bakanlığı, ETBIS, e-ticaret hizmet sağlayıcı düzenlemeleri |
| Ticari elektronik ileti | İYS, ticari ileti izinleri ve ilgili yönetmelikler |
| Reklam ve kampanya | Reklam Kurulu kararları, haksız ticari uygulama ve fiyat/kampanya kuralları |
| Mali ve fatura süreçleri | Gelir İdaresi Başkanlığı, e-fatura/e-arşiv ve vergi düzenlemeleri |
| Sektörel izinler | Ulaştırma, turizm, belediye, denizcilik veya ilgili bakanlık düzenlemeleri |
| Global açılım | GDPR, ePrivacy, tüketici hakları, platform kuralları ve ülke bazlı yerel yükümlülükler |

## Gerekli Yasal ve Politik Sayfalar

| Sayfa/Metin | Durum | Not |
| --- | --- | --- |
| Gizlilik Politikası | Hazırlanmalı | Site ve tüm modüllerle uyumlu olmalı |
| KVKK Aydınlatma Metni | Hazırlanmalı | Form ve üyelik akışlarında erişilebilir olmalı |
| Açık Rıza Metni | Gerektiğinde hazırlanmalı | Zorunlu veri işleme yerine kullanılmamalı |
| Çerez Politikası | Hazırlanmalı | Çerez envanteriyle birlikte yazılmalı |
| Çerez Tercih Merkezi | Geliştirilmeli | Zorunlu olmayan çerezlerde rıza yönetimi sağlamalı |
| Kullanım Şartları | Hazırlanmalı | Genel site kullanımını kapsamalı |
| Üyelik Sözleşmesi | Kullanıcı hesabı varsa hazırlanmalı | Hesap açma ve kapatma kuralları net olmalı |
| Partner Sözleşmesi | Partner panel öncesi hazırlanmalı | İçerik, marka, veri ve ticari sorumlulukları kapsamalı |
| İade ve İptal Politikası | Satış/ödeme varsa hazırlanmalı | Hizmet türüne göre netleştirilmeli |
| Mesafeli Satış Sözleşmesi | E-ticaret varsa hazırlanmalı | Ön bilgilendirme formuyla birlikte düşünülmeli |
| Ön Bilgilendirme Formu | E-ticaret varsa hazırlanmalı | Satış öncesinde kullanıcıya sunulmalı |
| Topluluk ve İçerik Kuralları | Yorum/içerik varsa hazırlanmalı | Yasaklı içerik ve moderasyon süreci yazılmalı |
| Veri Saklama ve İmha Politikası | Hazırlanmalı | KVKK ve operasyon gereksinimleriyle uyumlu olmalı |
| Veri İhlali Müdahale Prosedürü | Hazırlanmalı | Güvenlik dokümanıyla uyumlu ilerlemeli |

## Denetim Süreci

1. Site ve modül envanteri çıkarılır.
2. Footer bağlantıları tek tek açılır, link ve içerik kontrol edilir.
3. Formlar, üyelik, teklif, destek, ödeme ve partner akışlarında hangi verilerin toplandığı listelenir.
4. Her veri alanı için amaç, hukuki dayanak, saklama süresi ve paylaşım tarafı belirlenir.
5. Eksik yasal metinler ve yanlış ifadeler risk seviyesine göre sınıflandırılır.
6. Kritik riskler bekletilmeden proje sahibine bildirilir.
7. Düzeltme önerileri kısa, uygulanabilir ve önceliklendirilmiş şekilde raporlanır.
8. Gerekli noktalarda avukat, mali müşavir veya sektör uzmanı onayı istenir.
9. Değişiklik sonrası footer, formlar ve kullanıcı akışları tekrar kontrol edilir.

## Risk Seviyeleri

| Seviye | Tanım | Müdahale Süresi |
| --- | --- | --- |
| Kritik | Yayında kalması idari yaptırım, veri ihlali, tüketici uyuşmazlığı veya ciddi itibar riski doğurabilir | Hemen bildirilir, yayın durdurma veya hızlı düzeltme önerilir |
| Yüksek | Kısa vadede hukuki şikayet, kullanıcı itirazı veya regülasyon riski oluşturabilir | İlk geliştirme döngüsünde düzeltilir |
| Orta | Belirsizlik, eksik bilgilendirme veya operasyonel uyuşmazlık riski taşır | Planlı iyileştirme listesine alınır |
| Düşük | Dil, format, erişilebilirlik veya dokümantasyon kalitesiyle ilgilidir | Periyodik bakımda iyileştirilir |

## Raporlama Formatı

Her hukuk-politika denetimi sonunda aşağıdaki format kullanılmalıdır:

| Alan | Açıklama |
| --- | --- |
| Denetim tarihi | İncelemenin yapıldığı tarih |
| İncelenen alan | Footer, form, üyelik, partner panel, kampanya, ödeme vb. |
| Bulgu | Tespit edilen eksik, hata veya risk |
| Risk seviyesi | Kritik, yüksek, orta veya düşük |
| Etki | Kullanıcı, şirket, regülasyon veya operasyon açısından etkisi |
| Önerilen düzeltme | Net aksiyon ve önerilen metin/akış değişikliği |
| Sorumlu ekip | Ürün, tasarım, geliştirme, içerik, hukuk, mali müşavir |
| Durum | Açık, inceleniyor, düzeltildi, hukuk onayı bekliyor |

## Öncelikli Aksiyonlar

1. Ana site ve tüm modüllerdeki footer bağlantıları envanterlenmeli.
2. Yayındaki veya taslaktaki tüm yasal metinler tek klasörde toplanmalı.
3. Kişisel veri toplayan tüm formlar listelenmeli.
4. KVKK aydınlatma, açık rıza ve ticari ileti izinleri ayrı akışlar olarak tasarlanmalı.
5. Çerez envanteri çıkarılmalı ve çerez tercih merkezi planlanmalı.
6. Partner sözleşmesi ve içerik sorumluluğu metinleri hazırlanmalı.
7. E-ticaret veya ödeme başlamadan önce mesafeli satış, ön bilgilendirme, iade ve iptal metinleri tamamlanmalı.
8. Kampanya, kupon ve reklam metinleri için yayın öncesi hukuk-politika kontrolü zorunlu hale getirilmeli.
9. Global açılım için GDPR ve ülke bazlı uyumluluk yol haritası hazırlanmalı.
10. Kritik bulgular için günlük bildirim, genel durum için haftalık hukuk-politika raporu oluşturulmalı.

## Kabul Kriterleri

- Footer içindeki tüm yasal ve iletişim bağlantıları çalışır durumdadır.
- Kişisel veri toplayan her formda uygun bilgilendirme ve gerekiyorsa rıza akışı vardır.
- Gizlilik, KVKK, çerez, kullanım şartları ve iletişim sayfaları güncel ve tutarlıdır.
- Satış veya ödeme varsa iade, iptal, ön bilgilendirme ve mesafeli satış metinleri tamamlanmıştır.
- Partner ve kullanıcı içeriklerinde sorumluluk, onay ve moderasyon kuralları tanımlanmıştır.
- Kritik hukuki riskler için hızlı bildirim ve düzeltme süreci işletilmektedir.
- Resmi kaynak gerektiren bulgular tarih, kaynak ve doğrulama notuyla raporlanmaktadır.
- Global açılım hedefleri için veri koruma, çerez, tüketici ve platform politikaları yol haritası hazırlanmıştır.

## 27 Haziran 2026 Uygulama Notu

| Alan | Durum | Not |
| --- | --- | --- |
| Yasal merkez | Oluşturuldu | `legal/index.html` içinde gizlilik, KVKK, çerez, kullanım, üyelik, partner, ticari iletişim, iade/iptal, mesafeli satış ve veri saklama bölümleri var. |
| Footer bağlantıları | Geliştirildi | Denizcilik, AVM, Shop ve User Panel ekranları ortak yasal merkeze bağlandı. |
| Form bilgilendirmeleri | Geliştirildi | Teklif, destek, partner içerik ve kullanıcı destek/profil alanlarına KVKK/partner/ticari ileti metinleri eklendi. |
| Şirket bilgileri | Kritik eksik | Repo içinde doğrulanabilir MERSİS, VKN, vergi dairesi, ticaret sicil no, KEP ve resmi adres bilgisi bulunamadı; sahte veri kullanılmadı. |
| Rapor | Oluşturuldu | `Hukuk-Politika Uyum ve Footer Geliştirme Raporu.md` dosyasında yapılan işler ve kalan yayın öncesi aksiyonlar listelendi. |
