import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";

function encryptionKey() {
  const value = config.socialMedia.secretEncryptionKey || "";
  if (!value) return null;
  return createHash("sha256").update(value).digest();
}

function vaultError() {
  const error = new Error("Secret vault aktif degil. Once SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY server secret olarak girilmeli.");
  error.statusCode = 503;
  return error;
}

export function secretVaultStatus() {
  return {
    enabled: Boolean(encryptionKey()),
    cipher: "aes-256-gcm",
    key_source: "SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY"
  };
}

export function encryptSecretValue(value, context = "") {
  const key = encryptionKey();
  if (!key) throw vaultError();

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (context) cipher.setAAD(Buffer.from(context, "utf8"));
  const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decryptSecretValue(encoded, context = "") {
  const key = encryptionKey();
  if (!key) throw vaultError();

  const [version, iv, tag, encrypted] = String(encoded || "").split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    const error = new Error("Secret kaydi okunamadi.");
    error.statusCode = 500;
    throw error;
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  if (context) decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
