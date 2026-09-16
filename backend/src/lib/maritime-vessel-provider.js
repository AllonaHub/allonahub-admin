import { config } from "../config.js";

function text(value) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function number(value) {
  const clean = String(value ?? "").trim().replace(/[^0-9.-]/g, "");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function bindingValue(binding, key) {
  return binding && binding[key] && typeof binding[key].value === "string"
    ? binding[key].value.trim()
    : null;
}

function firstBindingValue(bindings, key) {
  for (const binding of bindings) {
    const value = bindingValue(binding, key);
    if (value) return value;
  }
  return null;
}

function year(value) {
  const match = String(value || "").match(/^([12]\d{3})/);
  return match ? Number(match[1]) : null;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function publicTableRows(html) {
  const rows = new Map();
  for (const rowMatch of String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => decodeHtml(match[1]));
    if (cells.length < 2 || !cells[0] || !cells[1]) continue;
    const label = cells[0].toLowerCase().replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    if (!rows.has(label)) rows.set(label, cells[1]);
  }
  return rows;
}

export function normalizeImoNumber(value) {
  return String(value ?? "").toUpperCase().replace(/^IMO\s*/i, "").replace(/\D/g, "").slice(0, 7);
}

export function isValidImoNumber(value) {
  const imo = normalizeImoNumber(value);
  if (!/^\d{7}$/.test(imo)) return false;
  const checksum = imo.slice(0, 6).split("").reduce((sum, digit, index) => sum + Number(digit) * (7 - index), 0) % 10;
  return checksum === Number(imo[6]);
}

export function normalizeMarineTrafficVessel(value) {
  const row = value && typeof value === "object" ? value : {};
  const imo = normalizeImoNumber(row.IMO || row.imo);
  if (!isValidImoNumber(imo)) return null;
  return {
    imo,
    vessel_name: text(row.NAME || row.SHIPNAME || row.vessel_name),
    company_name: text(row.MANAGER || row.TECHNICAL_MANAGER || row.OWNER || row.company_name),
    owner_name: text(row.OWNER || row.owner_name),
    technical_manager: text(row.TECHNICAL_MANAGER || row.technical_manager),
    commercial_manager: text(row.MANAGER || row.commercial_manager),
    vessel_type: text(row.VESSEL_TYPE || row.TYPE_NAME || row.vessel_type),
    flag: text(row.FLAG || row.flag),
    dwt: number(row.SUMMER_DWT ?? row.DWT ?? row.dwt),
    grt: number(row.GROSS_TONNAGE ?? row.GRT ?? row.grt),
    net_tonnage: number(row.NET_TONNAGE ?? row.net_tonnage),
    mmsi: text(row.MMSI || row.mmsi),
    call_sign: text(row.CALLSIGN || row.CALL_SIGN || row.call_sign),
    build_year: number(row.BUILD ?? row.YEAR_BUILT ?? row.build_year),
    length_overall_m: number(row.LENGTH_OVERALL ?? row.length_overall_m),
    breadth_m: number(row.BREADTH_EXTREME ?? row.BREADTH_MOULDED ?? row.breadth_m),
    provider: "marinetraffic",
    provider_record_kind: "vessel_particulars_legacy",
    provider_license: "commercial_api"
  };
}

export function normalizeVesselFinderHtml(value, expectedImo = "") {
  const html = String(value || "");
  const rows = publicTableRows(html);
  const combinedImoMmsi = rows.get("imo / mmsi") || "";
  const [combinedImo, combinedMmsi] = combinedImoMmsi.split("/").map((entry) => entry.trim());
  const imo = normalizeImoNumber(rows.get("imo number") || combinedImo);
  const wantedImo = normalizeImoNumber(expectedImo || imo);
  if (!isValidImoNumber(imo) || imo !== wantedImo) return null;

  const titleName = decodeHtml(html.match(/<title[^>]*>([^,<]+?)(?:,|\s+-\s+)/i)?.[1]);
  return {
    imo,
    vessel_name: text(rows.get("vessel name") || titleName),
    company_name: null,
    owner_name: null,
    technical_manager: null,
    commercial_manager: null,
    vessel_type: text(rows.get("ship type")),
    flag: text(rows.get("flag") || rows.get("ais flag")),
    dwt: number(rows.get("deadweight")),
    grt: number(rows.get("gross tonnage")),
    net_tonnage: number(rows.get("net tonnage")),
    mmsi: text(combinedMmsi),
    call_sign: text(rows.get("callsign")),
    build_year: number(rows.get("year of build")),
    length_overall_m: number(rows.get("length overall")),
    breadth_m: number(rows.get("beam")),
    provider: "vesselfinder_public",
    provider_record_kind: "public_vessel_particulars",
    provider_license: null,
    provider_source_url: `https://www.vesselfinder.com/vessels/details/${imo}`
  };
}

function preferredWikidataName(bindings, imo) {
  const keys = ["officialName", "shortName", "shipNameEn", "shipNameTr", "shipNameAz", "shipNameRu", "shipNameAny"];
  for (const key of keys) {
    const candidate = firstBindingValue(bindings, key);
    if (!candidate) continue;
    const normalized = candidate.replace(/[«»"]/g, "").trim();
    if (!new RegExp(`^IMO\\s*${imo}$`, "i").test(normalized)) return normalized;
  }
  return null;
}

export function normalizeWikidataVesselBindings(value, expectedImo = "") {
  const bindings = Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
  const imo = normalizeImoNumber(expectedImo || firstBindingValue(bindings, "imo"));
  if (!bindings.length || !isValidImoNumber(imo)) return null;
  const sourceUrl = firstBindingValue(bindings, "ship");
  const operator = firstBindingValue(bindings, "operatorLabel");
  const owner = firstBindingValue(bindings, "ownerLabel");
  return {
    imo,
    vessel_name: preferredWikidataName(bindings, imo),
    company_name: operator || owner,
    owner_name: owner,
    technical_manager: null,
    commercial_manager: operator,
    vessel_type: firstBindingValue(bindings, "instanceLabel"),
    flag: firstBindingValue(bindings, "flagLabel"),
    dwt: number(firstBindingValue(bindings, "dwt")),
    grt: number(firstBindingValue(bindings, "gross")),
    net_tonnage: null,
    mmsi: text(firstBindingValue(bindings, "mmsi")),
    call_sign: text(firstBindingValue(bindings, "callSign")),
    build_year: year(firstBindingValue(bindings, "serviceEntry")),
    length_overall_m: number(firstBindingValue(bindings, "length")),
    breadth_m: number(firstBindingValue(bindings, "breadth")),
    provider: "wikidata",
    provider_record_kind: "open_vessel_graph",
    provider_license: "CC0-1.0",
    provider_source_url: sourceUrl
  };
}

function marineTrafficConfigured() {
  return config.maritimeVesselLookup.enabled === true
    && config.maritimeVesselLookup.provider === "marinetraffic"
    && Boolean(config.maritimeVesselLookup.marineTrafficApiKey)
    && Boolean(config.maritimeVesselLookup.marineTrafficBaseUrl);
}

function wikidataConfigured() {
  return config.maritimeVesselLookup.publicFallbackEnabled === true
    && Boolean(config.maritimeVesselLookup.wikidataBaseUrl);
}

function publicVesselPageConfigured() {
  return config.maritimeVesselLookup.publicFallbackEnabled === true
    && Boolean(config.maritimeVesselLookup.vesselFinderPublicBaseUrl);
}

export function maritimeVesselLookupConfigured() {
  return marineTrafficConfigured() || publicVesselPageConfigured() || wikidataConfigured();
}

function providerError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

function wikidataQuery(imo) {
  return `
SELECT ?ship ?imo ?officialName ?shortName ?shipNameEn ?shipNameTr ?shipNameAz ?shipNameRu ?shipNameAny
       ?flagLabel ?instanceLabel ?gross ?dwt ?mmsi ?callSign ?serviceEntry
       ?length ?breadth ?operatorLabel ?ownerLabel
WHERE {
  ?ship wdt:P458 "${imo}".
  BIND("${imo}" AS ?imo)
  OPTIONAL { ?ship rdfs:label ?shipNameEn. FILTER(LANG(?shipNameEn) = "en") }
  OPTIONAL { ?ship rdfs:label ?shipNameTr. FILTER(LANG(?shipNameTr) = "tr") }
  OPTIONAL { ?ship rdfs:label ?shipNameAz. FILTER(LANG(?shipNameAz) = "az") }
  OPTIONAL { ?ship rdfs:label ?shipNameRu. FILTER(LANG(?shipNameRu) = "ru") }
  OPTIONAL { ?ship rdfs:label ?shipNameAny. FILTER(!REGEX(STR(?shipNameAny), "^IMO\\\\s*${imo}$", "i")) }
  OPTIONAL { ?ship wdt:P2561 ?officialName. }
  OPTIONAL { ?ship wdt:P1813 ?shortName. FILTER(LANG(?shortName) IN ("en", "tr", "az", "ru", "")) }
  OPTIONAL { ?ship wdt:P8047 ?flag. }
  OPTIONAL { ?ship wdt:P31 ?instance. }
  OPTIONAL { ?ship wdt:P1093 ?gross. }
  OPTIONAL { ?ship wdt:P4519 ?dwt. }
  OPTIONAL { ?ship wdt:P587 ?mmsi. }
  OPTIONAL { ?ship wdt:P2317 ?callSign. }
  OPTIONAL { ?ship wdt:P729 ?serviceEntry. }
  OPTIONAL { ?ship wdt:P2043 ?length. }
  OPTIONAL { ?ship wdt:P2049 ?breadth. }
  OPTIONAL { ?ship wdt:P137 ?operator. }
  OPTIONAL { ?ship wdt:P127 ?owner. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr,az,ru". }
}
LIMIT 25`.trim();
}

async function lookupMarineTrafficByImo(imo, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.maritimeVesselLookup.timeoutMs);
  const baseUrl = options.baseUrl || config.maritimeVesselLookup.marineTrafficBaseUrl;
  const apiKey = options.apiKey || config.maritimeVesselLookup.marineTrafficApiKey;
  const fetchImpl = options.fetchImpl || fetch;
  const endpoint = new URL(`${baseUrl}/vesselmasterdata/${encodeURIComponent(apiKey)}`);
  endpoint.searchParams.set("v", "5");
  endpoint.searchParams.set("imo", imo);
  endpoint.searchParams.set("protocol", "jsono");
  endpoint.searchParams.set("msgtype", "extended");

  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 429) {
      throw providerError("IMO servisi istek sınırına ulaştı. Bir süre sonra yeniden deneyin.", 429, "MARITIME_VESSEL_LOOKUP_RATE_LIMITED");
    }
    if (!response.ok) {
      throw providerError("MarineTraffic gemi bilgilerini döndürmedi.", 502, "MARITIME_VESSEL_LOOKUP_FAILED");
    }
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const vessel = rows.map(normalizeMarineTrafficVessel).find((entry) => entry?.imo === imo) || null;
    if (!vessel) {
      throw providerError("MarineTraffic üzerinde etkin gemi kaydı bulunamadı.", 404, "MARITIME_VESSEL_NOT_FOUND");
    }
    return vessel;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupWikidataByImo(imo, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.maritimeVesselLookup.timeoutMs);
  const fetchImpl = options.fetchImpl || fetch;
  const endpoint = new URL(options.wikidataBaseUrl || config.maritimeVesselLookup.wikidataBaseUrl);
  endpoint.searchParams.set("query", wikidataQuery(imo));
  endpoint.searchParams.set("format", "json");

  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "AllonaHub/1.0 (https://allonahub.com; maritime vessel lookup)"
      },
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 429) {
      throw providerError("Açık gemi veri kaynağı istek sınırına ulaştı. Bir süre sonra yeniden deneyin.", 429, "MARITIME_VESSEL_LOOKUP_RATE_LIMITED");
    }
    if (!response.ok) {
      throw providerError("Açık gemi veri kaynağından bilgi alınamadı.", 502, "MARITIME_VESSEL_LOOKUP_FAILED");
    }
    const vessel = normalizeWikidataVesselBindings(payload?.results?.bindings, imo);
    if (!vessel) {
      throw providerError("Bu IMO numarası için açık gemi kaydı bulunamadı. Alanları elle tamamlayabilirsiniz.", 404, "MARITIME_VESSEL_NOT_FOUND");
    }
    return vessel;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupVesselFinderPublicByImo(imo, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.maritimeVesselLookup.timeoutMs);
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = options.vesselFinderPublicBaseUrl || config.maritimeVesselLookup.vesselFinderPublicBaseUrl;
  const endpoint = new URL(`${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(imo)}`);

  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AllonaHub/1.0 (+https://allonahub.com; maritime vessel lookup)"
      },
      signal: controller.signal
    });
    if (response.status === 429) {
      throw providerError("Güncel açık gemi kaynağı istek sınırına ulaştı. Bir süre sonra yeniden deneyin.", 429, "MARITIME_VESSEL_LOOKUP_RATE_LIMITED");
    }
    if (!response.ok) {
      throw providerError("Güncel açık gemi kaynağından bilgi alınamadı.", 502, "MARITIME_VESSEL_LOOKUP_FAILED");
    }
    const html = await response.text();
    if (html.length > 2_000_000) {
      throw providerError("Güncel açık gemi kaynağının yanıtı işlenemedi.", 502, "MARITIME_VESSEL_LOOKUP_FAILED");
    }
    const vessel = normalizeVesselFinderHtml(html, imo);
    if (!vessel?.vessel_name) {
      throw providerError("Bu IMO numarası için güncel açık gemi kaydı doğrulanamadı. Alanları elle tamamlayabilirsiniz.", 404, "MARITIME_VESSEL_NOT_FOUND");
    }
    return vessel;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupVesselByImo(value, options = {}) {
  const imo = normalizeImoNumber(value);
  if (!isValidImoNumber(imo)) {
    throw providerError("Geçerli, yedi haneli ve kontrol basamağı doğru bir IMO numarası girin.", 400, "MARITIME_IMO_INVALID");
  }
  if (!maritimeVesselLookupConfigured() && !options.forcePublicFallback) {
    throw providerError("IMO veri bağlantısı henüz etkin değil. Gemi bilgilerini elle tamamlayabilirsiniz.", 503, "MARITIME_VESSEL_LOOKUP_NOT_CONFIGURED");
  }

  let officialError = null;
  if (marineTrafficConfigured() && options.skipMarineTraffic !== true) {
    try {
      const vessel = await lookupMarineTrafficByImo(imo, options);
      return { ...vessel, fetched_at: new Date().toISOString() };
    } catch (error) {
      if (error?.name === "AbortError") {
        officialError = providerError("MarineTraffic zamanında yanıt vermedi.", 504, "MARITIME_VESSEL_LOOKUP_TIMEOUT");
      } else {
        officialError = error;
      }
    }
  }

  if (publicVesselPageConfigured() || options.forcePublicFallback) {
    try {
      const vessel = await lookupVesselFinderPublicByImo(imo, options);
      return { ...vessel, fetched_at: new Date().toISOString() };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw providerError("Güncel açık gemi kaynağı zamanında yanıt vermedi. Alanları elle tamamlayabilirsiniz.", 504, "MARITIME_VESSEL_LOOKUP_TIMEOUT");
      }
      if (officialError && error?.statusCode === 404) throw officialError;
      if (error?.exposeCode) throw error;
    }
  }

  if (officialError?.exposeCode) throw officialError;
  throw providerError("IMO servisinden gemi bilgileri alınamadı. Alanları elle tamamlayabilirsiniz.", 502, "MARITIME_VESSEL_LOOKUP_FAILED");
}
