import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { config } from "../config.js";

export const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    transport: WebSocket
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
    },
    realtime: {
      transport: WebSocket
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

const SENSITIVE_METADATA_KEYS = [
  "authorization",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "token",
  "card_number",
  "card_cvc",
  "card_cvv",
  "cvc",
  "cvv",
  "cookie",
  "set-cookie",
  "iban"
];

function shouldRedactKey(key) {
  const normalized = String(key || "").toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((item) => normalized.includes(item));
}

function redactMetadata(value, depth = 0) {
  if (depth > 5) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => redactMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 120)
        .map(([key, item]) => [key, shouldRedactKey(key) ? "[redacted]" : redactMetadata(item, depth + 1)])
    );
  }
  if (typeof value === "string") return value.slice(0, 4000);
  return value;
}

function requestAuditMetadata(request) {
  if (!request) return {};
  return {
    method: request.method || null,
    path: String(request.url || "").split("?")[0] || null,
    host: request.headers?.host || null,
    origin: request.headers?.origin || null,
    referer: request.headers?.referer || request.headers?.referrer || null,
    cf_ray: request.headers?.["cf-ray"] || null
  };
}

function sanitizeEvidenceTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").trim().toLowerCase().replace(/[^a-z0-9_.:-]/g, "_").slice(0, 60))
    .filter(Boolean))]
    .slice(0, 20);
}

function sanitizeLocation(location) {
  if (!location || typeof location !== "object") return {};
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = Number(location.accuracy_m ?? location.accuracy);
  const result = {};
  if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90) result.latitude = latitude;
  if (Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) result.longitude = longitude;
  if (Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100000) result.accuracy_m = accuracy;
  ["country", "region", "city"].forEach((key) => {
    const value = String(location[key] || "").trim();
    if (value) result[key] = value.slice(0, key === "city" ? 120 : 80);
  });
  return result;
}

function auditErrorLooksLikeMissingMigration(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  return /append_security_audit_event|schema cache|could not find|does not exist|column .* does not exist|PGRST202/i.test(message);
}

async function fallbackAuditInsert(row, request) {
  const { error: extendedError } = await supabaseAdmin
    .from("security_audit_events")
    .insert(row);

  if (!extendedError) return;
  if (!auditErrorLooksLikeMissingMigration(extendedError)) {
    request?.log?.warn({ error: extendedError.message, action: row.action }, "Security audit event could not be persisted");
    return;
  }

  const {
    source,
    purpose,
    location_basis,
    geo_country,
    geo_region,
    geo_city,
    geo_latitude,
    geo_longitude,
    geo_accuracy_m,
    retention_until,
    evidence_tags,
    ...legacyRow
  } = row;
  const { error: legacyError } = await supabaseAdmin
    .from("security_audit_events")
    .insert(legacyRow);

  if (legacyError) {
    request?.log?.warn({ error: legacyError.message, action: row.action }, "Security audit event could not be persisted");
  }
}

export async function auditEvent({
  request,
  actorId = null,
  actorRole = null,
  action,
  resourceType = null,
  resourceId = null,
  severity = "info",
  metadata = {},
  source = "backend",
  purpose = "security_audit",
  locationBasis = "none",
  location = null,
  evidenceTags = [],
  retentionDays = 365
}) {
  if (!config.auditEnabled || !action) return;

  const ip = String(request?.headers?.["cf-connecting-ip"] || request?.ip || "").split(",")[0].trim();
  const userAgent = String(request?.headers?.["user-agent"] || "").slice(0, 500);
  const requestId = request?.id ? String(request.id) : null;
  const cleanLocation = sanitizeLocation(location);
  const cleanLocationBasis = Object.keys(cleanLocation).length ? locationBasis : "none";
  const cleanMetadata = redactMetadata({
    ...(metadata || {}),
    request_context: requestAuditMetadata(request)
  });
  const cleanEvidenceTags = sanitizeEvidenceTags(evidenceTags);
  const cleanRetentionDays = Math.max(30, Math.min(Number(retentionDays || 365), 3650));

  const rpcPayload = {
    p_actor_id: actorId,
    p_actor_role: actorRole,
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_severity: severity,
    p_ip_address: ip || null,
    p_user_agent: userAgent || null,
    p_request_id: requestId,
    p_metadata: cleanMetadata,
    p_source: source,
    p_purpose: purpose,
    p_location_basis: cleanLocationBasis,
    p_location: cleanLocation,
    p_evidence_tags: cleanEvidenceTags,
    p_retention_days: cleanRetentionDays
  };

  const { error: rpcError } = await supabaseAdmin.rpc("append_security_audit_event", rpcPayload);
  if (!rpcError) return;

  if (!auditErrorLooksLikeMissingMigration(rpcError)) {
    request?.log?.warn({ error: rpcError.message, action }, "Security audit RPC failed; using fallback insert");
  }

  await fallbackAuditInsert({
    actor_id: actorId,
    actor_role: actorRole,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    severity,
    ip_address: ip || null,
    user_agent: userAgent || null,
    request_id: requestId,
    metadata: cleanMetadata,
    source,
    purpose,
    location_basis: cleanLocationBasis,
    geo_country: cleanLocation.country || null,
    geo_region: cleanLocation.region || null,
    geo_city: cleanLocation.city || null,
    geo_latitude: cleanLocation.latitude ?? null,
    geo_longitude: cleanLocation.longitude ?? null,
    geo_accuracy_m: cleanLocation.accuracy_m ?? null,
    retention_until: new Date(Date.now() + cleanRetentionDays * 24 * 60 * 60 * 1000).toISOString(),
    evidence_tags: cleanEvidenceTags
  }, request);
}
