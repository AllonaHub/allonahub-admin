#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required, for example: postgresql://postgres:***@db.xxx.supabase.co:5432/postgres" >&2
  exit 1
fi

command -v psql >/dev/null 2>&1 || {
  echo "psql is required to apply migrations." >&2
  exit 1
}

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/migrations/20260628120000_create_partner_integration_core.sql"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/migrations/20260629103000_partner_integration_mvp_hardening.sql"

echo "Partner integration MVP migrations applied."
