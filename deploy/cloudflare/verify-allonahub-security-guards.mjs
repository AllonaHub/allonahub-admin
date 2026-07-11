#!/usr/bin/env node

const defaultMediaUrl = "https://api.allonahub.com/v1/media/product-images/products/ALP-295481-1780950452607-0347pb2b3otz.PNG";

const probes = [
  {
    key: "health",
    url: process.env.ALLONAHUB_HEALTH_URL || "https://api.allonahub.com/health",
    expectStatus: 200,
    cacheRequired: false
  },
  {
    key: "ready",
    url: process.env.ALLONAHUB_READY_URL || "https://api.allonahub.com/ready",
    expectStatus: 200,
    cacheRequired: false
  },
  {
    key: "product-media-first",
    url: process.env.ALLONAHUB_MEDIA_PROBE_URL || defaultMediaUrl,
    expectStatus: 200,
    cacheRequired: false
  },
  {
    key: "product-media-second",
    url: process.env.ALLONAHUB_MEDIA_PROBE_URL || defaultMediaUrl,
    expectStatus: 200,
    cacheRequired: process.env.ALLONAHUB_EXPECT_MEDIA_CACHE !== "0"
  }
];

const cacheHits = new Set(["HIT", "STALE", "REVALIDATED", "UPDATING"]);

function headerValue(headers, key) {
  return headers.get(key) || headers.get(key.toLowerCase()) || "";
}

async function headProbe(probe) {
  const response = await fetch(probe.url, {
    method: "HEAD",
    headers: {
      "User-Agent": "Mozilla/5.0 AllonaHub-Security-Guard-Probe/1.0",
      Accept: probe.key.includes("media") ? "image/avif,image/webp,image/png,image/*,*/*;q=0.8" : "application/json,*/*;q=0.8"
    }
  });
  const headers = response.headers;
  const cacheStatus = headerValue(headers, "cf-cache-status").toUpperCase();
  const mitigated = headerValue(headers, "cf-mitigated").toLowerCase();
  const contentType = headerValue(headers, "content-type").toLowerCase();
  const isChallenge = mitigated === "challenge" || (response.status === 403 && contentType.includes("text/html") && headerValue(headers, "server").toLowerCase() === "cloudflare");
  const statusOk = response.status === probe.expectStatus;
  const cacheOk = !probe.cacheRequired || cacheHits.has(cacheStatus);

  return {
    ...probe,
    status: response.status,
    cacheStatus: cacheStatus || "-",
    mitigated: mitigated || "-",
    statusOk,
    cacheOk,
    isChallenge
  };
}

const results = [];
for (const probe of probes) {
  if (probe.key === "product-media-second") {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  results.push(await headProbe(probe));
}

let failed = false;
for (const result of results) {
  const ok = result.statusOk && result.cacheOk && !result.isChallenge;
  failed = failed || !ok;
  const marker = ok ? "ok" : "fail";
  console.log(`[${marker}] ${result.key} status=${result.status} cf-mitigated=${result.mitigated} cf-cache-status=${result.cacheStatus}`);
  if (result.isChallenge) console.log(`      Cloudflare challenge detected: ${result.url}`);
  if (!result.statusOk) console.log(`      Expected HTTP ${result.expectStatus}.`);
  if (!result.cacheOk) console.log("      Expected media cache HIT/STALE/REVALIDATED/UPDATING on the second request.");
}

if (failed) {
  console.error("AllonaHub security guard verification failed.");
  process.exit(1);
}

console.log("AllonaHub security guards OK.");
