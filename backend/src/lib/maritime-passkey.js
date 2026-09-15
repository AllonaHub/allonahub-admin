import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase.js";

const proofPattern = /^[A-Za-z0-9_-]{43,128}$/;

function passkeyError(message, statusCode = 403, code = "MARITIME_PASSKEY_VERIFICATION_REQUIRED") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

export function maritimePasskeyProofHash(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

export async function requireMaritimePasskeyProof(request, userId, scope = "maritime_sensitive") {
  const proof = String(request.headers["x-allona-passkey-proof"] || "").trim();
  if (!proofPattern.test(proof)) {
    throw passkeyError("Bu işlem için cihazınızda Touch ID, Face ID veya ekran kilidi doğrulaması yapın.");
  }

  const result = await supabaseAdmin.rpc("maritime_consume_passkey_proof", {
    p_user_id: userId,
    p_proof_hash: maritimePasskeyProofHash(proof),
    p_scope: scope
  });
  if (result.error) {
    throw passkeyError("Cihaz doğrulama hizmeti şu anda kullanılamıyor.", 503, "MARITIME_PASSKEY_SECURITY_UNAVAILABLE");
  }
  if (result.data !== true) {
    throw passkeyError("Cihaz doğrulamasının süresi doldu. Touch ID, Face ID veya ekran kilidiyle yeniden doğrulayın.");
  }
  return true;
}
