# AllonaHub Security-First Implementation - 2026-06-21

## Scope

Reviewed and hardened the current AllonaHub frontend, Supabase/RLS layer, backend API, payment preparation flows, partner application flow, public partner payment links, CV payment flow, storage policy posture, and deployment secret handling.

## Applied Controls

- Added backend Cloudflare Turnstile verification for public partner applications, public partner payment checkout, order checkout, and CV checkout.
- Added frontend Turnstile helper for login, register, forgot password, checkout, CV payment, partner application, and public partner payment forms.
- Moved partner applications from direct public Supabase insert to a backend endpoint with Zod validation, Turnstile, rate limiting by recent application count, and audit logging.
- Removed card number, expiry, and CVC collection from AllonaHub checkout, legacy commerce payment previews, and CV payment pages. Card data is now entered only on iyzico's secure payment page.
- Removed frontend fallback order inserts when the secure `create_secure_order` RPC is missing.
- Added payment callback token matching and idempotency guards so mismatched tokens cannot change order/payment state and repeated partner callbacks cannot duplicate transactions.
- Added database migration for canonical role expansion, backend-only partner application insert policy, order payment token fields, partner transaction uniqueness, and storage MIME/bucket restrictions.
- Added Turnstile env placeholders to `.env.example` and Hetzner production env example.

## Risk Register

### Critical

- Direct card fields on AllonaHub pages increased PCI and phishing exposure.
  - Status: Fixed by removing card fields from checkout and CV payment pages.

- Payment callbacks could be replayed or mismatched to mutate payment/order state.
  - Status: Fixed with token matching, paid-state early return, and unique partner transaction index.

### High

- Public partner application form wrote directly to Supabase from the browser.
  - Status: Fixed in frontend by using backend endpoint; database migration disables public insert.

- Secure order creation could fall back to direct frontend inserts if migration was missing.
  - Status: Fixed by failing closed with a migration-required error.

### Medium

- Cloudflare bot challenge was documented but not wired into forms.
  - Status: Fixed with Turnstile frontend helper and backend verification for public/payment endpoints.

- Role taxonomy did not fully match the global directive.
  - Status: Improved by adding user, employer, and maritime_crew role values and helper functions while keeping legacy customer compatibility.

### Low

- Env examples did not list Turnstile keys.
  - Status: Fixed.

## Remaining Production Tasks

- Set real `TURNSTILE_SITE_KEY` in public frontend config and `TURNSTILE_SECRET_KEY` in backend/hosting secrets.
- Apply `supabase/migrations/20260621170000_global_security_first_controls.sql` before enforcing backend-only partner applications in production.
- Deploy the backend route `/v1/public/partner-applications`; otherwise the public partner form must stay disabled until the route is live.
- Confirm Cloudflare WAF, rate limiting, Bot Fight/Turnstile, and SSL Full Strict are enabled in the live Cloudflare zone.
- Verify Supabase Storage bucket settings after migration: `product-images`, `brand-assets`, and `partner-documents`.
- Run live payment sandbox tests for order checkout, CV checkout, partner payment link, failed callback, duplicate callback, and token mismatch callback.
