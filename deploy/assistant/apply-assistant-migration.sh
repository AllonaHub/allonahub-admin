#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION_FILE="${MIGRATION_FILE:-$ROOT_DIR/supabase/migrations/20260621223000_create_conversation_logs.sql}"
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Migration file not found: $MIGRATION_FILE" >&2
  exit 1
fi

if [ -z "$DB_URL" ]; then
  echo "Set SUPABASE_DB_URL, DATABASE_URL or POSTGRES_URL before applying the migration." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply Supabase SQL migrations." >&2
  exit 1
fi

echo "Applying assistant migration: $(basename "$MIGRATION_FILE")"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
echo "Assistant migration applied."
