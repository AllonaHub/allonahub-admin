#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

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
const bucket = args.get("bucket") || process.env.PRODUCT_IMAGE_STORAGE_BUCKET || "product-images";
const prefix = String(args.get("prefix") || "products").replace(/^\/+|\/+$/g, "");
const optimizedPrefix = String(args.get("optimized-prefix") || `${prefix}/optimized`).replace(/^\/+|\/+$/g, "");
const proxyBaseUrl = String(
  args.get("proxy-base-url") ||
  process.env.PRODUCT_IMAGE_PROXY_BASE_URL ||
  "https://api.allonahub.com/v1/media/product-images"
).replace(/\/$/, "");
const maxWidth = Math.max(320, Math.min(Number(args.get("max-width") || 1200), 2400));
const quality = Math.max(45, Math.min(Number(args.get("quality") || 78), 95));
const limit = Math.max(1, Math.min(Number(args.get("limit") || 100), 1000));
const dryRun = args.get("dry-run") !== "0";
const updateDb = args.get("update-db") !== "0";
const deleteOriginals = args.get("delete-originals") === "1";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

const sharp = (await import("sharp")).default;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    transport: WebSocket
  }
});

function bytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function safeStoragePath(path) {
  const normalized = String(path || "").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.length > 900 ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    normalized.includes("//") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..") ||
    !/^[a-z0-9._/-]+$/i.test(normalized)
  ) {
    return "";
  }
  return normalized;
}

function encodedPath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function storagePathFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith(`${prefix}/`)) return safeStoragePath(raw);

  try {
    const parsed = new URL(raw);
    const publicPrefix = `/storage/v1/object/public/${bucket}/`;
    if (/\.supabase\.co$/i.test(parsed.hostname) && parsed.pathname.startsWith(publicPrefix)) {
      return safeStoragePath(decodeURIComponent(parsed.pathname.slice(publicPrefix.length)));
    }

    const proxy = new URL(proxyBaseUrl);
    const proxyPrefix = proxy.pathname.replace(/\/$/, "") + "/";
    if (parsed.host === proxy.host && parsed.pathname.startsWith(proxyPrefix)) {
      return safeStoragePath(decodeURIComponent(parsed.pathname.slice(proxyPrefix.length)));
    }
  } catch {
    return "";
  }
  return "";
}

function optimizedPathFor(path, originalBytes) {
  const filename = path.split("/").pop() || "product";
  const basename = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120) || "product";
  return `${optimizedPrefix}/${basename}-${hashBuffer(originalBytes)}.webp`;
}

async function selectRows(table) {
  if (selectRows.cache.has(table)) return selectRows.cache.get(table);
  const { data, error } = await supabase
    .from(table)
    .select("id,image_url")
    .not("image_url", "is", null)
    .limit(1000);
  if (error) {
    console.warn(`${table}: skipped (${error.message})`);
    selectRows.cache.set(table, []);
    return selectRows.cache.get(table);
  }
  selectRows.cache.set(table, data || []);
  return selectRows.cache.get(table);
}
selectRows.cache = new Map();

async function updateRows(table, path, nextUrl) {
  const rows = (await selectRows(table)).filter((row) => storagePathFromUrl(row.image_url) === path);
  if (!rows.length) return 0;
  if (dryRun || !updateDb) {
    console.log(`${table}: would update ${rows.length} row(s) for ${path}`);
    return rows.length;
  }

  for (const row of rows) {
    const { error } = await supabase.from(table).update({ image_url: nextUrl }).eq("id", row.id);
    if (error) throw new Error(`${table}:${row.id}: ${error.message}`);
  }
  console.log(`${table}: updated ${rows.length} row(s) for ${path}`);
  return rows.length;
}

const productRows = await selectRows("products");
const adRows = await selectRows("partner_ads");
const targetPaths = Array.from(new Set([...productRows, ...adRows]
  .map((row) => storagePathFromUrl(row.image_url))
  .filter((path) => (
    path &&
    path.startsWith(`${prefix}/`) &&
    !path.startsWith(`${optimizedPrefix}/`) &&
    /\.(?:png|jpe?g|webp)$/i.test(path)
  )))).slice(0, limit);

console.log(`Targets: ${targetPaths.length}`);
if (dryRun) console.log("Dry run only. Re-run with --dry-run=0 to upload and update DB.");

let originalTotal = 0;
let optimizedTotal = 0;
let updatedRows = 0;

for (const path of targetPaths) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    console.warn(`${path}: download skipped (${error?.message || "not found"})`);
    continue;
  }

  const original = Buffer.from(await data.arrayBuffer());
  originalTotal += original.byteLength;
  const optimized = await sharp(original)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
  const nextPath = optimizedPathFor(path, original);
  const nextUrl = `${proxyBaseUrl}/${encodedPath(nextPath)}`;
  optimizedTotal += optimized.byteLength;

  console.log(`${path}: ${bytes(original.byteLength)} -> ${bytes(optimized.byteLength)} (${nextPath})`);
  if (dryRun) {
    updatedRows += await updateRows("products", path, nextUrl);
    updatedRows += await updateRows("partner_ads", path, nextUrl);
    continue;
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(nextPath, optimized, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false
  });
  if (uploadError && !/already|exists|duplicate/i.test(uploadError.message || "")) {
    throw new Error(`${nextPath}: ${uploadError.message}`);
  }

  updatedRows += await updateRows("products", path, nextUrl);
  updatedRows += await updateRows("partner_ads", path, nextUrl);

  if (deleteOriginals) {
    const { error: removeError } = await supabase.storage.from(bucket).remove([path]);
    if (removeError) throw new Error(`${path}: ${removeError.message}`);
    console.log(`${path}: original deleted`);
  }
}

console.log(`Original total: ${bytes(originalTotal)}`);
console.log(`Optimized total: ${bytes(optimizedTotal)}`);
console.log(`Rows matched/updated: ${updatedRows}`);
