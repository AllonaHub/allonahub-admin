#!/usr/bin/env bash
set -euo pipefail

echo "== OS =="
if command -v lsb_release >/dev/null 2>&1; then
  lsb_release -a
else
  cat /etc/os-release
fi

echo "== Kernel =="
uname -a

echo "== Docker =="
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version || true
else
  echo "Docker not installed"
fi

echo "== Nginx =="
if command -v nginx >/dev/null 2>&1; then
  nginx -v
  systemctl is-active nginx || true
else
  echo "Nginx not installed"
fi

echo "== Coolify =="
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qi coolify; then
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -i coolify
else
  echo "Coolify container not found"
fi

echo "== Ports =="
ss -tulpn | grep -E ':(22|80|443|3000)\b' || true
