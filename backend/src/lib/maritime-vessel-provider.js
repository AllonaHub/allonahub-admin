import { config } from "../config.js";

function text(value) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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
    provider_record_kind: "vessel_particulars_legacy"
  };
}

export function maritimeVesselLookupConfigured() {
  return config.maritimeVesselLookup.enabled === true
    && config.maritimeVesselLookup.provider === "marinetraffic"
    && Boolean(config.maritimeVesselLookup.marineTrafficApiKey)
    && Boolean(config.maritimeVesselLookup.marineTrafficBaseUrl);
}

function providerError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

export async function lookupVesselByImo(value, options = {}) {
  const imo = normalizeImoNumber(value);
  if (!isValidImoNumber(imo)) {
    throw providerError("Geçerli, yedi haneli ve kontrol basamağı doğru bir IMO numarası girin.", 400, "MARITIME_IMO_INVALID");
  }
  if (!maritimeVesselLookupConfigured()) {
    throw providerError("IMO veri bağlantısı henüz etkin değil. Gemi bilgilerini elle tamamlayabilirsiniz.", 503, "MARITIME_VESSEL_LOOKUP_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.maritimeVesselLookup.timeoutMs);
  const baseUrl = options.baseUrl || config.maritimeVesselLookup.marineTrafficBaseUrl;
  const apiKey = options.apiKey || config.maritimeVesselLookup.marineTrafficApiKey;
  const endpoint = new URL(`${baseUrl}/vesselmasterdata/${encodeURIComponent(apiKey)}`);
  endpoint.searchParams.set("v", "5");
  endpoint.searchParams.set("imo", imo);
  endpoint.searchParams.set("protocol", "jsono");
  endpoint.searchParams.set("msgtype", "extended");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 429) {
      throw providerError("IMO servisi istek sınırına ulaştı. Bir süre sonra yeniden deneyin.", 429, "MARITIME_VESSEL_LOOKUP_RATE_LIMITED");
    }
    if (!response.ok) {
      throw providerError("IMO servisinden gemi bilgileri alınamadı. Alanları elle tamamlayabilirsiniz.", 502, "MARITIME_VESSEL_LOOKUP_FAILED");
    }
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const vessel = rows.map(normalizeMarineTrafficVessel).find((entry) => entry?.imo === imo) || null;
    if (!vessel) {
      throw providerError("Bu IMO numarası için etkin gemi kaydı bulunamadı. Alanları elle tamamlayabilirsiniz.", 404, "MARITIME_VESSEL_NOT_FOUND");
    }
    return { ...vessel, fetched_at: new Date().toISOString() };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw providerError("IMO servisi zamanında yanıt vermedi. Alanları elle tamamlayabilirsiniz.", 504, "MARITIME_VESSEL_LOOKUP_TIMEOUT");
    }
    if (error?.exposeCode) throw error;
    throw providerError("IMO servisine güvenli bağlantı kurulamadı. Alanları elle tamamlayabilirsiniz.", 502, "MARITIME_VESSEL_LOOKUP_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}
