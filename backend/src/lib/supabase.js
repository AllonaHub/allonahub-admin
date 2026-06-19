import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export function supabaseForUser(jwt) {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function bearerToken(request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

export const APP_ROLES = ["customer", "partner", "courier", "admin", "super_admin"];

function decodeJwtClaims(token) {
  try {
    const [, payload] = String(token).split(".");
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

export function normalizeRole(role) {
  const normalized = String(role || "customer").trim().toLowerCase();
  return APP_ROLES.includes(normalized) ? normalized : "customer";
}

export function hasRole(profile, roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.map(normalizeRole).includes(normalizeRole(profile?.role));
}

export function hasMfa(ctx) {
  return ctx?.authenticatorAssuranceLevel === "aal2";
}

export function mfaRequiredForRole(role) {
  return config.mfaRequiredRoles.includes(normalizeRole(role));
}

export async function authContext(request) {
  const token = bearerToken(request);
  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    request.log.warn({ error: error?.message }, "Supabase auth failed");
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("id", data.user.id)
      .maybeSingle();

  if (profileError) {
    request.log.warn({ error: profileError.message, userId: data.user.id }, "Profile lookup failed");
  }

  const claims = decodeJwtClaims(token);
  const role = normalizeRole(profile?.role || data.user.app_metadata?.role);
  const aal = String(claims.aal || data.user.aal || "aal1").toLowerCase();

  return {
    jwt: token,
    user: data.user,
    profile: { ...(profile || { id: data.user.id }), role },
    jwtClaims: claims,
    authenticatorAssuranceLevel: aal,
    mfaVerified: aal === "aal2",
    db: supabaseForUser(token)
  };
}

export function isAdmin(profile) {
  return hasRole(profile, ["admin", "super_admin"]);
}

export function isSuperAdmin(profile) {
  return hasRole(profile, "super_admin");
}

export function isPartner(profile) {
  return hasRole(profile, ["partner", "admin", "super_admin"]);
}

export function isCourier(profile) {
  return hasRole(profile, ["courier", "admin", "super_admin"]);
}

export async function auditEvent({
  request,
  actorId = null,
  actorRole = null,
  action,
  resourceType = null,
  resourceId = null,
  severity = "info",
  metadata = {}
}) {
  if (!config.auditEnabled || !action) return;

  const ip = String(request?.headers?.["cf-connecting-ip"] || request?.ip || "").split(",")[0].trim();
  const userAgent = String(request?.headers?.["user-agent"] || "").slice(0, 500);
  const requestId = request?.id ? String(request.id) : null;

  const { error } = await supabaseAdmin
    .from("security_audit_events")
    .insert({
      actor_id: actorId,
      actor_role: actorRole,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      severity,
      ip_address: ip || null,
      user_agent: userAgent || null,
      request_id: requestId,
      metadata: metadata || {}
    });

  if (error) {
    request?.log?.warn({ error: error.message, action }, "Security audit event could not be persisted");
  }
}
