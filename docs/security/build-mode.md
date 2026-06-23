# AllonaHub Build Mode

Build Mode is a temporary launch-building profile for reducing development friction without deleting the security architecture.

Enable it only while the site is still being assembled:

```env
APP_SECURITY_MODE=build
```

Return to production hardening before public launch:

```env
APP_SECURITY_MODE=production
```

## Relaxed In Build Mode

- Turnstile verification is bypassed server-side.
- Frontend Turnstile widgets are hidden when `window.Allona.config.securityMode` is `build`.
- Admin and Super Admin MFA enforcement is bypassed server-side.
- Admin permission assignment fallback uses `ops_default` for admin-role users.
- Admin host/IP boundary checks are skipped.
- API rate limits are raised.
- Auto-defense active blocking is disabled.

## Still Enforced

- Authentication is still required for authenticated endpoints.
- Backend role checks still separate user, partner, courier, admin, and super_admin.
- Super Admin routes still require the `super_admin` role.
- Supabase RLS and database policies remain active.
- Service role and server secrets remain server-only.
- Secret redaction remains active.
- Payment and order flows still run through backend APIs.
- Audit logging remains active unless explicitly disabled separately.

## Frontend Switch

For static frontend builds, update:

```js
window.Allona.config.securityMode = "build";
```

For production:

```js
window.Allona.config.securityMode = "production";
```

Do not remove Turnstile code or MFA code. Build Mode only pauses enforcement.
