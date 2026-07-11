# Hetzner Corporate Email Outbound Identities

Bu dokuman `allonahub.com` kurumsal adreslerinden Gmail uzerinden cevap gondermek icindir. Gelen mail yonlendirme ayri dosyada tutulur: `docs/deploy/hetzner-email-forwarding.md`.

## Hedef

`allonahub@gmail.com` gelen kutusunda cevap yazarken alici tarafinda Gmail adresi degil, secilen kurumsal adres gorunsun:

| Kurumsal adres | Gmail'de gorunecek ad |
| --- | --- |
| `info@allonahub.com` | `AllonaHub` |
| `legal@allonahub.com` | `AllonaHub Legal` |
| `destek@allonahub.com` | `AllonaHub Destek` |
| `iletisim@allonahub.com` | `AllonaHub Iletisim` |
| `partner.destek@allonahub.com` | `AllonaHub Partner Destek` |
| `teknik.destek@allonahub.com` | `AllonaHub Teknik Destek` |
| `basvuru@allonahub.com` | `AllonaHub Basvuru` |

## Tercih edilen cozum

En temiz is modeli Google Workspace'tir. Google Workspace'te bir kullaniciya 30 adede kadar e-posta alias'i eklenebilir; kullanici bu alias'larla mail alip gonderebilir. Bu durumda `allonahub@gmail.com` yerine `mail@allonahub.com` veya `admin@allonahub.com` gibi Workspace hesabi ana kutu olur.

Mevcut ucretsiz Gmail akisinda ise Gmail'in `Send mail as` ozelligi kullanilir. Gmail resmi dokumaninda bu ozellik icin farkli adresten gonderim, SMTP sunucu bilgisi ve dogrulama adimi yer alir. Giden mailde Gmail adresinin gorunmemesi icin `mail.allonahub.com` uzerinden TLS/587 authenticated SMTP kullanilmalidir.

## Hetzner SMTP submission kurulumu

Sunucuda:

```bash
cd /opt/allonahub
git pull --ff-only origin main
sudo bash deploy/hetzner/setup-mail-submission.sh
```

Cloudflare Email Routing gelen postayi zaten `allonahub@gmail.com` adresine tasidigi icin bu modelde `setup-mail-forwarding.sh` zorunlu degildir. Gelen postayi Cloudflare yerine Hetzner Postfix almak istersen forwarding scripti ayrica calistirilir ve MX kayitlari degistirilir.

Script su bilgileri ekrana basar ve ayrica `/root/allonahub-mail-outbound-setup.txt` dosyasina kaydeder:

```text
SMTP server:  mail.allonahub.com
SMTP port:    587
SMTP user:    allonahub-smtp@allonahub.com
SMTP password:<generated-password>
```

Parolayi guvenli parola kasasina kaydet. Bu parola Gmail'de `Send mail as` eklerken tum kurumsal adresler icin kullanilir.

Sabit parola kullanmak istersen:

```bash
sudo SMTP_PASSWORD="UZUN_RASTGELE_PAROLA" bash deploy/hetzner/setup-mail-submission.sh
```

## DNS

Canli alan adi Cloudflare Email Routing kullandigi icin inbound MX kayitlari Cloudflare'da kalir. Hetzner sadece giden SMTP icin yetkilendirilir.

Cloudflare DNS'e eklenecek/guncellenecek kayitlar:

```text
mail   A        HETZNER_IPV4
@      TXT      "v=spf1 include:_spf.mx.cloudflare.net a:mail.allonahub.com ~all"
```

`mail` A kaydi DNS only olmalidir. Mevcut SPF kaydi varsa ikinci SPF kaydi ekleme; tek SPF kaydini yukaridaki degerle degistir.

Script bir DKIM public key uretir ve ekrana basar. Cloudflare DNS'e su formda eklenir:

```text
mail._domainkey TXT "v=DKIM1; h=sha256; k=rsa; p=..."
```

DMARC ilk asamada raporlama modunda kalabilir:

```text
_dmarc TXT "v=DMARC1; p=none; rua=mailto:legal@allonahub.com; fo=1; adkim=s; aspf=s"
```

Teslimat ve DKIM dogrulandiktan sonra DMARC politikasi `quarantine` veya `reject` seviyesine alinabilir.

## Gmail'de her adresi ekleme

Gmail > Settings > See all settings > Accounts and Import > Send mail as > Add another email address:

1. Name alanina tablodaki gorunecek adi yaz.
2. Email address alanina kurumsal adresi yaz.
3. SMTP server: `mail.allonahub.com`
4. Port: `587`
5. Username: `allonahub-smtp@allonahub.com`
6. Password: scriptin verdigi SMTP parolasi
7. Secured connection using TLS secili olsun.
8. Gmail dogrulama kodunu ayni gelen kutusuna yollar; cunku alias'lar `allonahub@gmail.com` adresine forward edilir.
9. Gmail `Accounts and Import` ekraninda `When replying to a message` ayarini `Reply from the same address the message was sent to` yap.

Bu adimi su adreslerin tamami icin tekrarla:

```text
deploy/hetzner/mail-forwarding/gmail-send-as-entries.txt
```

## Dogrulama

```bash
bash deploy/hetzner/check-mail-forwarding.sh
nc -vz mail.allonahub.com 587
dig TXT mail._domainkey.allonahub.com
```

Sonra Gmail'den `destek@allonahub.com` olarak harici bir adrese test maili gonder. Alici tarafta `From` adresi `destek@allonahub.com` olmali; `allonahub@gmail.com` gorunmemeli.

## Guvenlik notlari

- Submission portu yalnizca TLS ve SMTP authentication ile acilir.
- `smtpd_sender_login_maps` yalnizca `deploy/hetzner/mail-forwarding/outbound-identities` icindeki adreslerden gonderime izin verir.
- Tek SMTP parolasi paylasildigi icin bu parola Gmail disinda hicbir yerde kullanilmamalidir.
- Parola sizarsa `SMTP_PASSWORD="yeni_parola"` ile script tekrar calistirilir ve Gmail'deki Send mail as parolalari yenilenir.

## Kaynaklar

- Gmail Send mail as: https://support.google.com/mail/answer/22370
- Google Workspace email aliases: https://support.google.com/a/answer/33327
