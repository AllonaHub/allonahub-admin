#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION_FILE="${MIGRATION_FILE:-$ROOT_DIR/supabase/migrations/20260629090000_add_product_seller_disclosure_fields.sql}"
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"
PSQL_BIN="${PSQL_BIN:-psql}"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Migration file not found: $MIGRATION_FILE" >&2
  exit 1
fi

if [ -z "$DB_URL" ]; then
  echo "Set SUPABASE_DB_URL, DATABASE_URL or POSTGRES_URL before applying the migration." >&2
  exit 1
fi

if ! command -v "$PSQL_BIN" >/dev/null 2>&1; then
  echo "psql is required to apply Supabase SQL migrations from the terminal." >&2
  echo "Install a PostgreSQL client, set PSQL_BIN to its path, or run this SQL in Supabase SQL Editor:" >&2
  echo "$MIGRATION_FILE" >&2
  exit 1
fi

echo "Applying Supabase migration: $(basename "$MIGRATION_FILE")"
"$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
echo "Supabase migration applied."
