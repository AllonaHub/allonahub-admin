#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanMarketplaceCode,
  cleanMarketplaceText,
  hasMarketplaceBranding
} from "../src/lib/marketplace-branding.js";

function parseEnvValue(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function loadEnvFile(filePath) {
  if (!filePath || !existsSync(filePath)) return false;
  const text = readFileSync(filePath, "utf8");
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) return;
    const [, key, rawValue] = match;
    if (!process.env[key]) process.env[key] = parseEnvValue(rawValue);
  });
  return true;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
[
  process.env.ENV_FILE,
  resolve(process.cwd(), "deploy/hetzner/.env.production"),
  resolve(repoRoot, "deploy/hetzner/.env.production")
].some(loadEnvFile);

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "1"];
  })
);

const supabaseUrl = parseEnvValue(process.env.SUPABASE_URL || process.env.ALLONA_SUPABASE_URL).replace(/\/$/, "");
const serviceRoleKey = parseEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ALLONA_SUPABASE_SERVICE_ROLE_KEY);
const dryRun = args.get("dry-run") !== "0";
const pageSize = Math.max(1, Math.min(Number(args.get("page-size") || 1000), 1000));
const maxRows = Math.max(1, Math.min(Number(args.get("limit") || 5000), 50000));
const startOffset = Math.max(0, Number(args.get("offset") || 0));

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

const restApiUrl = `${supabaseUrl}/rest/v1`;
const authHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`
};
let productOrder = "updated_at.desc.nullslast";
let productOrderNoticeShown = false;

const TEXT_FIELDS = [
  "name",
  "product_name",
  "description",
  "meta_title",
  "meta_description",
  "brand",
  "category",
  "seller_disclosure",
  "invoice_responsibility"
];
const CODE_FIELDS = ["sku", "barcode"];

function cleanComplianceNotes(value) {
  const raw = String(value || "");
  if (!hasMarketplaceBranding(raw)) return raw;
  const cleaned = cleanMarketplaceText(raw)
    .replace(/Entegrasyon importu:\s*[. ]*/iu, "Entegrasyon importu: kaynak platformdan ürün çekildi. ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || "Entegrasyon importu: kaynak platformdan ürün çekildi.";
}

function cleanedProductPatch(product = {}) {
  const patch = {};
  const changedFields = [];

  for (const field of TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(product, field)) continue;
    const previous = String(product[field] ?? "");
    if (!previous || !hasMarketplaceBranding(previous)) continue;
    const cleaned = cleanMarketplaceText(previous);
    if (cleaned && cleaned !== previous) {
      patch[field] = cleaned;
      changedFields.push(field);
    }
  }

  for (const field of CODE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(product, field)) continue;
    const previous = String(product[field] ?? "");
    if (!previous || !hasMarketplaceBranding(previous)) continue;
    const cleaned = cleanMarketplaceCode(previous);
    if (cleaned !== previous) {
      patch[field] = cleaned || null;
      changedFields.push(field);
    }
  }

  const previousSlug = String(product.slug || "");
  if (previousSlug && hasMarketplaceBranding(previousSlug)) {
    const base = cleanMarketplaceCode(product.name || product.product_name || previousSlug) || `urun-${product.id || ""}`;
    const cleaned = `${base.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşıöç]+/gi, "-").replace(/^-+|-+$/g, "")}-${product.id || ""}`.slice(0, 180);
    if (cleaned && cleaned !== previousSlug) {
      patch.slug = cleaned;
      changedFields.push("slug");
    }
  }

  if (Object.prototype.hasOwnProperty.call(product, "compliance_notes")) {
    const previous = String(product.compliance_notes ?? "");
    const cleaned = cleanComplianceNotes(previous);
    if (cleaned && cleaned !== previous) {
      patch.compliance_notes = cleaned.slice(0, 1200);
      changedFields.push("compliance_notes");
    }
  }

  return { patch, changedFields };
}

class SupabaseRequestError extends Error {
  constructor(path, options, status, body) {
    super(`${options.method || "GET"} ${path}: HTTP ${status} ${String(body || "").slice(0, 500)}`);
    this.name = "SupabaseRequestError";
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

function isMissingColumnError(error, column) {
  return (
    error instanceof SupabaseRequestError &&
    error.status === 400 &&
    String(error.body || "").includes(`column products.${column} does not exist`)
  );
}

async function request(path, options = {}) {
  const response = await fetch(`${restApiUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    throw new SupabaseRequestError(path, options, response.status, text);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function listProducts(limit, offset) {
  const params = new URLSearchParams({
    select: "*",
    order: productOrder,
    limit: String(limit),
    offset: String(offset)
  });
  try {
    return await request(`/products?${params.toString()}`);
  } catch (error) {
    if (!isMissingColumnError(error, "updated_at")) throw error;
    productOrder = "created_at.desc.nullslast";
    if (!productOrderNoticeShown) {
      console.warn("products.updated_at not found; using products.created_at order.");
      productOrderNoticeShown = true;
    }
    params.set("order", productOrder);
    return request(`/products?${params.toString()}`);
  }
}

async function updateProduct(id, patch) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  return request(`/products?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: patch
  });
}

let scanned = 0;
let matched = 0;
let updated = 0;
let failed = 0;
const examples = [];

for (let offset = startOffset; scanned < maxRows; offset += pageSize) {
  const rows = await listProducts(Math.min(pageSize, maxRows - scanned), offset);
  if (!Array.isArray(rows) || rows.length === 0) break;
  scanned += rows.length;

  for (const product of rows) {
    const { patch, changedFields } = cleanedProductPatch(product);
    if (!changedFields.length) continue;
    matched += 1;
    examples.push({
      id: product.id,
      name: product.name || product.product_name || "",
      changed_fields: changedFields,
      sku_before: product.sku || "",
      sku_after: patch.sku || product.sku || "",
      barcode_before: product.barcode || "",
      barcode_after: patch.barcode || product.barcode || ""
    });

    if (dryRun) continue;
    try {
      await updateProduct(product.id, patch);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed ${product.id}: ${error.message}`);
    }
  }

  if (rows.length < pageSize) break;
}

console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
console.log(`Scanned: ${scanned}`);
console.log(`Matched: ${matched}`);
console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
console.log("Price, stock, images, media, integration credentials and integration_source were not changed.");
console.log(JSON.stringify(examples.slice(0, 25), null, 2));
