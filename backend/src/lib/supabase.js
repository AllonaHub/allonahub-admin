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

  return {
    jwt: token,
    user: data.user,
    profile: profile || { id: data.user.id, role: "customer" },
    db: supabaseForUser(token)
  };
}

export function isAdmin(profile) {
  return ["admin", "super_admin"].includes(profile?.role);
}

export function isPartner(profile) {
  return ["partner", "admin", "super_admin"].includes(profile?.role);
}
