export function normalizedCompanyLookupProvider(value) {
  return String(value || "generic")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "generic";
}

export function turkeyCompanyLookupProvider(companyLookup = {}) {
  const configuredProvider = normalizedCompanyLookupProvider(companyLookup.turkeyProvider);
  if (configuredProvider !== "generic") return configuredProvider;
  const url = String(companyLookup.turkeyApiUrl || "").toLowerCase();
  if (url.includes("mukellef.info")) return "mukellef_info";
  if (url.includes("nilvera")) return "nilvera";
  return "generic";
}

export function turkeyCompanyLookupIsConfigured(companyLookup = {}) {
  const provider = turkeyCompanyLookupProvider(companyLookup);
  if (provider === "mukellef_info") return Boolean(companyLookup.turkeyApiToken);
  if (provider === "nilvera") return Boolean(companyLookup.turkeyApiUrl && companyLookup.turkeyApiToken);
  return Boolean(companyLookup.turkeyApiUrl);
}

export function companyAddressFromParts(parts = []) {
  return parts.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
}

export function mukellefInfoLookupUrl(companyLookup = {}, taxNumber) {
  const configuredUrl = companyLookup.turkeyApiUrl || "https://api.mukellef.info/v2/query.php";
  const url = new URL(configuredUrl);
  if (!/\/query\.php$/i.test(url.pathname)) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v2/query.php`;
  }
  url.searchParams.set("TaxNumber", taxNumber);
  return url.href;
}

export function normalizeMukellefInfoPayload(payload, fallback = {}) {
  const source = payload?.data || payload?.result || payload?.company || payload || {};
  const address = source.addressInfo || source.address_info || {};
  const legalName = source.title || source.Title || source.companyName || source.company_name || source.legal_name || source.name || "";
  const addressText = source.address || source.adres || source.fullAddress || source.full_address || "";
  return {
    legal_name: String(legalName || "").trim(),
    display_name: String(source.displayName || source.display_name || legalName || "").trim(),
    tax_office: String(source.taxOfficeName || source.tax_office_name || source.tax_office || source.vergi_dairesi || "").trim(),
    company_type: String(source.companyTypeName || source.company_type_name || source.companyType || source.company_type || "").trim(),
    city: String(address.cityName || source.cityName || source.city || fallback.city || "").trim(),
    country: String(source.country || fallback.country || "").trim(),
    address: String(addressText || "").trim() || companyAddressFromParts([
      address.neighborhood,
      address.village,
      address.street,
      address.buildingNo,
      address.doorNo,
      address.borough,
      address.districtName,
      address.cityName
    ]),
    website: String(source.website || source.web_site || "").trim(),
    tax_number: String(source.taxNumber || source.tax_number || source.vkn || source.tckn || fallback.tax_number || "").trim(),
    status: source.isActive === false ? "inactive" : String(source.status || source.durum || "").trim()
  };
}

export function nilveraLookupUrl(companyLookup = {}, taxNumber) {
  const url = new URL(`/general/GlobalCompany/Check/TaxNumber/${encodeURIComponent(taxNumber)}`, `${companyLookup.turkeyApiUrl}/`);
  url.searchParams.set("globalUserType", "Invoice");
  return url.href;
}

export function normalizeNilveraCompanyPayload(payload, fallback = {}) {
  const source = (Array.isArray(payload) ? payload.find((item) => item?.Title || item?.TaxNumber) : payload?.data || payload?.company || payload) || {};
  const legalName = source.Title || source.title || source.legal_name || source.name || "";
  return {
    legal_name: String(legalName || "").trim(),
    display_name: String(source.Name || source.display_name || legalName || "").trim(),
    tax_office: "",
    company_type: String(source.Type || source.type || source.DocumentType || "").trim(),
    city: String(fallback.city || "").trim(),
    country: String(fallback.country || "").trim(),
    address: "",
    website: "",
    tax_number: String(source.TaxNumber || source.tax_number || fallback.tax_number || "").trim(),
    status: String(source.status || "").trim()
  };
}
