(function () {
  const App = window.Allona = window.Allona || {};

  const legacyRoutes = {
    "index.html": "/index.html",
    "addresses.html": "/pages/account/addresses.html",
    "belgeler.html": "/pages/account/belgeler.html",
    "bildirimler.html": "/pages/account/bildirimler.html",
    "favorites.html": "/pages/account/favorites.html",
    "forgot-password.html": "/pages/account/user.html?tab=forgot",
    "gorevler.html": "/pages/account/gorevler.html",
    "hublar.html": "/pages/account/hublar.html",
    "is-ilanlari.html": "/pages/account/is-ilanlari.html",
    "login.html": "/pages/account/user.html",
    "mfa.html": "/pages/account/mfa.html",
    "orders.html": "/pages/account/orders.html",
    "order-detail.html": "/pages/account/order-detail.html",
    "premium.html": "/pages/premium.html",
    "profil.html": "/pages/account/profil.html",
    "profile.html": "/pages/account/profile.html",
    "puanlar.html": "/pages/account/puanlar.html",
    "register.html": "/pages/account/user.html?tab=register",
    "reset-password.html": "/pages/account/reset-password.html",
    "rewards.html": "/pages/account/rewards.html",
    "user-panel.html": "/pages/account/user-panel.html",
    "user.html": "/pages/account/user.html",
    "admin-orders.html": "/admin/orders.html",
    "admin-order-detail.html": "/admin/order-detail.html",
    "admin-coupons.html": "/admin/coupons.html",
    "admin-rewards.html": "/admin/rewards.html",
    "super-admin.html": "/admin/super-admin.html",
    "allonakariyer.html": "/pages/career/allonakariyer.html",
    "career-cv-form.html": "/pages/career/career-cv-form.html",
    "cv-form.html": "/pages/career/cv-form.html",
    "cv-payment.html": "/pages/career/cv-payment.html",
    "kariyer.html": "/pages/career/allonakariyer.html",
    "maritime-cv.html": "/pages/career/maritime-cv.html",
    "allonamarket.html": "/pages/commerce/allonamarket.html",
    "allonashop.html": "/pages/commerce/allonashop.html",
    "allonayemek.html": "/pages/commerce/allonayemek.html",
    "allonayemek-tumu.html": "/pages/commerce/allonayemek-tumu.html",
    "cart.html": "/pages/commerce/cart.html",
    "checkout.html": "/pages/commerce/guvenli-odeme.html",
    "guvenli-odeme.html": "/pages/commerce/guvenli-odeme.html",
    "bank-payment.html": "/pages/commerce/bank-payment.html",
    "kopunlar.html": "/pages/commerce/kuponlar.html",
    "kuponlar.html": "/pages/commerce/kuponlar.html",
    "ode.html": "/pages/commerce/odeme.html",
    "odeme.html": "/pages/commerce/odeme.html",
    "order-success.html": "/pages/commerce/order-success.html",
    "product.html": "/pages/commerce/product.html",
    "shop.html": "/pages/commerce/shop.html",
    "destek.html": "/pages/company/destek.html",
    "hakkimizda.html": "/pages/company/hakkimizda.html",
    "iletisim.html": "/pages/company/iletisim.html",
    "arama.html": "/pages/search/arama.html",
    "ecosystem.html": "/index.html#modules",
    "taxi.html": "/pages/ecosystem/allonataksi.html",
    "allonaavm.html": "/pages/ecosystem/allonaavm.html",
    "allonadanismanlik.html": "/pages/ecosystem/allonadanismanlik.html",
    "allonadenizcilik.html": "/pages/ecosystem/allonadenizcilik.html",
    "allonaegitim.html": "/pages/ecosystem/allonaegitim.html",
    "allonaeglence.html": "/pages/ecosystem/allonaeglence.html",
    "allonaevcilhayvan.html": "/pages/ecosystem/allonaevcilhayvan.html",
    "allonaevhizmetleri.html": "/pages/ecosystem/allonaevhizmetleri.html",
    "allonafinans.html": "/pages/ecosystem/allonafinans.html",
    "allonagayrimenkul.html": "/pages/ecosystem/allonagayrimenkul.html",
    "allonaguzellik.html": "/pages/ecosystem/allonaguzellik.html",
    "allonahukuk.html": "/pages/ecosystem/allonahukuk.html",
    "allonainsaat.html": "/pages/ecosystem/allonainsaat.html",
    "allonakurye.html": "/pages/ecosystem/allonakurye.html",
    "allonalojistik.html": "/pages/ecosystem/allonalojistik.html",
    "allonamuhendislik.html": "/pages/ecosystem/allonamuhendislik.html",
    "allonanakliye.html": "/pages/ecosystem/allonanakliye.html",
    "allonaorganizasyon.html": "/pages/ecosystem/allonaorganizasyon.html",
    "allonaotomotiv.html": "/pages/ecosystem/allonaotomotiv.html",
    "allonapet.html": "/pages/ecosystem/allonaevcilhayvan.html",
    "allonasaglik.html": "/pages/ecosystem/allonasaglik.html",
    "allonaseyahat.html": "/pages/ecosystem/allonaseyahat.html",
    "allonasigorta.html": "/pages/ecosystem/allonasigorta.html",
    "allonasporfitness.html": "/pages/ecosystem/allonasporfitness.html",
    "allonataksi.html": "/pages/ecosystem/allonataksi.html",
    "allonaotelcilik.html": "/pages/ecosystem/allonaotelcilik.html",
    "allonatarim.html": "/pages/ecosystem/allonatarim.html",
    "allonateknoloji.html": "/pages/ecosystem/allonateknoloji.html",
    "allonatrade.html": "/pages/ecosystem/allonatrade.html",
    "ayakında.html": "/pages/ecosystem/ayakında.html",
    "danismanlik.html": "/pages/ecosystem/allonadanismanlik.html",
    "denizcilik.html": "/pages/ecosystem/allonadenizcilik.html",
    "eglence.html": "/pages/ecosystem/allonaeglence.html",
    "evhizmetleri.html": "/pages/ecosystem/allonaevhizmetleri.html",
    "finans.html": "/pages/ecosystem/allonafinans.html",
    "gayrimenkul.html": "/pages/ecosystem/allonagayrimenkul.html",
    "guzellik.html": "/pages/ecosystem/allonaguzellik.html",
    "hukuk.html": "/pages/ecosystem/allonahukuk.html",
    "insaat.html": "/pages/ecosystem/allonainsaat.html",
    "kargolojistik.html": "/pages/ecosystem/allonalojistik.html",
    "kurye.html": "/pages/ecosystem/allonakurye.html",
    "maritime.html": "/pages/ecosystem/maritime.html",
    "nakliye.html": "/pages/ecosystem/allonanakliye.html",
    "organizasyondugun.html": "/pages/ecosystem/allonaorganizasyon.html",
    "otomotiv.html": "/pages/ecosystem/allonaotomotiv.html",
    "sigorta.html": "/pages/ecosystem/allonasigorta.html",
    "sportiv.html": "/pages/ecosystem/allonasporfitness.html",
    "tarim.html": "/pages/ecosystem/allonatarim.html",
    "teknoloji.html": "/pages/ecosystem/allonateknoloji.html",
    "yakında.html": "/pages/ecosystem/yakında.html",
    "partner.html": "/pages/partner/partner.html",
    "partner-cargo-settings.html": "/pages/partner/partner-cargo-settings.html",
    "partner-orders.html": "/pages/partner/partner-orders.html",
    "partner-order-detail.html": "/pages/partner/partner-order-detail.html",
    "partner-panel.html": "/pages/partner/partner-panel.html",
    "partner-products.html": "/pages/partner/partner-products.html",
    "partner-pay.html": "/pages/partner/pay.html",
    "partner-uyelik.html": "/pages/partner/partner-uyelik.html",
    "kurucu-uyelik.html": "/pages/partner/kurucu-uyelik.html",
    "pazaryeri-satis.html": "/pages/partner/pazaryeri-satis.html",
    "cerez-politikasi.html": "/pages/legal/cerez-politikasi.html",
    "cerez.html": "/pages/legal/cerez.html",
    "etbis.html": "/pages/legal/etbis-guven-damgasi.html",
    "etbis-guven-damgasi.html": "/pages/legal/etbis-guven-damgasi.html",
    "gizlilik.html": "/pages/legal/gizlilik.html",
    "guven-damgasi.html": "/pages/legal/etbis-guven-damgasi.html",
    "guvenlik-politikasi.html": "/pages/legal/guvenlik-politikasi.html",
    "iade-politikasi.html": "/pages/legal/iade-politikasi.html",
    "iptal-iade.html": "/pages/legal/iptal-iade.html",
    "kullanim-sartlari.html": "/pages/legal/kullanim-sartlari.html",
    "kullanım-sartları.html": "/pages/legal/kullanım-sartları.html",
    "kvkk.html": "/pages/legal/kvkk.html",
    "mesafeli-satis-sozlesmesi.html": "/pages/legal/mesafeli-satis.html",
    "mesafeli-satis.html": "/pages/legal/mesafeli-satis.html",
    "on-bilgilendirme.html": "/pages/legal/on-bilgilendirme.html",
    "teslimat-kargo.html": "/pages/legal/teslimat-kargo.html",
    "hp-nedir.html": "/pages/wallet/hp-nedir.html",
    "hp-wallet-kurallari.html": "/pages/wallet/hp-wallet-kurallari.html",
    "hubwallet.html": "/pages/account/rewards.html",
    "allona.logo.png": "/images/brand/allona.logo.png",
    "avm-dunyasi.png": "/images/modules/avm-dunyasi.png",
    "muhendislik-v2.png": "/images/modules/muhendislik-v2.png",
    "otelcilik.png": "/images/modules/otelcilik.png",
    "trade-v2.png": "/images/modules/trade-v2.png"
  };

  function mapLegacyPath(path) {
    const raw = String(path || "");
    const match = raw.match(/^([^?#]+)([?#].*)?$/);
    if (!match) return raw;
    const target = legacyRoutes[match[1]];
    if (!target) return raw;
    const suffix = match[2] || "";
    if (suffix.startsWith("?") && target.includes("?")) {
      return `${target}&${suffix.slice(1)}`;
    }
    return `${target}${suffix}`;
  }

  function detectBasePath() {
    try {
      const script = document.currentScript && document.currentScript.src;
      if (script) {
        const scriptPath = new URL(script, window.location.href).pathname;
        const marker = "/js/core.js";
        if (scriptPath.endsWith(marker)) {
          return scriptPath.slice(0, -marker.length);
        }
      }

      const pagePath = window.location.pathname;
      const markers = ["/pages/", "/admin/", "/partner/", "/index.html"];
      for (const marker of markers) {
        const index = pagePath.indexOf(marker);
        if (index > 0) return pagePath.slice(0, index);
      }

      if (/\.github\.io$/i.test(window.location.hostname)) {
        const firstSegment = pagePath.split("/").filter(Boolean)[0];
        return firstSegment ? `/${firstSegment}` : "";
      }
    } catch (error) {
      // Fall through to root paths when the browser blocks URL inspection.
    }
    return "";
  }

  const basePath = detectBasePath().replace(/\/$/, "");

  function withBasePath(path) {
    if (!path.startsWith("/")) return path;
    if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) return path;
    return `${basePath}${path}`;
  }

  function url(path) {
    const mapped = mapLegacyPath(path);
    if (/^(https?:)?\/\//.test(mapped) || mapped.startsWith("mailto:") || mapped.startsWith("tel:") || mapped.startsWith("#")) {
      return mapped;
    }
    return withBasePath(mapped);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sanitizeUrl(value, fallbackPath) {
    const fallback = url(fallbackPath || "/images/product-fallback.svg");
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    if (raw.startsWith("/") && !raw.startsWith("//")) return url(raw);
    try {
      const parsed = new URL(raw, window.location.href);
      if (["http:", "https:", "file:"].includes(parsed.protocol)) return parsed.href;
    } catch (error) {
      if (/^[./\w-]/.test(raw)) return escapeHTML(raw);
    }
    return fallback;
  }

  function encodePathSegments(path) {
    return String(path || "")
      .split("/")
      .filter(Boolean)
      .map((part) => {
        try {
          return encodeURIComponent(decodeURIComponent(part));
        } catch (error) {
          return encodeURIComponent(part);
        }
      })
      .join("/");
  }

  function productMediaUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const apiBaseUrl = String(App.config?.apiBaseUrl || "").replace(/\/$/, "");
    if (!apiBaseUrl) return raw;

    if (/^products\/[a-z0-9._/-]+\.(?:avif|jpe?g|png|webp)$/i.test(raw)) {
      return `${apiBaseUrl}/v1/media/product-images/${encodePathSegments(raw)}`;
    }

    try {
      const parsed = new URL(raw, window.location.href);
      const proxyPrefix = "/v1/media/product-images/";
      if (parsed.host === new URL(apiBaseUrl).host && parsed.pathname.startsWith(proxyPrefix)) return parsed.href;

      const storagePrefix = "/storage/v1/object/public/product-images/";
      if (/\.supabase\.co$/i.test(parsed.hostname) && parsed.pathname.startsWith(storagePrefix)) {
        const storagePath = parsed.pathname.slice(storagePrefix.length);
        return `${apiBaseUrl}${proxyPrefix}${encodePathSegments(storagePath)}`;
      }
    } catch (error) {
      return raw;
    }

    return raw;
  }

  const CURRENCY_PREF_KEY = "allona.currency";
  const CURRENCY_RATES_PREFIX = "allona.currency.rates.";
  const BASE_CURRENCY = String(App.config?.baseCurrency || App.config?.currency || "TRY").toUpperCase();
  const CURRENCY_CACHE_MS = Number(App.config?.currencyCacheHours || 12) * 60 * 60 * 1000;
  const supportedCurrencies = ["TRY", "USD", "EUR", "AZN", "KZT", "UZS", "KGS", "AED", "SAR", "GBP", "RUB"];
  const countryCurrencyMap = {
    AD: "EUR", AE: "AED", AF: "AFN", AG: "XCD", AI: "XCD", AL: "ALL", AM: "AMD", AO: "AOA", AR: "ARS", AT: "EUR", AU: "AUD", AW: "AWG", AZ: "AZN",
    BA: "BAM", BB: "BBD", BD: "BDT", BE: "EUR", BF: "XOF", BG: "BGN", BH: "BHD", BI: "BIF", BJ: "XOF", BN: "BND", BO: "BOB", BR: "BRL", BS: "BSD", BT: "BTN", BW: "BWP", BY: "BYN",
    CA: "CAD", CD: "CDF", CG: "XAF", CH: "CHF", CI: "XOF", CL: "CLP", CM: "XAF", CN: "CNY", CO: "COP", CR: "CRC", CV: "CVE", CY: "EUR", CZ: "CZK",
    DE: "EUR", DJ: "DJF", DK: "DKK", DM: "XCD", DO: "DOP", DZ: "DZD", EC: "USD", EE: "EUR", EG: "EGP", ES: "EUR", ET: "ETB",
    FI: "EUR", FJ: "FJD", FR: "EUR", GB: "GBP", GE: "GEL", GH: "GHS", GM: "GMD", GN: "GNF", GR: "EUR", GT: "GTQ", HK: "HKD", HR: "EUR", HU: "HUF",
    ID: "IDR", IE: "EUR", IL: "ILS", IN: "INR", IQ: "IQD", IR: "IRR", IS: "ISK", IT: "EUR", JM: "JMD", JO: "JOD", JP: "JPY",
    KE: "KES", KG: "KGS", KH: "KHR", KR: "KRW", KW: "KWD", KZ: "KZT", LB: "LBP", LI: "CHF", LK: "LKR", LT: "EUR", LU: "EUR", LV: "EUR", LY: "LYD",
    MA: "MAD", MC: "EUR", MD: "MDL", ME: "EUR", MG: "MGA", MK: "MKD", ML: "XOF", MM: "MMK", MN: "MNT", MT: "EUR", MU: "MUR", MX: "MXN", MY: "MYR",
    NG: "NGN", NL: "EUR", NO: "NOK", NP: "NPR", NZ: "NZD", OM: "OMR", PA: "PAB", PE: "PEN", PH: "PHP", PK: "PKR", PL: "PLN", PT: "EUR", PY: "PYG",
    QA: "QAR", RO: "RON", RS: "RSD", RU: "RUB", RW: "RWF", SA: "SAR", SE: "SEK", SG: "SGD", SI: "EUR", SK: "EUR", SN: "XOF", TH: "THB", TJ: "TJS", TM: "TMT",
    TN: "TND", TR: "TRY", UA: "UAH", US: "USD", UY: "UYU", UZ: "UZS", VN: "VND", ZA: "ZAR"
  };
  const timeZoneCountryMap = {
    "Europe/Istanbul": "TR",
    "Asia/Baku": "AZ",
    "Asia/Almaty": "KZ",
    "Asia/Aqtobe": "KZ",
    "Asia/Atyrau": "KZ",
    "Asia/Tashkent": "UZ",
    "Asia/Samarkand": "UZ",
    "Asia/Bishkek": "KG",
    "America/New_York": "US",
    "America/Chicago": "US",
    "America/Denver": "US",
    "America/Los_Angeles": "US",
    "America/Toronto": "CA",
    "Europe/London": "GB",
    "Europe/Berlin": "DE",
    "Europe/Paris": "FR",
    "Europe/Rome": "IT",
    "Europe/Madrid": "ES",
    "Europe/Amsterdam": "NL",
    "Europe/Brussels": "BE",
    "Europe/Vienna": "AT",
    "Europe/Zurich": "CH",
    "Asia/Dubai": "AE",
    "Asia/Riyadh": "SA",
    "Asia/Qatar": "QA",
    "Asia/Kuwait": "KW",
    "Asia/Bahrain": "BH",
    "Asia/Muscat": "OM",
    "Asia/Baghdad": "IQ",
    "Asia/Amman": "JO",
    "Asia/Beirut": "LB",
    "Africa/Cairo": "EG",
    "Africa/Casablanca": "MA",
    "Asia/Tehran": "IR",
    "Asia/Tokyo": "JP",
    "Asia/Seoul": "KR",
    "Asia/Shanghai": "CN",
    "Asia/Singapore": "SG",
    "Asia/Kolkata": "IN"
  };
  const currencyLocaleMap = {
    AED: "ar-AE", AZN: "az-AZ", BHD: "ar-BH", CAD: "en-CA", CHF: "de-CH", CNY: "zh-CN", EGP: "ar-EG", EUR: "de-DE", GBP: "en-GB",
    IQD: "ar-IQ", JOD: "ar-JO", KGS: "ky-KG", KWD: "ar-KW", KZT: "kk-KZ", OMR: "ar-OM", QAR: "ar-QA", SAR: "ar-SA", TRY: "tr-TR", USD: "en-US", UZS: "uz-UZ"
  };
  const currencyState = {
    base: BASE_CURRENCY,
    target: BASE_CURRENCY,
    country: "TR",
    locale: App.config?.locale || "tr-TR",
    rates: { [BASE_CURRENCY]: 1 },
    updatedAt: 0,
    provider: "",
    source: "initial",
    ready: false
  };

  function normalizeCurrency(value) {
    const code = String(value || "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : "";
  }

  function targetCurrencyForCountry(country) {
    return countryCurrencyMap[String(country || "").trim().toUpperCase()] || BASE_CURRENCY;
  }

  function localeForCurrency(currency) {
    return currencyLocaleMap[currency] || App.config?.locale || navigator.language || "tr-TR";
  }

  function currencyParam() {
    try {
      return normalizeCurrency(new URL(window.location.href).searchParams.get("currency"));
    } catch (error) {
      return "";
    }
  }

  function storedCurrency() {
    try {
      return normalizeCurrency(localStorage.getItem(CURRENCY_PREF_KEY));
    } catch (error) {
      return "";
    }
  }

  function regionFromLocale(value) {
    try {
      return new Intl.Locale(value).region || "";
    } catch (error) {
      const parts = String(value || "").split("-");
      return parts.length > 1 ? parts.pop().toUpperCase() : "";
    }
  }

  function detectedCountry() {
    const localeCountry = (navigator.languages || [navigator.language || ""])
      .map(regionFromLocale)
      .find(Boolean);
    if (localeCountry) return localeCountry;
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return timeZoneCountryMap[zone] || "";
    } catch (error) {
      return "";
    }
  }

  function ratesUrls(base) {
    const apiBaseUrl = String(App.config?.apiBaseUrl || "").replace(/\/$/, "");
    const proxyUrl = apiBaseUrl ? `${apiBaseUrl}/v1/currency/rates?base={base}` : "";
    const templates = [
      App.config?.currencyRatesProxyUrl,
      proxyUrl
    ].filter(Boolean);
    return [...new Set(templates)]
      .map((template) => String(template).replace("{base}", encodeURIComponent(base)));
  }

  function readRatesCache(base, allowStale) {
    try {
      const cache = JSON.parse(localStorage.getItem(`${CURRENCY_RATES_PREFIX}${base}`) || "null");
      if (!cache || !cache.rates) return null;
      if (!allowStale && Date.now() - Number(cache.fetchedAt || 0) > CURRENCY_CACHE_MS) return null;
      return cache;
    } catch (error) {
      return null;
    }
  }

  function writeRatesCache(base, payload) {
    try {
      localStorage.setItem(`${CURRENCY_RATES_PREFIX}${base}`, JSON.stringify(payload));
    } catch (error) {}
  }

  function applyRates(payload) {
    if (!payload || !payload.rates) return;
    currencyState.rates = { ...payload.rates, [currencyState.base]: 1 };
    currencyState.updatedAt = Number(payload.updatedAt || Date.now());
    currencyState.provider = payload.provider || "";
    currencyState.source = payload.source || currencyState.source;
    currencyState.ready = true;
  }

  function normalizeRatesPayload(payload, source) {
    const rates = payload?.rates || payload?.conversion_rates || {};
    if (!rates || typeof rates !== "object") throw new Error("currency rates missing");
    if (payload.result && payload.result !== "success") throw new Error(payload["error-type"] || "currency rates failed");
    return {
      rates,
      updatedAt: Number(payload.time_last_update_unix || 0) ? Number(payload.time_last_update_unix) * 1000 : Number(payload.updatedAt || payload.updated_at || Date.now()),
      fetchedAt: Date.now(),
      provider: payload.provider || "ExchangeRate-API",
      source
    };
  }

  async function loadCurrencyRates(options) {
    const settings = options || {};
    if (currencyState.target === currencyState.base && !settings.force) {
      const baseRates = {
        rates: { [currencyState.base]: 1 },
        updatedAt: Date.now(),
        fetchedAt: Date.now(),
        provider: "base_currency",
        source: "base_currency"
      };
      applyRates(baseRates);
      return baseRates;
    }
    const cached = !settings.force && readRatesCache(currencyState.base, false);
    if (cached) {
      applyRates(cached);
      return cached;
    }
    let lastError = null;
    for (const endpoint of ratesUrls(currencyState.base)) {
      try {
        const response = await fetch(endpoint, { cache: "no-cache" });
        if (!response.ok) throw new Error(`currency rates ${response.status}`);
        const payload = await response.json();
        const next = normalizeRatesPayload(payload, "backend_proxy");
        writeRatesCache(currencyState.base, next);
        applyRates(next);
        return next;
      } catch (error) {
        lastError = error;
      }
    }
    const stale = readRatesCache(currencyState.base, true);
    if (stale) {
      applyRates({ ...stale, source: "stale_cache" });
      return stale;
    }
    currencyState.ready = false;
    currencyState.source = lastError ? "unavailable" : "empty";
    return null;
  }

  function convertedAmount(value, fromCurrency, toCurrency) {
    const amount = Number(value || 0);
    const from = normalizeCurrency(fromCurrency) || currencyState.base;
    const to = normalizeCurrency(toCurrency) || currencyState.target;
    if (from === to) return { amount, currency: to };
    const rates = currencyState.rates || {};
    const fromRate = Number(rates[from] || 0);
    const toRate = Number(rates[to] || 0);
    if (!fromRate || !toRate) return { amount, currency: from };
    return { amount: (amount / fromRate) * toRate, currency: to };
  }

  function formatCurrency(value, options) {
    const settings = options || {};
    const sourceCurrency = normalizeCurrency(settings.sourceCurrency || settings.currency) || currencyState.base;
    const targetCurrency = normalizeCurrency(settings.targetCurrency) || currencyState.target;
    const converted = convertedAmount(value, sourceCurrency, targetCurrency);
    return Number(converted.amount || 0).toLocaleString(localeForCurrency(converted.currency), {
      style: "currency",
      currency: converted.currency,
      maximumFractionDigits: Number.isInteger(converted.amount) && Math.abs(converted.amount) >= 1000 ? 0 : 2
    });
  }

  function money(value, options) {
    return formatCurrency(value, options);
  }

  function parseTryAmount(value) {
    const raw = String(value || "").replace(/\s/g, "");
    if (!raw) return NaN;
    if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
    return Number(raw);
  }

  function extractStaticPrice(text) {
    const value = String(text || "");
    const prefixMatch = value.match(/^(.*?)(-?)\s*₺\s*(\d[\d\s.,]*)(.*)$/);
    const suffixMatch = value.match(/^(.*?)(-?)\s*(\d[\d\s.,]*)\s*(?:₺|TL\b|TRY\b)(.*)$/i);
    const match = prefixMatch || suffixMatch;
    if (!match) return null;
    const amount = parseTryAmount(match[3]);
    if (!Number.isFinite(amount)) return null;
    return {
      amount: match[2] === "-" ? -amount : amount,
      before: match[1] || "",
      after: match[4] || ""
    };
  }

  function convertStaticPriceNode(node) {
    if (!node || node.nodeType !== 1 || node.closest("[data-no-currency]")) return;
    if (!node.dataset.basePrice) {
      const parsed = extractStaticPrice(node.textContent);
      if (!parsed) return;
      node.dataset.basePrice = String(parsed.amount);
      node.dataset.priceBefore = parsed.before;
      node.dataset.priceAfter = parsed.after;
      node.dataset.sourceCurrency = BASE_CURRENCY;
    }
    const amount = Number(node.dataset.basePrice);
    if (!Number.isFinite(amount)) return;
    node.textContent = `${node.dataset.priceBefore || ""}${money(amount, { sourceCurrency: node.dataset.sourceCurrency || BASE_CURRENCY })}${node.dataset.priceAfter || ""}`;
    node.dataset.currency = currencyState.target;
  }

  function scanStaticPrices(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const selector = ".price, .compare-price, .tier-price, .shop-promo-price, .food-promo-price, .price-row > span:not(.price-stack):not(.stock):not(.pill), .food-price-line strong, .summary-line strong, .summaryLine strong, [data-currency-price]";
    if (scope.matches && scope.matches(selector)) convertStaticPriceNode(scope);
    scope.querySelectorAll(selector).forEach(convertStaticPriceNode);
  }

  function notifyCurrencyChange() {
    document.documentElement.setAttribute("data-currency", currencyState.target);
    document.documentElement.setAttribute("data-currency-country", currencyState.country || "");
    scanStaticPrices(document);
    document.dispatchEvent(new CustomEvent("allona:currency-changed", { detail: { ...currencyState } }));
  }

  async function setCurrency(currency, options) {
    const selected = normalizeCurrency(currency) || BASE_CURRENCY;
    const settings = options || {};
    currencyState.target = selected;
    currencyState.locale = localeForCurrency(selected);
    if (settings.country) currencyState.country = String(settings.country).toUpperCase();
    if (settings.manual) {
      try {
        localStorage.setItem(CURRENCY_PREF_KEY, selected);
      } catch (error) {}
    }
    await loadCurrencyRates();
    notifyCurrencyChange();
    return { ...currencyState };
  }

  function clearCurrencyPreference() {
    try {
      localStorage.removeItem(CURRENCY_PREF_KEY);
    } catch (error) {}
  }

  async function reverseGeocodeCurrency(latitude, longitude) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=3&addressdetails=1&accept-language=en`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`location currency ${response.status}`);
      const payload = await response.json();
      const country = String(payload.address?.country_code || "").toUpperCase();
      return country ? { country, currency: targetCurrencyForCountry(country) } : null;
    } catch (error) {
      return null;
    }
  }

  async function updateCurrencyFromBrowserLocation() {
    if (storedCurrency() || !navigator.geolocation || !navigator.permissions) return;
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state !== "granted") {
        if ("onchange" in permission) {
          permission.onchange = () => updateCurrencyFromBrowserLocation();
        }
        return;
      }
      navigator.geolocation.getCurrentPosition(async (position) => {
        const match = await reverseGeocodeCurrency(position.coords.latitude, position.coords.longitude);
        if (match && match.currency && match.currency !== currencyState.target) {
          await setCurrency(match.currency, { country: match.country, source: "geolocation" });
        }
      }, () => undefined, { maximumAge: 30 * 60 * 1000, timeout: 8000 });
    } catch (error) {}
  }

  function setupStaticPriceObserver() {
    if (!document.body || document.body.__allonaCurrencyObserver) return;
    scanStaticPrices(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scanStaticPrices(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.body.__allonaCurrencyObserver = observer;
  }

  function initCurrency() {
    const paramCurrency = currencyParam();
    const savedCurrency = storedCurrency();
    const country = detectedCountry() || "TR";
    const selected = paramCurrency || savedCurrency || targetCurrencyForCountry(country);
    currencyState.country = country;
    currencyState.target = normalizeCurrency(selected) || BASE_CURRENCY;
    if (paramCurrency) {
      try {
        localStorage.setItem(CURRENCY_PREF_KEY, paramCurrency);
      } catch (error) {}
    }
    loadCurrencyRates().then(notifyCurrencyChange);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupStaticPriceObserver);
    } else {
      setupStaticPriceObserver();
    }
    updateCurrencyFromBrowserLocation();
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/İ/g, "i")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 90);
  }

  function labelFromValue(value, fallback) {
    if (value == null || value === "") return fallback || "";
    if (typeof value === "string" || typeof value === "number") {
      const label = String(value).trim();
      return label && label !== "[object Object]" ? label : fallback || "";
    }
    if (Array.isArray(value)) return value.map((item) => labelFromValue(item, "")).filter(Boolean).join(", ") || fallback || "";
    if (typeof value === "object") {
      for (const key of ["name", "title", "label", "category_name", "categoryName", "category", "slug", "id"]) {
        const label = labelFromValue(value[key], "");
        if (label && label !== "[object Object]") return label;
      }
      return String(fallback || "");
    }
    return String(value || fallback || "");
  }

  function normalizeProduct(raw) {
    const product = raw || {};
    const name = product.name || product.product_name || "Ürün";
    const description = product.description || product.short_description || "";
    const category = labelFromValue(product.category || product.category_name || product.categoryName, "Genel");
    const id = product.id;
    const slug = product.slug || product.seo_slug || slugify(`${name}-${id || ""}`);
    const partnerId = product.partner_id || product.partnerId || product.seller_id || "";
    const sellerPublicName = product.seller_public_name || product.seller_name || product.partner_name || product.store_name || product.shop_name || product.brand || (partnerId ? "AllonaHub Partner Satıcı" : "AllonaHub");
    const sellerKind = product.seller_kind || product.seller_type_label || (partnerId ? "Partner satıcı" : "Platform satıcısı");
    const sellerLegalName = product.seller_legal_name || product.legal_seller_name || product.seller_company_name || product.company_name || "";
    const sellerCity = product.seller_city || product.seller_location || product.city || "";
    const sellerContact = product.seller_contact || product.seller_support_email || product.seller_email || product.partner_email || "";
    const sellerTaxMasked = product.seller_tax_number_masked || product.tax_number_masked || "";
    const invoiceResponsibility = product.invoice_responsibility || (partnerId
      ? "Fatura ve satış sonrası sorumluluk ilgili partner/satıcı kaydına göre yürütülür."
      : "Fatura ve satış sonrası süreçler AllonaHub resmi şirket kayıtlarıyla yürütülür.");
    const sellerDisclosure = product.seller_disclosure || (partnerId
      ? "Satıcı bilgileri sipariş onayı öncesinde ve faturada gösterilir; destek AllonaHub üzerinden yürütülür."
      : "Satıcı, platform ve destek bilgileri AllonaHub yasal metinleri ve iletişim sayfasında yayınlanır.");

    return {
      ...product,
      id,
      name,
      description,
      category,
      slug,
      price: Number(product.price || 0),
      stock: Number(product.stock ?? 0),
      status: product.status || "active",
      image_url: productMediaUrl(product.image_url || product.image || ""),
      module_key: product.module_key || product.moduleKey || product.catalog_scope || product.module_scope || product.commerce_scope || "",
      created_at: product.created_at || "",
      sold_count: Number(product.sold_count || 0),
      compare_at_price: Number(product.compare_at_price || product.original_price || product.old_price || 0),
      discount_percent: Number(product.discount_percent || product.discount_rate || 0),
      discount_label: product.discount_label || product.discount || "",
      rating: Number(product.rating || product.average_rating || 0),
      review_count: Number(product.review_count || product.reviews_count || product.rating_count || 0),
      favorite_count: Number(product.favorite_count || product.favorites_count || product.favorite_total || 0),
      view_count: Number(product.view_count || product.views_24h || product.view_count_24h || 0),
      cart_count: Number(product.cart_count || product.in_cart_count || product.cart_add_count || 0),
      coupon_label: product.coupon_label || product.coupon_text || (typeof product.coupon === "string" ? product.coupon : ""),
      delivery_label: product.delivery_label || product.shipping_label || product.fulfillment_label || "",
      partner_id: partnerId,
      is_partner_product: Boolean(partnerId),
      seller_name: sellerPublicName,
      seller_public_name: sellerPublicName,
      seller_kind: sellerKind,
      seller_legal_name: sellerLegalName,
      seller_city: sellerCity,
      seller_contact: sellerContact,
      seller_tax_number_masked: sellerTaxMasked,
      invoice_responsibility: invoiceResponsibility,
      seller_disclosure: sellerDisclosure,
      seller_score: Number(product.seller_score || product.store_score || product.partner_score || 0),
      meta_title: product.meta_title || name,
      meta_description: product.meta_description || description
    };
  }

  function productUrl(product) {
    const item = normalizeProduct(product);
    if (item.detail_url) return url(item.detail_url);
    const params = new URLSearchParams();
    if (item.id) params.set("id", item.id);
    if (item.slug) params.set("slug", item.slug);
    return url(`/pages/commerce/product.html?${params.toString()}`);
  }

  function truncate(value, limit) {
    const text = String(value || "").trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
  }

  function compactCount(value) {
    const count = Math.max(0, Number(value || 0));
    if (!count) return "";
    if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1).replace(".", ",")}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(".", ",")}K`;
    return String(count);
  }

  function productSnapshotAttr(product) {
    const snapshot = {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url,
      slug: product.slug,
      rating: product.rating,
      review_count: product.review_count,
      sold_count: product.sold_count,
      favorite_count: product.favorite_count,
      cart_count: product.cart_count,
      view_count: product.view_count,
      coupon_label: product.coupon_label,
      delivery_label: product.delivery_label,
      module_key: product.module_key,
      discount_label: product.discount_label,
      discount_percent: product.discount_percent,
      compare_at_price: product.compare_at_price,
      seller_name: product.seller_name,
      seller_public_name: product.seller_public_name,
      seller_kind: product.seller_kind,
      seller_legal_name: product.seller_legal_name,
      seller_city: product.seller_city,
      seller_contact: product.seller_contact,
      seller_tax_number_masked: product.seller_tax_number_masked,
      invoice_responsibility: product.invoice_responsibility,
      seller_disclosure: product.seller_disclosure,
      seller_score: product.seller_score,
      partner_id: product.partner_id,
      is_partner_product: product.is_partner_product,
      detail_url: product.detail_url || "",
      is_preview: Boolean(product.is_preview)
    };
    return escapeHTML(encodeURIComponent(JSON.stringify(snapshot)));
  }

  let productCardRenderCount = 0;

  function productCardDescriptionId(product) {
    productCardRenderCount += 1;
    const base = String(product.id || product.slug || product.name || "item")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "item";
    return `product-desc-${base}-${productCardRenderCount.toString(36)}`;
  }

  function productCard(raw) {
    const product = normalizeProduct(raw);
    const disabled = product.stock <= 0;
    const image = sanitizeUrl(product.image_url);
    const compareAt = product.compare_at_price > product.price ? product.compare_at_price : 0;
    const discountPercent = product.discount_percent || (compareAt ? Math.round(((compareAt - product.price) / compareAt) * 100) : 0);
    const discount = product.discount_label || (discountPercent > 0 ? `%${Math.min(95, discountPercent)} indirim` : "Fırsat");
    const rating = Math.max(0, Math.min(5, Number(product.rating || product.average_rating || 4.8))).toFixed(1);
    const ratingLabel = product.review_count ? `${rating} (${product.review_count})` : rating;
    const freeShipping = product.price >= Number(App.config?.freeShippingThreshold || 1500);
    const couponLabel = product.coupon_label || (discountPercent >= 10 ? "Kuponlu" : "");
    const deliveryLabel = product.delivery_label || (freeShipping ? "Ücretsiz kargo" : "Hızlı teslimat");
    const valueLabel = product.value_label || product.good_price_label || (discountPercent >= 20 ? "İyi fiyat" : product.sold_count >= 150 ? "Çok satan" : "");
    const socialSignals = [
      product.sold_count ? `${compactCount(product.sold_count)} satış` : "",
      product.favorite_count ? `${compactCount(product.favorite_count)} favori` : "",
      product.cart_count ? `${compactCount(product.cart_count)} sepette` : "",
      product.view_count ? `${compactCount(product.view_count)} görüntüleme` : ""
    ].filter(Boolean);
    const socialProof = socialSignals.length
      ? socialSignals.slice(0, 2).join(" · ")
      : (product.seller_score ? `${Number(product.seller_score).toFixed(1)} satıcı puanı` : `${product.seller_name || product.brand || "Allona"} güvencesi`);
    const productHref = productUrl(product);
    const descriptionId = productCardDescriptionId(product);

    return `
      <article class="product-card" data-product-card="${escapeHTML(product.id)}" aria-describedby="${escapeHTML(descriptionId)}">
        <a class="product-card__media" href="${escapeHTML(productHref)}" aria-label="${escapeHTML(product.name)}" data-product-preview-link="${escapeHTML(product.id)}" data-product-snapshot="${productSnapshotAttr(product)}">
          <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.src='${url("/images/product-fallback.svg")}'">
        </a>
        <button class="product-card__favorite" type="button" data-fav-product="${escapeHTML(product.id)}" aria-label="Favoriye ekle">♡</button>
        <div class="product-card__body">
          <div class="product-card__meta">
            <span class="pill">${escapeHTML(product.category)}</span>
            <span class="pill pill--deal">${escapeHTML(discount)}</span>
            <span class="${disabled ? "stock stock--out" : "stock"}">${disabled ? "Stok yok" : `${product.stock} stok`}</span>
          </div>
          <div class="product-card__deal-row">
            ${valueLabel ? `<span class="market-signal market-signal--value">${escapeHTML(valueLabel)}</span>` : ""}
            ${couponLabel ? `<span class="market-signal market-signal--coupon">${escapeHTML(couponLabel)}</span>` : ""}
            <span class="market-signal market-signal--delivery">${escapeHTML(deliveryLabel)}</span>
          </div>
          <h3><a href="${escapeHTML(productHref)}">${escapeHTML(product.name)}</a></h3>
          <p class="product-card__description" id="${escapeHTML(descriptionId)}">${escapeHTML(truncate(product.description, 92))}</p>
          <div class="product-card__signals">
            <span class="product-rating" aria-label="Ürün puanı">★ ${escapeHTML(ratingLabel)}</span>
            <span class="product-social-proof">${escapeHTML(socialProof)}</span>
          </div>
          <div class="product-card__seller" aria-label="Satıcı bilgisi">
            <span>${escapeHTML(product.seller_kind)}</span>
            <strong>${escapeHTML(product.seller_public_name)}</strong>
          </div>
          <div class="price-row">
            <span class="price-stack">
              <span class="price" data-currency-price data-base-price="${escapeHTML(product.price)}" data-source-currency="${BASE_CURRENCY}">${money(product.price)}</span>
              ${compareAt ? `<span class="compare-price" data-currency-price data-base-price="${escapeHTML(compareAt)}" data-source-currency="${BASE_CURRENCY}">${money(compareAt)}</span>` : ""}
            </span>
            <span class="pill pill--gold">Allona</span>
          </div>
          <div class="product-card__actions">
            <button class="btn" type="button" data-add-product="${escapeHTML(product.id)}" data-product-snapshot="${productSnapshotAttr(product)}" ${disabled ? "disabled" : ""}>Sepete Ekle</button>
            <a class="link-btn product-card__detail-link" href="${escapeHTML(productHref)}" data-product-preview-link="${escapeHTML(product.id)}" data-product-snapshot="${productSnapshotAttr(product)}">İncele</a>
          </div>
        </div>
      </article>
    `;
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function renderStatus(target, message, type) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    el.innerHTML = `<div class="status-box ${type ? `status-box--${type}` : ""}">${escapeHTML(message)}</div>`;
  }

  function setMeta({ title, description, image, url: pageUrl, schema }) {
    if (title) {
      document.title = title;
      setMetaTag("og:title", title, "property");
      setMetaTag("twitter:title", title, "name");
    }
    if (description) {
      setMetaTag("description", description, "name");
      setMetaTag("og:description", description, "property");
      setMetaTag("twitter:description", description, "name");
    }
    if (image) {
      setMetaTag("og:image", image, "property");
      setMetaTag("twitter:image", image, "name");
    }
    if (pageUrl) {
      setMetaTag("og:url", pageUrl, "property");
      const canonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = pageUrl;
      document.head.appendChild(canonical);
    }
    if (schema) {
      let node = document.querySelector("#product-schema");
      if (!node) {
        node = document.createElement("script");
        node.type = "application/ld+json";
        node.id = "product-schema";
        document.head.appendChild(node);
      }
      node.textContent = JSON.stringify(schema);
    }
  }

  function setMetaTag(key, value, attr) {
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", value);
  }

  function toast(message, type) {
    const text = String(message || "").trim();
    if (!text) return;
    let wrap = document.querySelector(".toast");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast";
      wrap.setAttribute("aria-live", "polite");
      document.body.appendChild(wrap);
    }
    const state = window.__allonaToastState || { seen: new Map() };
    window.__allonaToastState = state;
    const tone = ["success", "warning", "error", "info"].includes(type) ? type : "info";
    const key = `${tone}:${text.toLocaleLowerCase("tr-TR").replace(/\d+(?:[.,]\d+)?/g, "#")}`;
    const now = Date.now();
    const isProgressToast = /(indirildi|yükleme|yükleniyor|çekme|çekilecek|getirildi|aktar|senkron)/i.test(text);
    const duplicateWindowMs = isProgressToast ? 60000 : 12000;
    const recentAt = Number(state.seen.get(key) || 0);
    const existing = Array.from(wrap.querySelectorAll(".toast__item"))
      .find((node) => node.dataset.toastKey === key);
    if (now - recentAt < duplicateWindowMs) {
      state.seen.set(key, now);
      if (existing) {
        clearTimeout(existing._allonaToastTimer);
        existing._allonaToastTimer = setTimeout(() => existing.remove(), 3600);
      }
      return;
    }
    state.seen.set(key, now);
    while (wrap.children.length >= 3) {
      wrap.firstElementChild?.remove();
    }
    const item = document.createElement("div");
    item.className = `toast__item toast__item--${tone}${tone === "error" ? " toast__item--error" : ""}`;
    item.dataset.toastKey = key;
    item.textContent = text;
    wrap.appendChild(item);
    item._allonaToastTimer = setTimeout(() => item.remove(), 3600);
  }

  function parseForm(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function normalizeText(value, options) {
    const settings = options || {};
    const max = Number(settings.max || 500);
    return String(value ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function normalizeMultiline(value, options) {
    const settings = options || {};
    const max = Number(settings.max || 1200);
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, max);
  }

  function isEmail(value) {
    return /^[^\s@]{2,120}@[^\s@]{2,120}\.[^\s@]{2,20}$/i.test(String(value || "").trim());
  }

  function isPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function sanitizePublicUrl(value) {
    const raw = normalizeText(value, { max: 300 });
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      if (["https:", "http:"].includes(parsed.protocol)) return parsed.href;
    } catch (error) {
      return "";
    }
    return "";
  }

  function rateLimit(key, options) {
    const settings = options || {};
    const limit = Number(settings.limit || 5);
    const windowMs = Number(settings.windowMs || 60000);
    const storageKey = `allona_rate:${key}`;
    const now = Date.now();
    let hits = [];
    try {
      hits = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (error) {
      hits = [];
    }
    hits = hits.filter((time) => now - Number(time) < windowMs);
    if (hits.length >= limit) {
      return {
        allowed: false,
        retryAfter: Math.ceil((windowMs - (now - Number(hits[0]))) / 1000)
      };
    }
    hits.push(now);
    localStorage.setItem(storageKey, JSON.stringify(hits));
    return { allowed: true, retryAfter: 0 };
  }

  function publicErrorMessage(error, fallback) {
    const message = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
    if (/row-level security|permission denied|forbidden|unauthorized|jwt|auth/i.test(message)) {
      return "Bu işlem için oturum yetkiniz doğrulanamadı. Lütfen tekrar giriş yapın.";
    }
    if (/network|failed to fetch|timeout/i.test(message)) {
      return "Bağlantı sorunu oluştu. Lütfen kısa süre sonra tekrar deneyin.";
    }
    return fallback || "İşlem şu anda tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
  }

  function debounce(fn, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  App.core = {
    url,
    escapeHTML,
    sanitizeUrl,
    productMediaUrl,
    money,
    slugify,
    labelFromValue,
    normalizeProduct,
    productCard,
    productUrl,
    truncate,
    getParam,
    renderStatus,
    setMeta,
    toast,
    parseForm,
    debounce
  };

  App.currency = {
    state: currencyState,
    supported: supportedCurrencies,
    targetForCountry: targetCurrencyForCountry,
    convert(value, fromCurrency, toCurrency) {
      return convertedAmount(value, fromCurrency, toCurrency);
    },
    toBase(value, sourceCurrency) {
      return convertedAmount(value, sourceCurrency || currencyState.target, currencyState.base);
    },
    format: money,
    setCurrency,
    clearPreference: clearCurrencyPreference,
    refresh() {
      return loadCurrencyRates({ force: true }).then(() => {
        notifyCurrencyChange();
        return { ...currencyState };
      });
    },
    scan: scanStaticPrices
  };

  App.security = {
    normalizeText,
    normalizeMultiline,
    isEmail,
    isPhone,
    isUuid,
    sanitizePublicUrl,
    rateLimit,
    publicErrorMessage
  };

  initCurrency();
})();
