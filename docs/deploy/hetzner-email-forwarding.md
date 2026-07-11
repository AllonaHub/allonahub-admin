# Hetzner Corporate Email Forwarding

Bu dokuman `allonahub.com` icin kurumsal e-posta adreslerini Hetzner sunucusunda alir ve tum gelen postayi `allonahub@gmail.com` adresine yonlendirir.

Gmail'den cevap yazarken `destek@allonahub.com`, `legal@allonahub.com` veya `basvuru@allonahub.com` adresiyle gonderim yapmak icin ayrica authenticated SMTP submission kurulumu gerekir. Giden kimlik adimlari `docs/deploy/hetzner-email-outbound-identities.md` dosyasindadir.

## Hedef adresler

| Kurumsal adres | Yonlendirme |
| --- | --- |
| `info@allonahub.com` | `allonahub@gmail.com` |
| `legal@allonahub.com` | `allonahub@gmail.com` |
| `destek@allonahub.com` | `allonahub@gmail.com` |
| `iletisim@allonahub.com` | `allonahub@gmail.com` |
| `partner.destek@allonahub.com` | `allonahub@gmail.com` |
| `teknik.destek@allonahub.com` | `allonahub@gmail.com` |
| `basvuru@allonahub.com` | `allonahub@gmail.com` |

Script ayrica teknik zorunluluk icin `postmaster@allonahub.com` adresini ayni hedefe yonlendirir.

## On kosullar

- Sunucuda Ubuntu/Debian tabanli bir Hetzner ortam.
- Cloudflare Email Routing modeli kullaniliyorsa mevcut Cloudflare MX kayitlari korunur.
- Giden SMTP icin `mail.allonahub.com` DNS-only A kaydi Hetzner sunucu IP'sine gider.
- Direkt Hetzner inbound modeli kullaniliyorsa `allonahub.com` MX kaydi `mail.allonahub.com` hostuna yonlenir.
- Hetzner Cloud Firewall veya sunucu firewall tarafinda inbound TCP 25 izni.
- Gmail'e dogrudan forward icin outbound TCP 25 izni.

Hetzner Cloud tarafinda outbound TCP 25 ve 465 varsayilan olarak kapali olabilir. Bu durumda Postfix kuyruga alir ama Gmail'e teslim edemez. Hetzner Console uzerinden SMTP port acma talebi gonderilmeli veya 587 kullanan harici bir mail relay/yonlendirme servisi tercih edilmelidir.

Referans: https://docs.hetzner.com/cloud/servers/faq/#why-can-i-not-send-any-mails-from-my-server

## DNS kayitlari

Canli `allonahub.com` DNS'i su an Cloudflare Email Routing kullaniyor. Yani gelen posta icin MX kayitlari `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net` olarak kalabilir. Bu modelde Hetzner yalnizca Gmail `Send mail as` icin giden SMTP sunucusu olur.

Cloudflare Email Routing + Hetzner outbound SMTP modeli icin DNS sablonu:

```text
deploy/hetzner/mail-forwarding/cloudflare-email-routing-outbound-dns.txt
```

Bu modelde eklenmesi/guncellenmesi gereken kayitlar:

```text
mail   A        HETZNER_IPV4
@      TXT      "v=spf1 include:_spf.mx.cloudflare.net a:mail.allonahub.com ~all"
mail._domainkey TXT "v=DKIM1; h=sha256; k=rsa; p=DKIM_PUBLIC_KEY"
_dmarc TXT      "v=DMARC1; p=none; rua=mailto:legal@allonahub.com; fo=1; adkim=s; aspf=s"
```

Notlar:

- `mail` A kaydi Cloudflare'da DNS only olmalidir; turuncu proxy acik olmamalidir.
- Mevcut Cloudflare MX kayitlarini silme.
- Mevcut SPF degeri `v=spf1 include:_spf.mx.cloudflare.net ~all` ise bunu tek SPF kaydi olarak yukaridaki degerle degistir.
- `DKIM_PUBLIC_KEY`, `setup-mail-submission.sh` calistiktan sonra ekrana basilan `p=` degeridir.

### Alternatif: direkt Hetzner inbound

Sablon:

```text
deploy/hetzner/mail-forwarding/dns-records.txt
```

Gelen postayi Cloudflare yerine dogrudan Hetzner Postfix almak istersen Cloudflare DNS veya domain DNS panelinde:

```text
@      MX   10 mail.allonahub.com.
mail   A       HETZNER_IPV4
# mail AAAA    HETZNER_IPV6
@      TXT     "v=spf1 mx -all"
mail._domainkey TXT "v=DKIM1; h=sha256; k=rsa; p=REPLACE_WITH_SETUP_MAIL_SUBMISSION_PUBLIC_KEY"
_dmarc TXT     "v=DMARC1; p=none; rua=mailto:legal@allonahub.com; fo=1; adkim=s; aspf=s"
```

Notlar:

- Mevcut bir SPF kaydi varsa ikinci SPF kaydi ekleme; tek TXT SPF kaydi icinde `mx` politikasini birlestir.
- Hetzner reverse DNS/PTR degeri mumkunse `mail.allonahub.com` yapilmalidir.
- Ilk asamada DMARC `p=none` kalir; teslimat basarisi ve raporlar izlendikten sonra `quarantine` veya `reject` degerine gecilir.

## Kurulum

Sunucuda:

```bash
cd /opt/allonahub
git pull --ff-only origin main
sudo bash deploy/hetzner/setup-mail-forwarding.sh
```

Degerler varsayilan olarak:

```text
DOMAIN=allonahub.com
MAIL_HOST=mail.allonahub.com
FORWARD_TO=allonahub@gmail.com
```

Gerektiginde override:

```bash
sudo DOMAIN=allonahub.com MAIL_HOST=mail.allonahub.com FORWARD_TO=allonahub@gmail.com bash deploy/hetzner/setup-mail-forwarding.sh
```

Test maili de gondermek icin:

```bash
sudo SEND_TEST=true bash deploy/hetzner/setup-mail-forwarding.sh
```

## Dogrulama

```bash
bash deploy/hetzner/check-mail-forwarding.sh
sudo postmap -q info@allonahub.com hash:/etc/postfix/virtual
sudo postqueue -p
sudo tail -n 80 /var/log/mail.log
```

Beklenen local alias sonuc:

```text
info@allonahub.com -> allonahub@gmail.com
legal@allonahub.com -> allonahub@gmail.com
destek@allonahub.com -> allonahub@gmail.com
iletisim@allonahub.com -> allonahub@gmail.com
partner.destek@allonahub.com -> allonahub@gmail.com
teknik.destek@allonahub.com -> allonahub@gmail.com
basvuru@allonahub.com -> allonahub@gmail.com
```

Disaridan son kontrol:

```bash
dig MX allonahub.com
dig A mail.allonahub.com
nc -vz mail.allonahub.com 25
```

Ardindan Gmail gelen kutusunda veya spam klasorunde test mailini kontrol et.

## Giden cevap adresleri

Bu kurulum yalnizca gelen e-postayi yonlendirir. Gmail'de aliciya `allonahub@gmail.com` degil de `destek@allonahub.com` gibi kurumsal adreslerin gorunmesi icin:

```bash
sudo bash deploy/hetzner/setup-mail-submission.sh
```

Ardindan Gmail `Send mail as` ekraninda her kurumsal adres eklenir. Detayli adimlar:

```text
docs/deploy/hetzner-email-outbound-identities.md
```

## Guvenlik notlari

- Script mailbox acmaz; yalnizca inbound virtual alias forwarding yapar.
- `reject_unauth_destination` aktif tutularak open relay riski engellenir.
- Bu script SMTP auth ve submission portu acmaz; giden cevap kimlikleri icin `setup-mail-submission.sh` ayrica calistirilir.
- PostSRSd aktif edilir; boylece Gmail'e forward edilen postalar icin SPF kaynakli teslimat sorunlari azalir.
- `/etc/postfix/virtual` ve `/etc/postfix/main.cf` dosyalari degistirilmeden once timestamp'li yedeklenir.

## Geri alma

Kurulumdan once alinan yedekler:

```bash
ls -1 /etc/postfix/main.cf.bak.*
ls -1 /etc/postfix/virtual.bak.*
```

Yalnizca AllonaHub alias bloklarini kaldirmak icin:

```bash
sudo sed -i '/^# BEGIN ALLONAHUB MANAGED MAIL FORWARDING$/,/^# END ALLONAHUB MANAGED MAIL FORWARDING$/d' /etc/postfix/virtual
sudo postmap /etc/postfix/virtual
sudo systemctl reload postfix
```
