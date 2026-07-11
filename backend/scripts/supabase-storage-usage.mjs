#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const supabaseUrl = parseEnvValue(process.env.SUPABASE_URL || process.env.ALLONA_SUPABASE_URL).replace(/\/$/, "");
const serviceRoleKey = parseEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ALLONA_SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "1"];
  })
);

const bucketFilter = args.get("bucket") || "";
const prefixFilter = args.get("prefix") || "";
const deleteOlderThan = args.get("delete-older-than") || "";
const retentionDays = Number(args.get("retention-days") || 0);
const dryRun = args.get("dry-run") !== "0";
const deleteBefore = deleteOlderThan
  ? new Date(deleteOlderThan)
  : retentionDays > 0
    ? new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    : null;

if (deleteBefore && Number.isNaN(deleteBefore.getTime())) {
  console.error("Invalid --delete-older-than value. Use YYYY-MM-DD.");
  process.exit(1);
}

if (retentionDays && (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 365)) {
  console.error("Invalid --retention-days value. Use a number between 1 and 365.");
  process.exit(1);
}

const storageApiUrl = `${supabaseUrl}/storage/v1`;
const authHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`
};

function bytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function objectSize(item) {
  return Number(item?.metadata?.size || item?.metadata?.contentLength || item?.metadata?.ContentLength || 0);
}

function objectUpdatedAt(item) {
  return item?.updated_at || item?.created_at || item?.last_accessed_at || item?.metadata?.lastModified || "";
}

async function listPath(bucket, path = "") {
  const rows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const items = await storageRequest(`/object/list/${encodeURIComponent(bucket)}`, {
      method: "POST",
      body: {
        prefix: path,
        limit,
        offset,
        sortBy: { column: "name", order: "asc" }
      }
    });
    rows.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }

  return rows;
}

async function storageRequest(path, options = {}) {
  const response = await fetch(`${storageApiUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message = typeof payload === "string" ? payload : (payload?.message || payload?.error || response.statusText);
    throw new Error(`${options.method || "GET"} ${path}: ${message}`);
  }
  return payload || [];
}

async function listBuckets() {
  return storageRequest("/bucket");
}

async function removeStorageObjects(bucket, paths) {
  return storageRequest(`/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    body: { prefixes: paths }
  });
}

async function walkBucket(bucket, path = "") {
  const items = await listPath(bucket, path);
  const files = [];

  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (!item.id && !objectSize(item)) {
      files.push(...await walkBucket(bucket, fullPath));
      continue;
    }
    files.push({
      bucket,
      path: fullPath,
      size: objectSize(item),
      updatedAt: objectUpdatedAt(item)
    });
  }

  return files;
}

const bucketRows = await listBuckets();

const buckets = (bucketRows || [])
  .map((bucket) => bucket.name)
  .filter((bucket) => !bucketFilter || bucket === bucketFilter);

let grandTotal = 0;
let deleteCandidates = [];

for (const bucket of buckets) {
  const files = (await walkBucket(bucket, prefixFilter)).filter((file) => !prefixFilter || file.path.startsWith(prefixFilter));
  const total = files.reduce((sum, file) => sum + file.size, 0);
  grandTotal += total;
  console.log(`${bucket}: ${files.length} object, ${bytes(total)}`);

  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 10);
  largest.forEach((file) => {
    console.log(`  ${bytes(file.size).padStart(10)}  ${file.updatedAt || "-"}  ${file.path}`);
  });

  if (deleteBefore) {
    deleteCandidates = deleteCandidates.concat(
      files.filter((file) => {
        const updatedAt = file.updatedAt ? new Date(file.updatedAt) : null;
        return updatedAt && !Number.isNaN(updatedAt.getTime()) && updatedAt < deleteBefore;
      })
    );
  }
}

console.log(`Total: ${bytes(grandTotal)}`);

if (!deleteBefore) process.exit(0);

const deleteLabel = deleteOlderThan || `${retentionDays} day retention (${deleteBefore.toISOString()})`;
console.log(`Delete candidates older than ${deleteLabel}: ${deleteCandidates.length}`);
if (dryRun) {
  console.log("Dry run only. Re-run with --dry-run=0 to delete.");
  process.exit(0);
}

for (const bucket of new Set(deleteCandidates.map((file) => file.bucket))) {
  const paths = deleteCandidates.filter((file) => file.bucket === bucket).map((file) => file.path);
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    await removeStorageObjects(bucket, batch);
    console.log(`${bucket}: deleted ${batch.length} objects`);
  }
}
