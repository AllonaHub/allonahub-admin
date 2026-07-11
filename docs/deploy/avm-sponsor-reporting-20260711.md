# AVM sponsor reporting release

- Source package: `AllonaHub/allonahub-site@8d21c30afb7758641a96c13c0ef2dc7b017f9e2a`.
- Baseline: `origin/main@be384dcfd73dc39ae3f3fda15fa57b32827233f8`.
- Adds daily unique anonymous sponsor impressions/clicks, active-placement validation, RLS-scoped partner summary, visitor measurement and canonical `partner/avm.html` performance UI.
- Required production SQL: `supabase/migrations/20260712021000_add_avm_sponsor_reporting.sql`, after the existing AVM migration chain. SQL is not applied by this code release.
- No seed, secret, destructive migration, DNS or payment change is included.
- Smoke: `scripts/smoke-avm-sponsored.cjs` covers visitor desktop/mobile measurement, admin sponsor publishing and partner request/report rendering.
