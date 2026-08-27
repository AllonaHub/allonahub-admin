import { EInvoicingError } from "./errors.js";

const REFERENCE_PATTERN = /^(vault|env|secret):([A-Za-z0-9_./:-]+)$/;
const INVOICE_ENV_PATTERN = /^INVOICE_[A-Z0-9_]+$/;

export function parseCredentialReference(reference) {
  const input = String(reference || "").trim();
  const match = input.match(REFERENCE_PATTERN);
  if (!match) {
    throw new EInvoicingError("Credential reference biçimi geçersiz.", {
      code: "INVALID_CREDENTIAL_REFERENCE",
      statusCode: 422
    });
  }
  if (["env", "secret"].includes(match[1]) && !INVOICE_ENV_PATTERN.test(match[2])) {
    throw new EInvoicingError("Credential environment anahtarı INVOICE_ önekiyle sınırlandırılmıştır.", {
      code: "CREDENTIAL_REFERENCE_SCOPE_DENIED",
      statusCode: 422
    });
  }
  return Object.freeze({ kind: match[1], identifier: match[2], reference: `${match[1]}:${match[2]}` });
}

export async function assertCredentialBinding({
  db,
  reference,
  organizationId,
  legalEntityId,
  integrationType,
  integrationKey,
  purpose = "api"
}) {
  const parsed = parseCredentialReference(reference);
  if (!db) {
    throw new EInvoicingError("Credential binding store yapılandırılmadı.", {
      code: "CREDENTIAL_BINDING_STORE_UNAVAILABLE",
      statusCode: 503
    });
  }
  const result = await db.from("integration_credential_bindings")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("legal_entity_id", legalEntityId)
    .eq("integration_type", integrationType)
    .eq("integration_key", integrationKey)
    .eq("purpose", purpose)
    .eq("credential_reference", parsed.reference)
    .in("status", ["active", "rotating"])
    .maybeSingle();
  if (result.error) {
    throw new EInvoicingError("Credential binding doğrulanamadı.", {
      code: "CREDENTIAL_BINDING_LOOKUP_FAILED",
      statusCode: 503
    });
  }
  if (!result.data) {
    throw new EInvoicingError("Credential reference bu tenant ve entegrasyon için yetkilendirilmemiş.", {
      code: "CREDENTIAL_BINDING_REQUIRED",
      statusCode: 403
    });
  }
  return { ...parsed, bindingId: result.data.id, bindingStatus: result.data.status };
}

export async function resolveBoundCredential(binding, options = {}) {
  await assertCredentialBinding(binding);
  return (options.store || new CredentialStore(options.storeOptions)).resolve(binding.reference);
}

export class CredentialStore {
  constructor(options = {}) {
    this.environment = options.environment || process.env;
    // In container/Edge deployments secret-manager values are injected into
    // the server environment. `secret:` remains a semantic reference while
    // never reading from frontend or database plaintext.
    this.secrets = options.secrets || this.environment;
    this.vaultResolver = options.vaultResolver;
  }

  describe(reference) {
    const parsed = parseCredentialReference(reference);
    return { reference: parsed.reference, kind: parsed.kind, configured: true };
  }

  async resolve(reference) {
    const parsed = parseCredentialReference(reference);
    let value = "";
    if (parsed.kind === "env") value = this.environment[parsed.identifier] || "";
    if (parsed.kind === "secret") value = this.secrets[parsed.identifier] || "";
    if (parsed.kind === "vault") {
      if (typeof this.vaultResolver !== "function") {
        throw new EInvoicingError("Vault credential resolver yapılandırılmadı.", {
          code: "CREDENTIAL_STORE_UNAVAILABLE",
          statusCode: 503
        });
      }
      value = await this.vaultResolver(parsed.identifier);
    }
    if (!value) {
      throw new EInvoicingError("Credential reference çözümlenemedi.", {
        code: "CREDENTIAL_NOT_FOUND",
        statusCode: 503
      });
    }
    return String(value);
  }
}
