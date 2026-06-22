#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-allonahub.com}"
MAIL_HOST="${MAIL_HOST:-mail.${DOMAIN}}"
ALIASES="${ALIASES:-info legal destek iletisim partner.destek teknik.destek basvuru postmaster}"

echo "== DNS MX =="
if command -v dig >/dev/null 2>&1; then
  dig +short MX "$DOMAIN" || true
  echo
  echo "== DNS A/AAAA =="
  dig +short A "$MAIL_HOST" || true
  dig +short AAAA "$MAIL_HOST" || true
  echo
  echo "== DNS TXT =="
  dig +short TXT "$DOMAIN" || true
  dig +short TXT "_dmarc.${DOMAIN}" || true
else
  echo "dig is not installed; install dnsutils for DNS checks."
fi

echo
echo "== Local Postfix alias map =="
if command -v postmap >/dev/null 2>&1 && [ -f /etc/postfix/virtual.db ]; then
  for local in $ALIASES; do
    printf '%s@%s -> ' "$local" "$DOMAIN"
    postmap -q "${local}@${DOMAIN}" hash:/etc/postfix/virtual || true
  done
else
  echo "Postfix alias map not found on this machine."
fi

echo
echo "== Services =="
if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active postfix || true
  systemctl is-active postsrsd || true
else
  echo "systemctl is not available."
fi

echo
echo "== SMTP port =="
if command -v nc >/dev/null 2>&1; then
  nc -vz -w 5 "$MAIL_HOST" 25 || true
else
  echo "nc is not installed; skip TCP port check."
fi

echo
echo "== Recent mail log hints =="
if [ -f /var/log/mail.log ]; then
  tail -n 40 /var/log/mail.log
elif command -v journalctl >/dev/null 2>&1; then
  journalctl -u postfix -n 40 --no-pager || true
else
  echo "No mail log source found."
fi
