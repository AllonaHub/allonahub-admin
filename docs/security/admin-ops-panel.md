# AllonaHub Admin Operations Panel

Bu dokuman `/admin/index.html` altindaki sinirli yetkili Admin Panel mimarisini tanimlar. Super Admin Panel bu alanin disinda kalir.

## Security Boundary

- Admin Panel backend route prefix: `/v1/admin/ops/*`
- Frontend route: `/admin/index.html`
- Role boundary: exact `admin` role only.
- Super Admin role is intentionally not accepted by `requireOpsAdmin`.
- Backend checks:
  - Supabase JWT verification.
  - `profiles.role = admin`.
  - MFA requirement.
  - admin host/IP boundary.
  - database RPC `public.is_ops_admin()`.
- Frontend never receives or stores `service_role_key`.
- Frontend only sends the current Supabase access token as Bearer JWT.
- Admin writes are limited to notes, flags, support status updates, partner application recommendations and content approval requests.
- User deletion, commission changes, payment/finance settings, Super Admin creation and system settings are not implemented in Admin Panel.

## Supabase Migration

Required migration:

```text
supabase/migrations/20260621153000_create_admin_ops_panel.sql
```

The migration adds:

- `public.is_ops_admin()`
- `admin_operation_notes`
- `admin_operation_flags`
- `admin_approval_requests`
- `support_tickets`
- `support_ticket_notes`
- `content_change_proposals`
- extra review columns on `partner_applications`

RLS is enabled on all new tables. Client delete is blocked by trigger. Admin approval requests can be approved or rejected only by the separate Super Admin authority path.

## Audit

All Admin Panel API reads and writes call `auditEvent` with:

- actor id and role
- action
- resource type and id
- request IP
- timestamp
- risk severity where relevant
- source `admin`
- purpose `admin_operations`

Audit storage depends on the existing append-only `security_audit_events` table and `append_security_audit_event` RPC.

## Demo Data

The Admin Panel does not include demo data. Empty tables render empty states. If the migration is not applied to production Supabase, API responses include warnings for missing tables or policies.
