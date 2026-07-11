#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-allonahub.com}"
MAIL_HOST="${MAIL_HOST:-mail.${DOMAIN}}"
SMTP_USER="${SMTP_USER:-allonahub-smtp}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
DKIM_SELECTOR="${DKIM_SELECTOR:-mail}"
PUBLIC_IPV4="${PUBLIC_IPV4:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDENTITIES_FILE="${IDENTITIES_FILE:-${SCRIPT_DIR}/mail-forwarding/outbound-identities}"
SENDER_LOGIN_MAP="${SENDER_LOGIN_MAP:-/etc/postfix/sender_login}"
SUMMARY_FILE="${SUMMARY_FILE:-/root/allonahub-mail-outbound-setup.txt}"
OPEN_UFW="${OPEN_UFW:-true}"

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo DOMAIN=${DOMAIN} bash $0" >&2
    exit 1
  fi
}

validate_input() {
  if ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "Invalid DOMAIN: $DOMAIN" >&2
    exit 1
  fi
  if ! [[ "$MAIL_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "Invalid MAIL_HOST: $MAIL_HOST" >&2
    exit 1
  fi
  if ! [[ "$SMTP_USER" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Invalid SMTP_USER: $SMTP_USER" >&2
    exit 1
  fi
  if ! [[ "$DKIM_SELECTOR" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Invalid DKIM_SELECTOR: $DKIM_SELECTOR" >&2
    exit 1
  fi
  if [ ! -f "$IDENTITIES_FILE" ]; then
    echo "Missing outbound identities file: $IDENTITIES_FILE" >&2
    exit 1
  fi
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y postfix opendkim opendkim-tools sasl2-bin libsasl2-modules ca-certificates dnsutils mailutils openssl curl
}

generate_password() {
  if [ -n "$SMTP_PASSWORD" ]; then
    return
  fi
  SMTP_PASSWORD="$(openssl rand -base64 24)"
}

discover_public_ipv4() {
  if [ -n "$PUBLIC_IPV4" ]; then
    return
  fi
  PUBLIC_IPV4="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  if ! [[ "$PUBLIC_IPV4" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    PUBLIC_IPV4="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if ! [[ "$PUBLIC_IPV4" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    PUBLIC_IPV4="HETZNER_IPV4"
  fi
}

set_default_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped
  escaped="${value//\"/\\\"}"
  touch "$file"
  if grep -Eq "^#?${key}=" "$file"; then
    sed -i "s|^#\\?${key}=.*|${key}=\"${escaped}\"|" "$file"
  else
    printf '%s="%s"\n' "$key" "$escaped" >> "$file"
  fi
}

build_sender_login_map() {
  local tmp
  tmp="$(mktemp)"
  awk -v domain="$DOMAIN" -v logins="${SMTP_USER}@${DOMAIN} ${SMTP_USER}" '
    /^[[:space:]]*(#|$)/ { next }
    {
      local = $1
      if (local !~ /@/) {
        local = local "@" domain
      }
      print tolower(local) " " logins
    }
  ' "$IDENTITIES_FILE" | sort -u > "$tmp"

  install -m 0644 "$tmp" "$SENDER_LOGIN_MAP"
  rm -f "$tmp"
  postmap "$SENDER_LOGIN_MAP"
}

configure_sasl() {
  mkdir -p /etc/postfix/sasl
  cat >/etc/postfix/sasl/smtpd.conf <<'EOF'
pwcheck_method: auxprop
auxprop_plugin: sasldb
mech_list: plain login
EOF

  printf '%s\n' "$SMTP_PASSWORD" | saslpasswd2 -p -c -u "$DOMAIN" "$SMTP_USER"
  if [ -f /etc/sasldb2 ]; then
    chown root:postfix /etc/sasldb2
    chmod 0640 /etc/sasldb2
  fi
}

configure_opendkim() {
  local stamp
  local key_dir
  local key_base
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  key_dir="/etc/opendkim/keys/${DOMAIN}"
  key_base="${key_dir}/${DKIM_SELECTOR}"

  mkdir -p "$key_dir"
  if [ ! -f "${key_base}.private" ]; then
    opendkim-genkey -b 2048 -r -d "$DOMAIN" -s "$DKIM_SELECTOR" -D "$key_dir"
  fi

  if [ -f /etc/opendkim.conf ]; then
    cp -a /etc/opendkim.conf "/etc/opendkim.conf.bak.${stamp}"
  fi

  cat >/etc/opendkim.conf <<EOF
Syslog yes
UMask 002
Mode sv
Canonicalization relaxed/simple
Socket inet:8891@127.0.0.1
PidFile /run/opendkim/opendkim.pid
UserID opendkim
KeyTable refile:/etc/opendkim/key.table
SigningTable refile:/etc/opendkim/signing.table
ExternalIgnoreList refile:/etc/opendkim/trusted.hosts
InternalHosts refile:/etc/opendkim/trusted.hosts
EOF

  cat >/etc/opendkim/key.table <<EOF
${DKIM_SELECTOR}._domainkey.${DOMAIN} ${DOMAIN}:${DKIM_SELECTOR}:${key_base}.private
EOF

  cat >/etc/opendkim/signing.table <<EOF
*@${DOMAIN} ${DKIM_SELECTOR}._domainkey.${DOMAIN}
EOF

  cat >/etc/opendkim/trusted.hosts <<EOF
127.0.0.1
localhost
${DOMAIN}
${MAIL_HOST}
EOF

  set_default_var /etc/default/opendkim SOCKET "inet:8891@127.0.0.1"
  chown -R opendkim:opendkim /etc/opendkim
  chmod 0600 "${key_base}.private"
  systemctl enable --now opendkim
}

configure_postfix_submission() {
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  cp -a /etc/postfix/main.cf "/etc/postfix/main.cf.bak.submission.${stamp}"
  cp -a /etc/postfix/master.cf "/etc/postfix/master.cf.bak.submission.${stamp}"

  postconf -e "myhostname = ${MAIL_HOST}"
  postconf -e "mydomain = ${DOMAIN}"
  postconf -e "myorigin = ${DOMAIN}"
  postconf -e "inet_protocols = ipv4"
  postconf -e "smtpd_tls_auth_only = yes"
  postconf -e "smtpd_sasl_auth_enable = yes"
  postconf -e "smtpd_sasl_type = cyrus"
  postconf -e "smtpd_sasl_path = smtpd"
  postconf -e "smtpd_sasl_security_options = noanonymous"
  postconf -e "smtpd_sasl_tls_security_options = noanonymous"
  postconf -e "smtpd_sender_login_maps = hash:${SENDER_LOGIN_MAP}"
  postconf -e "milter_default_action = accept"
  postconf -e "milter_protocol = 6"
  postconf -e "smtpd_milters = inet:127.0.0.1:8891"
  postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"

  if [ -f "/etc/letsencrypt/live/${MAIL_HOST}/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/${MAIL_HOST}/privkey.pem" ]; then
    postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${MAIL_HOST}/fullchain.pem"
    postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${MAIL_HOST}/privkey.pem"
  fi

  postconf -M submission/inet="submission inet n - n - - smtpd"
  postconf -P submission/inet/syslog_name=postfix/submission
  postconf -P submission/inet/smtpd_tls_security_level=encrypt
  postconf -P submission/inet/smtpd_sasl_auth_enable=yes
  postconf -P submission/inet/smtpd_client_restrictions=permit_sasl_authenticated,reject
  postconf -P submission/inet/smtpd_relay_restrictions=permit_sasl_authenticated,reject
  postconf -P submission/inet/smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  postconf -P submission/inet/smtpd_sender_restrictions=reject_sender_login_mismatch,permit_sasl_authenticated,reject

  postfix check
  systemctl enable --now postfix
  systemctl restart opendkim postfix
}

open_firewall() {
  if [ "$OPEN_UFW" != "true" ] || ! command -v ufw >/dev/null 2>&1; then
    return
  fi
  if ufw status | grep -qi "Status: active"; then
    ufw allow 587/tcp comment "AllonaHub authenticated SMTP submission"
  fi
}

print_summary() {
  local key_txt="/etc/opendkim/keys/${DOMAIN}/${DKIM_SELECTOR}.txt"
  local dkim_value="DKIM_PUBLIC_KEY"
  local summary_tmp
  if [ -f "$key_txt" ]; then
    dkim_value="$(tr -d '\n' < "$key_txt" | grep -Eo 'p=[A-Za-z0-9+/=]+' | head -1 | cut -d= -f2-)"
    if [ -z "$dkim_value" ]; then
      dkim_value="DKIM_PUBLIC_KEY"
    fi
  fi
  summary_tmp="$(mktemp)"
  {
    echo "AllonaHub outbound SMTP submission"
    echo
    echo "SMTP"
    echo "server=${MAIL_HOST}"
    echo "port=587"
    echo "username=${SMTP_USER}@${DOMAIN}"
    echo "password=${SMTP_PASSWORD}"
    echo "tls=required"
    echo
    echo "Cloudflare DNS records"
    echo "Keep existing Cloudflare Email Routing MX records."
    echo "Add/update these records:"
    echo "mail A ${PUBLIC_IPV4} (DNS only / grey cloud)"
    echo "@ TXT \"v=spf1 include:_spf.mx.cloudflare.net a:${MAIL_HOST} ~all\""
    echo "${DKIM_SELECTOR}._domainkey TXT \"v=DKIM1; h=sha256; k=rsa; p=${dkim_value}\""
    echo "_dmarc TXT \"v=DMARC1; p=none; rua=mailto:legal@${DOMAIN}; fo=1; adkim=s; aspf=s\""
    echo
    echo "Gmail Send mail as entries"
    awk -v domain="$DOMAIN" -v host="$MAIL_HOST" -v user="${SMTP_USER}@${DOMAIN}" '
      /^[[:space:]]*(#|$)/ { next }
      {
        local = $1
        if (local !~ /@/) local = local "@" domain
        $1 = ""
        display = $0
        sub(/^[[:space:]]+/, "", display)
        printf "- Name: %s | Email: %s | SMTP: %s | Port: 587 | Username: %s | TLS: yes\n", display, tolower(local), host, user
      }
    ' "$IDENTITIES_FILE"
  } > "$summary_tmp"
  install -m 0600 "$summary_tmp" "$SUMMARY_FILE"
  rm -f "$summary_tmp"

  echo
  echo "AllonaHub outbound SMTP submission is configured."
  echo "SMTP server:  ${MAIL_HOST}"
  echo "SMTP port:    587"
  echo "SMTP user:    ${SMTP_USER}@${DOMAIN}"
  echo "SMTP password:${SMTP_PASSWORD}"
  echo
  echo "Allowed From addresses:"
  postmap -s "hash:${SENDER_LOGIN_MAP}" | sort
  echo
  echo "Cloudflare DNS records to add/update:"
  echo "  mail A ${PUBLIC_IPV4} (DNS only / grey cloud)"
  echo "  @ TXT \"v=spf1 include:_spf.mx.cloudflare.net a:${MAIL_HOST} ~all\""
  echo "  ${DKIM_SELECTOR}._domainkey TXT \"v=DKIM1; h=sha256; k=rsa; p=${dkim_value}\""
  echo
  echo "Full Gmail/DNS setup summary saved to: ${SUMMARY_FILE}"
  echo "Gmail setup: Settings > See all settings > Accounts and Import > Send mail as > Add another email address."
  echo "Use the SMTP server, user and password above for each allowed From address."
}

main() {
  require_root
  validate_input
  install_packages
  generate_password
  discover_public_ipv4
  configure_sasl
  build_sender_login_map
  configure_opendkim
  configure_postfix_submission
  open_firewall
  print_summary
}

main "$@"
