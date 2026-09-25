# AllonaHub Tami 3D POS hazırlığı

AllonaHub ve AllonaShop için ayrı üye işyeri ve terminal açılacak. Bu depodaki `BANK_PAYMENT_*` adaptörü Tami protokolü değildir. `BANK_PAYMENT_PROVIDER=tami` seçilirse eski adaptör ödeme başlatmaz; yeni Tami adaptörü kurulup test edilene kadar kapalı kalmalıdır. Tami anahtarlarını `BANK_PAYMENT_API_KEY` veya `BANK_PAYMENT_SECRET_KEY` alanlarına koymayın.

Sunucuda, yalnız AllonaHub dağıtımının gizli ortam değişkenlerinde `TAMI_POS_MERCHANT_NUMBER`, `TAMI_POS_TERMINAL_NUMBER` ve `TAMI_POS_SECRET_KEY` için yer ayrıldı. Anahtarları tarayıcıya, repoya veya AllonaShop dağıtımına koymayın. Şimdilik bu değişkenler ödeme başlatmaz.

Bankadan iki site için ayrı test/canlı terminal bilgileri, kesin API sürümü ve 3D Secure işlem akışı, dönüş ve webhook imza doğrulama kuralı, izin verilecek dönüş adresleri, taksit matrisi ve para birimi yetkisi alınmalı. AllonaHub CV tutarları USD olarak tanımlıysa terminalin USD kabulü ayrıca doğrulanmalı; banka onayı olmadan sessiz TRY dönüşümü yapılmamalı.

Entegrasyon açılmadan önce testte başarılı/başarısız/iptal 3D sonucu, tekrarlanan callback, tutar ve para birimi uyuşmazlığı, yetkisiz callback ve geri ödeme senaryoları doğrulanmalı. Kart numarası ve CVC uygulama sunucusuna alınmamalı; ödeme yalnız bankanın onaylı 3D akışında tamamlanmış sayılmalı.
