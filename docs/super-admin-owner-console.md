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
