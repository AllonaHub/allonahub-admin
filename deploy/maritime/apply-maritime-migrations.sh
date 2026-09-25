#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/deploy/maritime/check-maritime-schema.sh"
CORE_CHECK_SCRIPT="$ROOT_DIR/deploy/maritime/check-maritime-hiring-core.sh"
MARIPARTNER_CHECK_SCRIPT="$ROOT_DIR/deploy/maritime/check-maripartner-schema.sh"
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"
MIGRATIONS=(
  "$ROOT_DIR/supabase/migrations/20260711123000_create_maritime_freight_requests.sql"
  "$ROOT_DIR/supabase/migrations/20260711133000_create_maritime_partner_applications.sql"
  "$ROOT_DIR/supabase/migrations/20260711143000_create_maritime_public_listings.sql"
  "$ROOT_DIR/supabase/migrations/20260711153000_create_maritime_freight_offers.sql"
  "$ROOT_DIR/supabase/migrations/20260711163000_add_maritime_listing_approval_workflow.sql"
  "$ROOT_DIR/supabase/migrations/20260711173000_accept_maritime_freight_offer_rpc.sql"
  "$ROOT_DIR/supabase/migrations/20260711183000_create_maritime_freight_matching.sql"
  "$ROOT_DIR/supabase/migrations/20260711193000_add_maritime_partner_exit_workflows.sql"
  "$ROOT_DIR/supabase/migrations/20260711203000_reconcile_maritime_freight_expirations.sql"
  "$ROOT_DIR/supabase/migrations/20260711213000_create_maritime_freight_request_rpc.sql"
  "$ROOT_DIR/supabase/migrations/20260711223000_cancel_maritime_freight_request_rpc.sql"
  "$ROOT_DIR/supabase/migrations/20260711233000_accept_maritime_freight_offer_v2_rpc.sql"
  "$ROOT_DIR/supabase/migrations/20260910120000_create_maritime_hiring_core.sql"
  "$ROOT_DIR/supabase/migrations/20260914050000_create_maritime_document_doctor.sql"
  "$ROOT_DIR/supabase/migrations/20260914060000_create_maritime_smart_account.sql"
  "$ROOT_DIR/supabase/migrations/20260915193000_enforce_maritime_application_match_firewall.sql"
  "$ROOT_DIR/supabase/migrations/20260915211500_lock_maritime_cv_identity.sql"
  "$ROOT_DIR/supabase/migrations/20260916003000_add_maritime_passkey_security.sql"
  "$ROOT_DIR/supabase/migrations/20260916014500_create_maritime_super_admin_user_controls.sql"
  "$ROOT_DIR/supabase/migrations/20260916030000_create_maritime_premium_and_pdf_access.sql"
  "$ROOT_DIR/supabase/migrations/20260916040000_add_open_vessel_lookup_fallback.sql"
  "$ROOT_DIR/supabase/migrations/20260916050000_add_current_public_vessel_provider.sql"
  "$ROOT_DIR/supabase/migrations/20260916060000_add_maritime_reference_notifications_and_storage_policy.sql"
  "$ROOT_DIR/supabase/migrations/20260916070000_create_maritime_partner_reference_center.sql"
  "$ROOT_DIR/supabase/migrations/20260916160000_expand_maritime_cv_personal_lock.sql"
  "$ROOT_DIR/supabase/migrations/20260916183000_create_marsoh_community_chat.sql"
  "$ROOT_DIR/supabase/migrations/20260919182500_add_maritime_application_submission_mode.sql"
  "$ROOT_DIR/supabase/migrations/20260919203000_expand_marsoh_languages_and_reactions.sql"
  "$ROOT_DIR/supabase/migrations/20260919221500_fix_marsoh_topic_utf8.sql"
  "$ROOT_DIR/supabase/migrations/20260920013000_expand_marsoh_admin_management.sql"
  "$ROOT_DIR/supabase/migrations/20260920153000_create_maripartner_personnel_center.sql"
  "$ROOT_DIR/supabase/migrations/20260920190000_expand_maripartner_trust_reference_layer.sql"
  "$ROOT_DIR/supabase/migrations/20260920213000_sync_verified_partner_account_roles.sql"
  "$ROOT_DIR/supabase/migrations/20260920223000_create_maripartner_company_logos.sql"
  "$ROOT_DIR/supabase/migrations/20260920233000_create_maripartner_operations_controls.sql"
  "$ROOT_DIR/supabase/migrations/20260920234500_persist_maritime_cv_drafts.sql"
  "$ROOT_DIR/supabase/migrations/20260921010000_repair_auth_device_security_and_failure_reporting.sql"
  "$ROOT_DIR/supabase/migrations/20260921020000_allow_confirmed_manual_global_cv.sql"
  "$ROOT_DIR/supabase/migrations/20260925160000_maritime_submitted_application_rooms.sql"
  "$ROOT_DIR/supabase/migrations/20260925193000_maritime_private_chat_read_cursors.sql"
  "$ROOT_DIR/supabase/migrations/20260925194500_marsoh_rejected_audit_idx.sql"
)

if [ -z "$DB_URL" ]; then
  echo "Set SUPABASE_DB_URL, DATABASE_URL or POSTGRES_URL before applying maritime migrations." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply Supabase SQL migrations." >&2
  exit 1
fi

for migration in "${MIGRATIONS[@]}"; do
  if [ ! -f "$migration" ]; then
    echo "Migration file not found: $migration" >&2
    exit 1
  fi
done

if [ ! -f "$CHECK_SCRIPT" ] || [ ! -f "$CORE_CHECK_SCRIPT" ] || [ ! -f "$MARIPARTNER_CHECK_SCRIPT" ]; then
  echo "Maritime check scripts are missing." >&2
  exit 1
fi

helper_state="$(
  psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 -c "
    select case when
      to_regprocedure('public.set_updated_at()') is not null
      and to_regprocedure('public.is_admin()') is not null
      and to_regprocedure('public.is_partner_or_admin()') is not null
      and to_regprocedure('public.has_mfa()') is not null
      and coalesce(
        pg_get_functiondef(to_regprocedure('public.is_admin()')) ilike '%has_mfa%',
        false
      )
      and coalesce(
        pg_get_functiondef(to_regprocedure('public.is_partner_or_admin()')) ilike '%has_mfa%',
        false
      )
    then 'ready' else 'missing' end;
  "
)"

if [ "$helper_state" != "ready" ]; then
  echo "Maritime migrations require schema.sql and the MFA enterprise security migration first." >&2
  echo "Apply 20260619110000_security_hardening.sql and 20260619193000_enterprise_security_controls.sql, then retry." >&2
  exit 1
fi

PSQL_FILES=()
for migration in "${MIGRATIONS[@]}"; do
  PSQL_FILES+=("-f" "$migration")
done

echo "Applying ${#MIGRATIONS[@]} maritime migrations in one transaction."
psql "$DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction "${PSQL_FILES[@]}"

"$CHECK_SCRIPT"
"$CORE_CHECK_SCRIPT"
"$MARIPARTNER_CHECK_SCRIPT"
echo "Maritime migrations applied and verified."
