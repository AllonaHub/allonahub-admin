#!/usr/bin/env sh
set -eu

REPO_DIR="${REPO_DIR:-/opt/allonahub}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/deploy/hetzner/.env.production}"
NODE_IMAGE="${NODE_IMAGE:-node:20-alpine}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

docker run --rm \
  --env-file "$ENV_FILE" \
  -e ENV_FILE=/env.production \
  -e PRODUCT_IMAGE_PROXY_BASE_URL="${PRODUCT_IMAGE_PROXY_BASE_URL:-https://api.allonahub.com/v1/media/product-images}" \
  -v "$REPO_DIR/backend/scripts:/work/scripts:ro" \
  -v "$ENV_FILE:/env.production:ro" \
  -w /work \
  "$NODE_IMAGE" \
  sh -lc '
    npm init -y >/dev/null
    npm install --silent @supabase/supabase-js@^2.45.4 ws@^8.18.3 sharp@^0.33.5 >/dev/null
    node scripts/optimize-product-images.mjs "$@"
  ' sh "$@"
