# Super Admin Owner Console

AllonaHub Super Admin is intentionally fail-closed. A user must pass all layers below:

1. Supabase authenticated session
2. `super_admin` role
3. MFA/AAL2 verification
4. admin host/IP boundary
5. owner allowlist verification

## Owner Allowlist

Production must set at least one of these server-only env values:

```env
SUPER_ADMIN_OWNER_USER_IDS="supabase-user-id"
SUPER_ADMIN_OWNER_EMAILS="owner@example.com"
```

The owner can also be seeded in Supabase with service role SQL:

```sql
insert into public.super_admin_owner_access (user_id, email, label, status)
values ('00000000-0000-0000-0000-000000000000', 'owner@example.com', 'AllonaHub founder', 'active')
on conflict do nothing;
```

Use lowercase email values. If no env allowlist and no active `super_admin_owner_access` row exists, `/v1/super-admin/*` returns a fail-closed error.

For strict Supabase RLS and role-grant workflows, the `super_admin_owner_access` row is mandatory. The backend env allowlist protects API access; the DB owner row lets `public.is_super_admin()` and `public.super_admin_update_profile_permission(...)` verify the owner inside Supabase.

## Permission Grants

Role, account status and risk changes must go through:

```http
PATCH /v1/super-admin/permissions/:userId
```

The backend requires a reason and calls the security-definer RPC:

```sql
public.super_admin_update_profile_permission(...)
```

Guardrails:

- The active owner cannot demote or suspend their own Super Admin session.
- `super_admin` can only be granted to a user already present in `super_admin_owner_access`.
- Every successful permission change is written to `super_admin_permission_changes` and `security_audit_events`.

## Module Operation Map

`/v1/super-admin/module-map` mirrors the current homepage module set and overlays database state from `platform_modules`.

The map includes commerce, transport, finance, legal, health, real estate, automotive, education, career, logistics, hospitality, trade and other current/future ecosystem modules. Critical module releases should still be approved through Release Approval / GitOps.

## Release Approval / GitOps

The browser never receives GitHub, Supabase, server, or service-role secrets. Owner approval creates an audited row in `super_admin_release_approvals`.

To dispatch approvals to a secure deploy/CI worker:

```env
SUPER_ADMIN_GITOPS_ENABLED=true
SUPER_ADMIN_RELEASE_WEBHOOK_URL="https://deploy-worker.example.com/allonahub/super-admin-release"
SUPER_ADMIN_RELEASE_WEBHOOK_SECRET="long-random-shared-secret"
SUPER_ADMIN_RELEASE_WEBHOOK_TIMEOUT_MS=12000
```

The webhook receiver must verify `X-Allona-Super-Admin-Secret` before it runs any GitHub Actions dispatch, deploy, migration, commit, push, or publish operation.
