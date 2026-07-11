#!/usr/bin/env node

import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const mallSlug = "allona-avm-dunyasi";
const pageSize = 1000;

function cliValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function normalizeBaseUrl(value, label, allowLocalHttp = false) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch (error) {
    throw new Error(`${label} geçerli bir mutlak URL olmalıdır.`);
  }
  const localHttp = allowLocalHttp && url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error(`${label} HTTPS kullanmalıdır.`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${label} kullanıcı bilgisi, query veya fragment içeremez.`);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapDate(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

function isCurrentItem(item, now) {
  const startsAt = item.starts_at ? new Date(item.starts_at).getTime() : null;
  const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null;
  if (item.starts_at && !Number.isFinite(startsAt)) return false;
  if (item.ends_at && !Number.isFinite(endsAt)) return false;
  if (Number.isFinite(startsAt) && startsAt > now.getTime()) return false;
  if (Number.isFinite(endsAt) && endsAt < now.getTime()) return false;
  return item.item_type !== "deals" || String(item.terms_text || "").trim().length >= 3;
}

async function supabaseRows(url, publishableKey, rangeStart, rangeEnd) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Accept: "application/json",
        Prefer: "count=exact",
        Range: `${rangeStart}-${rangeEnd}`
      },
      signal: controller.signal
    });
    if (!response.ok) {
      const message = (await response.text()).replace(/\s+/g, " ").slice(0, 300);
      throw new Error(`Supabase ${response.status} yanıtı: ${message || response.statusText}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Supabase liste yanıtı beklenen dizi biçiminde değil.");
    const totalValue = String(response.headers.get("content-range") || "").split("/").pop();
    const total = /^\d+$/.test(totalValue) ? Number(totalValue) : null;
    return { rows, total };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Supabase sitemap sorgusu 15 saniyede tamamlanamadı.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function activeMallCenter(supabaseUrl, publishableKey) {
  const url = new URL("rest/v1/mall_centers", supabaseUrl);
  url.searchParams.set("select", "id");
  url.searchParams.set("slug", `eq.${mallSlug}`);
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("limit", "1");
  const { rows } = await supabaseRows(url, publishableKey, 0, 0);
  return rows[0] || null;
}

async function activeDirectoryItems(supabaseUrl, publishableKey, mallId) {
  const rows = [];
  let offset = 0;
  let expectedTotal = null;
  do {
    const url = new URL("rest/v1/mall_directory_items", supabaseUrl);
    url.searchParams.set("select", "public_id,item_type,starts_at,ends_at,terms_text,updated_at");
    url.searchParams.set("mall_id", `eq.${mallId}`);
    url.searchParams.set("status", "eq.active");
    url.searchParams.set("order", "public_id.asc");
    const result = await supabaseRows(url, publishableKey, offset, offset + pageSize - 1);
    rows.push(...result.rows);
    offset += result.rows.length;
    if (result.total !== null) expectedTotal = result.total;
    if (!result.rows.length) break;
    if (expectedTotal !== null && offset >= expectedTotal) break;
  } while (true);
  return rows;
}

function buildSitemap(siteUrl, items) {
  const entries = [
    { loc: new URL("avm-dunyasi.html", siteUrl).href },
    { loc: new URL("avm-partner.html", siteUrl).href }
  ];
  const publicIds = new Set();
  items.forEach((item) => {
    const publicId = String(item.public_id || "").trim();
    if (!publicId || publicId.length > 180) throw new Error("Katalog sitemap kaydında geçersiz public_id bulundu.");
    if (publicIds.has(publicId)) throw new Error(`Katalog sitemap kaydında yinelenen public_id bulundu: ${publicId}`);
    publicIds.add(publicId);
    entries.push({
      loc: new URL(`avm-detay.html?item=${encodeURIComponent(publicId)}`, siteUrl).href,
      lastmod: sitemapDate(item.updated_at)
    });
  });
  const body = entries.map((entry) => [
    "  <url>",
    `    <loc>${xmlEscape(entry.loc)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : "",
    "  </url>"
  ].filter(Boolean).join("\n")).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function generateAvmSitemap(options = {}) {
  const siteUrl = normalizeBaseUrl(options.siteUrl, "SITE_URL");
  const supabaseUrl = normalizeBaseUrl(options.supabaseUrl, "SUPABASE_URL", true);
  const publishableKey = String(options.publishableKey || "").trim();
  if (!publishableKey) throw new Error("SUPABASE_PUBLISHABLE_KEY veya SUPABASE_ANON_KEY zorunludur.");
  const now = options.now ? new Date(options.now) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("AVM_SITEMAP_NOW geçerli bir tarih olmalıdır.");
  const center = await activeMallCenter(supabaseUrl, publishableKey);
  const sourceRows = center ? await activeDirectoryItems(supabaseUrl, publishableKey, center.id) : [];
  const items = sourceRows.filter((item) => isCurrentItem(item, now));
  const xml = buildSitemap(siteUrl, items);
  const outputPath = resolve(options.outputPath || "sitemap-avm.xml");
  const tempPath = `${outputPath}.tmp-${process.pid}`;
  await mkdir(dirname(outputPath), { recursive: true });
  try {
    await writeFile(tempPath, xml, "utf8");
    await rename(tempPath, outputPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
  return { outputPath, itemCount: items.length, sourceCount: sourceRows.length, hasActiveCenter: Boolean(center) };
}

async function main() {
  const result = await generateAvmSitemap({
    siteUrl: cliValue("--site-url") || process.env.SITE_URL,
    supabaseUrl: cliValue("--supabase-url") || process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
    now: cliValue("--now") || process.env.AVM_SITEMAP_NOW,
    outputPath: cliValue("--output") || "sitemap-avm.xml"
  });
  const centerLabel = result.hasActiveCenter ? "aktif merkez" : "aktif merkez yok";
  console.log(`AVM sitemap yazıldı: ${result.outputPath} · ${result.itemCount}/${result.sourceCount} canlı detay · ${centerLabel}`);
}

const directExecution = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (directExecution) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

export { buildSitemap, generateAvmSitemap, isCurrentItem, normalizeBaseUrl, sitemapDate, xmlEscape };
