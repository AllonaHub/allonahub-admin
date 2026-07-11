# Supabase Auth Email Branding

Son guncelleme: 29.06.2026

Bu runbook, Supabase Auth tarafindan gonderilen sifre yenileme ve sifre degisti bildirimlerinin Alloana Hub adiyla cikmasi icindir.

## Hedef ayar

- Sender name: `Alloana Hub`
- From address: `destek@allonahub.com` veya SMTP servisinde dogrulanmis `no-reply@allonahub.com`
- Reset subject: `Alloana Hub şifre yenileme bağlantın`
- Password changed subject: `Alloana Hub şifren güncellendi`
- Reset redirect: `https://allonahub.com/pages/account/reset-password.html`

Supabase'in varsayilan SMTP servisi uretim icin tasarlanmamistir ve gonderen kimligi Supabase olarak gorunebilir. Bu nedenle canli ortamda custom SMTP kullanilmalidir.

## Management API ile uygulama

1. Supabase Dashboard > Account > Access Tokens alanindan token al.
2. Proje ref degeri: `xqvikrysciguzholdjeb`.
3. SMTP servisinde `allonahub.com` icin SPF, DKIM ve DMARC kayitlarinin dogrulandigindan emin ol.
4. Asagidaki komutu yerel terminalde calistir:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
export SUPABASE_PROJECT_REF="xqvikrysciguzholdjeb"
export SUPABASE_AUTH_SENDER_NAME="Alloana Hub"
export SUPABASE_AUTH_SMTP_ADMIN_EMAIL="destek@allonahub.com"
export SUPABASE_AUTH_SMTP_HOST="smtp.example.com"
export SUPABASE_AUTH_SMTP_PORT="587"
export SUPABASE_AUTH_SMTP_USER="smtp-user"
export SUPABASE_AUTH_SMTP_PASS="smtp-password"

node scripts/apply-supabase-auth-email-branding.mjs
```

Degisiklikleri once gormek icin:

```bash
node scripts/apply-supabase-auth-email-branding.mjs --dry-run
```

## Dashboard ile manuel uygulama

1. Supabase Dashboard > Authentication > Settings > SMTP Settings alanina gir.
2. Custom SMTP'yi etkinlestir.
3. Sender name alanina `Alloana Hub` yaz.
4. Sender email alanina SMTP servisinde dogrulanmis adresi yaz.
5. Authentication > Email Templates > Reset password sablonuna `supabase/auth-email-templates/recovery.html` icerigini yapistir.
6. Subject alanini `Alloana Hub şifre yenileme bağlantın` olarak ayarla.
7. Security notification > Password changed sablonuna `supabase/auth-email-templates/password-changed.html` icerigini yapistir.
8. Subject alanini `Alloana Hub şifren güncellendi` olarak ayarla ve bildirimi etkinlestir.

## Dogrulama

1. `https://allonahub.com/pages/account/user.html?tab=forgot` adresinden test kullanicisi icin sifre yenileme iste.
2. Gelen e-postada `From` adinin `Alloana Hub` oldugunu kontrol et.
3. Linkin `https://allonahub.com/pages/account/reset-password.html` sayfasinda acildigini kontrol et.
4. Sifreyi degistirdikten sonra sifre degisti bildiriminin yine `Alloana Hub` adiyla geldigini kontrol et.

## Kaynaklar

- Supabase Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Management API: https://supabase.com/docs/reference/api/introduction
