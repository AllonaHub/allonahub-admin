import { randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";
import { z } from "zod";
import { config } from "../config.js";
import { ensureMaritimeCustomerProfile } from "../lib/maritime-customer-profile.js";
import { maritimePasskeyProofHash } from "../lib/maritime-passkey.js";
import { auditEvent, authContext, hasRole, supabaseAdmin } from "../lib/supabase.js";

const base64Url = z.string().min(1).max(262144).regex(/^[A-Za-z0-9_-]+$/);
const challengeParamsSchema = z.object({ challenge_id: z.string().uuid() }).strict();
const registrationCredentialSchema = z.object({
  id: base64Url.max(2048),
  rawId: base64Url.max(2048),
  type: z.literal("public-key"),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).nullable().optional(),
  clientExtensionResults: z.record(z.unknown()).optional().default({}),
  response: z.object({
    clientDataJSON: base64Url.max(16384),
    attestationObject: base64Url,
    transports: z.array(z.string().max(32)).max(16).optional()
  }).passthrough()
}).passthrough();
const authenticationCredentialSchema = z.object({
  id: base64Url.max(2048),
  rawId: base64Url.max(2048),
  type: z.literal("public-key"),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).nullable().optional(),
  clientExtensionResults: z.record(z.unknown()).optional().default({}),
  response: z.object({
    authenticatorData: base64Url.max(16384),
    clientDataJSON: base64Url.max(16384),
    signature: base64Url.max(16384),
    userHandle: base64Url.max(2048).nullable().optional()
  }).passthrough()
}).passthrough();
const registrationVerificationSchema = z.object({
  ...challengeParamsSchema.shape,
  credential: registrationCredentialSchema
}).strict();
const authenticationVerificationSchema = z.object({
  ...challengeParamsSchema.shape,
  credential: authenticationCredentialSchema
}).strict();

function httpError(message, statusCode = 400, code = "MARITIME_PASSKEY_REQUEST_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

function assertDb(result, message) {
  if (result.error) throw httpError(message, 503, "MARITIME_PASSKEY_DATABASE_ERROR");
  return result.data;
}

async function requireCustomer(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user) throw httpError("Oturum doğrulanamadı.", 401, "AUTH_REQUIRED");
  if (!hasRole(ctx.profile, "customer")) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.passkey_access_denied",
      severity: "warning",
      resourceType: "maritime_passkey",
      metadata: { requested_action: action }
    });
    throw httpError("Bu güvenlik alanı yalnız kişisel denizci hesaplarına açıktır.", 403, "CUSTOMER_ACCOUNT_REQUIRED");
  }
  return ensureMaritimeCustomerProfile(ctx);
}

function requestDeviceKey(request) {
  const value = String(request.headers["x-allona-device-key"] || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw httpError("Güvenli cihaz tanımlaması tamamlanamadı.", 400, "MARITIME_DEVICE_KEY_REQUIRED");
  }
  return value;
}

function requestWebAuthnContext(request) {
  const origin = String(request.headers.origin || "").trim().replace(/\/$/, "");
  let hostname = "";
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    throw httpError("Cihaz doğrulama kaynağı geçersiz.", 403, "MARITIME_PASSKEY_ORIGIN_REJECTED");
  }
  const configuredRpId = config.webauthn.rpId;
  const productionRp = hostname === configuredRpId || hostname.endsWith(`.${configuredRpId}`);
  const localRp = config.env !== "production" && ["localhost", "127.0.0.1"].includes(hostname);
  if (!config.webauthn.allowedOrigins.includes(origin) && !localRp) {
    throw httpError("Bu kaynaktan cihaz doğrulaması yapılamaz.", 403, "MARITIME_PASSKEY_ORIGIN_REJECTED");
  }
  if (!productionRp && !localRp) {
    throw httpError("Cihaz doğrulama alan adı geçersiz.", 403, "MARITIME_PASSKEY_RP_REJECTED");
  }
  return { origin, rpId: productionRp ? configuredRpId : hostname };
}

async function checkDeviceAccess(userId, deviceKey) {
  const result = await supabaseAdmin.rpc("maritime_check_device_access", {
    p_user_id: userId,
    p_device_key: deviceKey
  });
  if (result.error) throw httpError("Cihaz güvenlik kaydı doğrulanamadı.", 503, "MARITIME_PASSKEY_SECURITY_UNAVAILABLE");
  const access = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
  if (access?.allowed !== true) {
    throw httpError("Bu cihaz başka bir hesaba bağlıdır.", 409, "MARITIME_DEVICE_ALREADY_BOUND");
  }
}

async function createChallenge(userId, ceremony, challenge, context) {
  const expiresAt = new Date(Date.now() + config.webauthn.challengeTtlSeconds * 1000).toISOString();
  await supabaseAdmin
    .from("maritime_passkey_challenges")
    .delete()
    .eq("user_id", userId)
    .eq("ceremony", ceremony)
    .is("consumed_at", null);
  return assertDb(await supabaseAdmin
    .from("maritime_passkey_challenges")
    .insert({
      user_id: userId,
      ceremony,
      challenge,
      origin: context.origin,
      rp_id: context.rpId,
      expires_at: expiresAt
    })
    .select("id")
    .single(), "Cihaz doğrulama isteği oluşturulamadı.");
}

async function consumeChallenge(userId, challengeId, ceremony) {
  const now = new Date().toISOString();
  const challenge = assertDb(await supabaseAdmin
    .from("maritime_passkey_challenges")
    .update({ consumed_at: now })
    .eq("id", challengeId)
    .eq("user_id", userId)
    .eq("ceremony", ceremony)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("id,challenge,origin,rp_id")
    .maybeSingle(), "Cihaz doğrulama isteği okunamadı.");
  if (!challenge) throw httpError("Cihaz doğrulama isteğinin süresi doldu.", 409, "MARITIME_PASSKEY_CHALLENGE_EXPIRED");
  return challenge;
}

async function credentialForUser(userId) {
  return assertDb(await supabaseAdmin
    .from("maritime_passkey_credentials")
    .select("credential_id,public_key,counter,transports,credential_device_type,credential_backed_up,authenticator_attachment,created_at,last_used_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle(), "Cihaz anahtarı okunamadı.");
}

async function issueProof(userId) {
  const proof = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.webauthn.proofTtlSeconds * 1000).toISOString();
  assertDb(await supabaseAdmin.from("maritime_passkey_proofs").insert({
    user_id: userId,
    proof_hash: maritimePasskeyProofHash(proof),
    scope: "maritime_sensitive",
    expires_at: expiresAt
  }), "Cihaz doğrulama kanıtı oluşturulamadı.");
  return { proof, expires_at: expiresAt };
}

function publicCredential(row) {
  return {
    id: row.credential_id,
    publicKey: new Uint8Array(Buffer.from(row.public_key, "base64")),
    counter: Number(row.counter) || 0,
    transports: Array.isArray(row.transports) ? row.transports : []
  };
}

export function registerMaritimePasskeyRoutes(app) {
  app.get("/v1/maritime/passkey/status", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.passkey.status");
    requestWebAuthnContext(request);
    const credential = await credentialForUser(ctx.user.id);
    return {
      ok: true,
      enrolled: Boolean(credential),
      credential: credential ? {
        credential_device_type: credential.credential_device_type,
        credential_backed_up: credential.credential_backed_up === true,
        authenticator_attachment: credential.authenticator_attachment,
        created_at: credential.created_at,
        last_used_at: credential.last_used_at
      } : null
    };
  });

  app.post("/v1/maritime/passkey/registration/options", {
    config: { rateLimit: { max: 5, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.passkey.registration_options");
    const deviceKey = requestDeviceKey(request);
    const context = requestWebAuthnContext(request);
    await checkDeviceAccess(ctx.user.id, deviceKey);
    if (await credentialForUser(ctx.user.id)) {
      throw httpError("Bu hesap için cihaz anahtarı zaten oluşturulmuştur.", 409, "MARITIME_PASSKEY_ALREADY_ENROLLED");
    }
    const options = await generateRegistrationOptions({
      rpName: config.webauthn.rpName,
      rpID: context.rpId,
      userID: new TextEncoder().encode(ctx.user.id),
      userName: String(ctx.user.email || ctx.user.id),
      userDisplayName: String(ctx.profile?.full_name || ctx.user.email || "AllonaHub Denizci"),
      timeout: 120000,
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required"
      },
      supportedAlgorithmIDs: [-7, -257]
    });
    const challenge = await createChallenge(ctx.user.id, "registration", options.challenge, context);
    return { ok: true, challenge_id: challenge.id, options };
  });

  app.post("/v1/maritime/passkey/registration/verify", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.passkey.registration_verify");
    const deviceKey = requestDeviceKey(request);
    const input = registrationVerificationSchema.parse(request.body || {});
    const challenge = await consumeChallenge(ctx.user.id, input.challenge_id, "registration");
    await checkDeviceAccess(ctx.user.id, deviceKey);
    if (input.credential.authenticatorAttachment && input.credential.authenticatorAttachment !== "platform") {
      throw httpError("Yalnız bu cihazın ekran kilidi veya biyometrik doğrulaması kullanılabilir.", 409, "MARITIME_PLATFORM_AUTHENTICATOR_REQUIRED");
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: input.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
        requireUserPresence: true,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257]
      });
    } catch {
      throw httpError("Cihaz anahtarı doğrulanamadı.", 400, "MARITIME_PASSKEY_VERIFICATION_FAILED");
    }
    if (!verification.verified || !verification.registrationInfo?.userVerified) {
      throw httpError("Cihaz anahtarı doğrulanamadı.", 400, "MARITIME_PASSKEY_VERIFICATION_FAILED");
    }
    const info = verification.registrationInfo;
    const saved = await supabaseAdmin.from("maritime_passkey_credentials").insert({
      credential_id: info.credential.id,
      user_id: ctx.user.id,
      public_key: Buffer.from(info.credential.publicKey).toString("base64"),
      counter: info.credential.counter,
      transports: input.credential.response.transports || [],
      credential_device_type: info.credentialDeviceType,
      credential_backed_up: info.credentialBackedUp,
      authenticator_attachment: input.credential.authenticatorAttachment || "platform",
      aaguid: info.aaguid
    });
    if (saved.error) {
      throw httpError("Bu cihaz anahtarı veya hesap daha önce kaydedilmiştir.", 409, "MARITIME_PASSKEY_ALREADY_ENROLLED");
    }
    const bound = await supabaseAdmin.rpc("maritime_bind_device_to_user", {
      p_user_id: ctx.user.id,
      p_device_key: deviceKey,
      p_binding_source: "account_access",
      p_user_agent: String(request.headers["user-agent"] || "").slice(0, 500)
    });
    if (bound.error) throw httpError("Cihaz hesabınıza bağlanamadı.", 503, "MARITIME_PASSKEY_SECURITY_UNAVAILABLE");
    const proof = await issueProof(ctx.user.id);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.passkey_registered",
      resourceType: "maritime_passkey",
      metadata: {
        credential_device_type: info.credentialDeviceType,
        credential_backed_up: info.credentialBackedUp,
        authenticator_attachment: input.credential.authenticatorAttachment || "platform"
      }
    });
    return { ok: true, enrolled: true, ...proof };
  });

  app.post("/v1/maritime/passkey/authentication/options", {
    config: { rateLimit: { max: 12, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.passkey.authentication_options");
    requestDeviceKey(request);
    const context = requestWebAuthnContext(request);
    const credential = await credentialForUser(ctx.user.id);
    if (!credential) {
      throw httpError("Önce bu hesap için güvenli cihaz anahtarı oluşturun.", 409, "MARITIME_PASSKEY_ENROLLMENT_REQUIRED");
    }
    const options = await generateAuthenticationOptions({
      rpID: context.rpId,
      timeout: 120000,
      userVerification: "required",
      allowCredentials: [{ id: credential.credential_id, transports: credential.transports || [] }]
    });
    const challenge = await createChallenge(ctx.user.id, "authentication", options.challenge, context);
    return { ok: true, challenge_id: challenge.id, options };
  });

  app.post("/v1/maritime/passkey/authentication/verify", {
    config: { rateLimit: { max: 15, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.passkey.authentication_verify");
    const deviceKey = requestDeviceKey(request);
    const input = authenticationVerificationSchema.parse(request.body || {});
    const challenge = await consumeChallenge(ctx.user.id, input.challenge_id, "authentication");
    const credential = await credentialForUser(ctx.user.id);
    if (!credential || credential.credential_id !== input.credential.id) {
      throw httpError("Bu hesap için kayıtlı cihaz anahtarı bulunamadı.", 409, "MARITIME_PASSKEY_NOT_FOUND");
    }
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: input.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
        credential: publicCredential(credential),
        requireUserVerification: true
      });
    } catch {
      throw httpError("Cihaz doğrulaması başarısız oldu.", 400, "MARITIME_PASSKEY_VERIFICATION_FAILED");
    }
    if (!verification.verified || !verification.authenticationInfo?.userVerified) {
      throw httpError("Cihaz doğrulaması başarısız oldu.", 400, "MARITIME_PASSKEY_VERIFICATION_FAILED");
    }
    assertDb(await supabaseAdmin
      .from("maritime_passkey_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        credential_device_type: verification.authenticationInfo.credentialDeviceType,
        credential_backed_up: verification.authenticationInfo.credentialBackedUp,
        last_used_at: new Date().toISOString()
      })
      .eq("credential_id", credential.credential_id)
      .eq("user_id", ctx.user.id), "Cihaz anahtarı güncellenemedi.");
    const bound = await supabaseAdmin.rpc("maritime_bind_device_to_user", {
      p_user_id: ctx.user.id,
      p_device_key: deviceKey,
      p_binding_source: "account_access",
      p_user_agent: String(request.headers["user-agent"] || "").slice(0, 500)
    });
    if (bound.error) {
      throw httpError("Bu cihaz başka bir hesaba bağlıdır.", 409, "MARITIME_DEVICE_ALREADY_BOUND");
    }
    const proof = await issueProof(ctx.user.id);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.passkey_verified",
      resourceType: "maritime_passkey",
      metadata: {
        credential_device_type: verification.authenticationInfo.credentialDeviceType,
        credential_backed_up: verification.authenticationInfo.credentialBackedUp
      }
    });
    return { ok: true, verified: true, ...proof };
  });
}
