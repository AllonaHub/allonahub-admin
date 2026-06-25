#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-allonahub.com}"
MAIL_HOST="${MAIL_HOST:-mail.${DOMAIN}}"
FORWARD_TO="${FORWARD_TO:-allonahub@gmail.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALIASES_FILE="${ALIASES_FILE:-${SCRIPT_DIR}/mail-forwarding/virtual-aliases}"
POSTFIX_VIRTUAL="${POSTFIX_VIRTUAL:-/etc/postfix/virtual}"
OPEN_UFW="${OPEN_UFW:-true}"
SEND_TEST="${SEND_TEST:-false}"

BEGIN_MARKER="# BEGIN ALLONAHUB MANAGED MAIL FORWARDING"
END_MARKER="# END ALLONAHUB MANAGED MAIL FORWARDING"

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo DOMAIN=${DOMAIN} FORWARD_TO=${FORWARD_TO} bash $0" >&2
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
  if ! [[ "$FORWARD_TO" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    echo "Invalid FORWARD_TO email: $FORWARD_TO" >&2
    exit 1
  fi
  if [ ! -f "$ALIASES_FILE" ]; then
    echo "Missing aliases file: $ALIASES_FILE" >&2
    exit 1
  fi
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  echo "postfix postfix/mailname string ${MAIL_HOST}" | debconf-set-selections
  echo "postfix postfix/main_mailer_type string Internet Site" | debconf-set-selections
  apt-get update
  apt-get install -y postfix postsrsd mailutils ca-certificates dnsutils
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

configure_postsrsd() {
  local config="/etc/default/postsrsd"
  set_default_var "$config" SRS_DOMAIN "$DOMAIN"
  set_default_var "$config" SRS_EXCLUDE_DOMAINS "$DOMAIN"
  set_default_var "$config" SRS_SEPARATOR "="
  systemctl enable --now postsrsd
}

build_virtual_aliases() {
  local tmp="$1"
  awk -v domain="$DOMAIN" -v forward="$FORWARD_TO" '
    /^[[:space:]]*(#|$)/ { next }
    {
      local = $1
      if (local !~ /@/) {
        local = local "@" domain
      }
      print tolower(local) " " forward
    }
    END {
      print "postmaster@" domain " " forward
    }
  ' "$ALIASES_FILE" | sort -u > "$tmp"
}

install_virtual_aliases() {
  local aliases_tmp="$1"
  local new_file
  local stamp
  new_file="$(mktemp)"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"

  mkdir -p "$(dirname "$POSTFIX_VIRTUAL")"
  touch "$POSTFIX_VIRTUAL"
  cp -a "$POSTFIX_VIRTUAL" "${POSTFIX_VIRTUAL}.bak.${stamp}"

  awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
    $0 == begin { skip = 1; next }
    $0 == end { skip = 0; next }
    skip != 1 { print }
  ' "$POSTFIX_VIRTUAL" > "$new_file"

  {
    printf '%s\n' "$BEGIN_MARKER"
    printf '# domain=%s forward_to=%s generated_at_utc=%s\n' "$DOMAIN" "$FORWARD_TO" "$stamp"
    cat "$aliases_tmp"
    printf '%s\n' "$END_MARKER"
  } >> "$new_file"

  install -m 0644 "$new_file" "$POSTFIX_VIRTUAL"
  rm -f "$new_file"
  postmap "$POSTFIX_VIRTUAL"
}

configure_postfix() {
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  cp -a /etc/postfix/main.cf "/etc/postfix/main.cf.bak.${stamp}"

  postconf -e "myhostname = ${MAIL_HOST}"
  postconf -e "mydomain = ${DOMAIN}"
  postconf -e "myorigin = ${DOMAIN}"
  postconf -e "inet_interfaces = all"
  postconf -e "inet_protocols = ipv4"
  postconf -e "mydestination = ${MAIL_HOST}, localhost.${DOMAIN}, localhost"
  postconf -e "relay_domains ="
  postconf -e "virtual_alias_domains = ${DOMAIN}"
  postconf -e "virtual_alias_maps = hash:${POSTFIX_VIRTUAL}"
  postconf -e "mynetworks = 127.0.0.0/8 [::1]/128"
  postconf -e "smtpd_banner = \$myhostname ESMTP"
  postconf -e "disable_vrfy_command = yes"
  postconf -e "recipient_delimiter = +"
  postconf -e "append_dot_mydomain = no"
  postconf -e "smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination"
  postconf -e "smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination"
  postconf -e "smtpd_tls_security_level = may"
  postconf -e "smtp_tls_security_level = may"
  postconf -e "smtpd_tls_loglevel = 1"
  postconf -e "sender_canonical_maps = tcp:127.0.0.1:10001"
  postconf -e "sender_canonical_classes = envelope_sender"
  postconf -e "recipient_canonical_maps = tcp:127.0.0.1:10002"
  postconf -e "recipient_canonical_classes = envelope_recipient,header_recipient"

  if [ -f "/etc/letsencrypt/live/${MAIL_HOST}/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/${MAIL_HOST}/privkey.pem" ]; then
    postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${MAIL_HOST}/fullchain.pem"
    postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${MAIL_HOST}/privkey.pem"
  elif [ -f /etc/ssl/certs/ssl-cert-snakeoil.pem ] && [ -f /etc/ssl/private/ssl-cert-snakeoil.key ]; then
    postconf -e "smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem"
    postconf -e "smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key"
  fi

  postfix check
  systemctl enable --now postfix
  systemctl restart postfix
}

open_firewall() {
  if [ "$OPEN_UFW" != "true" ] || ! command -v ufw >/dev/null 2>&1; then
    return
  fi
  if ufw status | grep -qi "Status: active"; then
    ufw allow 25/tcp comment "AllonaHub inbound SMTP"
  fi
}

print_summary() {
  echo
  echo "AllonaHub mail forwarding is configured on this server."
  echo "Domain:      $DOMAIN"
  echo "Mail host:   $MAIL_HOST"
  echo "Forward to:  $FORWARD_TO"
  echo
  echo "Aliases:"
  postmap -s "hash:${POSTFIX_VIRTUAL}" | sed -n "/@${DOMAIN}[[:space:]]/p" | sort
  echo
  echo "Postfix status:"
  systemctl --no-pager --full status postfix | sed -n '1,8p' || true
  echo
  echo "PostSRSd status:"
  systemctl --no-pager --full status postsrsd | sed -n '1,8p' || true
  echo
  echo "Required DNS records are documented in:"
  echo "  ${SCRIPT_DIR}/mail-forwarding/dns-records.txt"
}

send_test_message() {
  if [ "$SEND_TEST" != "true" ]; then
    return
  fi
  printf 'AllonaHub mail forwarding test generated at %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    | mail -s "AllonaHub forwarding test" "info@${DOMAIN}"
  echo "Test message submitted to info@${DOMAIN}; check ${FORWARD_TO} and mail queue/logs."
}

main() {
  require_root
  validate_input
  install_packages
  configure_postsrsd

  aliases_tmp="$(mktemp)"
  trap 'rm -f "$aliases_tmp"' EXIT
  build_virtual_aliases "$aliases_tmp"
  install_virtual_aliases "$aliases_tmp"
  configure_postfix
  open_firewall
  send_test_message
  print_summary
}

main "$@"
