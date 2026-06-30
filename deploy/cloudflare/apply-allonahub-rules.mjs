#!/usr/bin/env node

const API = "https://api.cloudflare.com/client/v4";
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const applyPartnerDns = process.env.APPLY_PARTNER_DNS === "1";
const applyApiWafOnly = process.env.APPLY_API_WAF_ONLY === "1";
const applyWildcardDns = process.env.APPLY_WILDCARD_DNS === "1" || process.env.APPLY_MODULE_DNS === "1";

if (!token || !zoneId) {
  console.error("Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
};

async function cf(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((item) => item.message).join("; ") || response.statusText;
    throw new Error(`${options.method || "GET"} ${path}: ${message}`);
  }
  return payload.result;
}

async function getEntrypoint(phase) {
  try {
    return await cf(`/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
  } catch (error) {
    if (/not found|does not exist|could not find entrypoint ruleset/i.test(error.message)) return null;
    throw error;
  }
}

async function upsertEntrypoint(phase, name, rules, options = {}) {
  const current = await getEntrypoint(phase);
  if (!current) {
    return cf(`/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name,
        description: "AllonaHub ETBIS/Güven Damgasi production rules",
        kind: "zone",
        phase,
        rules
      })
    });
  }

  const managedRefs = new Set(rules.map((rule) => rule.ref));
  const keptRules = (current.rules || []).filter((rule) => !managedRefs.has(rule.ref));
  const nextRules = options.prepend ? [...rules, ...keptRules] : [...keptRules, ...rules];
  return cf(`/zones/${zoneId}/rulesets/${current.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: current.name || name,
      description: current.description || "AllonaHub ETBIS/Güven Damgasi production rules",
      kind: "zone",
      phase,
      rules: nextRules
    })
  });
}

const hostExpression = '(http.host eq "allonahub.com" or http.host eq "www.allonahub.com")';
const subdomainHostExpression = 'ends_with(http.host, ".allonahub.com")';
const partnerHostExpression = 'http.host eq "partner.allonahub.com"';
const publicHostExpression = `(${hostExpression} or ${subdomainHostExpression})`;
const apiHostExpression = 'http.host eq "api.allonahub.com"';

const MODULE_SUBDOMAIN_ROUTES = [
  { key: "app", hosts: ["app"], target: "/index.html" },
  { key: "admin", hosts: ["admin"], target: "/admin/index.html" },
  { key: "owner", hosts: ["owner", "superadmin", "super-admin"], target: "/admin/super-admin.html" },
  { key: "partner", hosts: ["partner", "seller", "satici"], target: "/pages/partner/partner.html" },
  { key: "checkout", hosts: ["checkout", "odeme"], target: "/pages/commerce/guvenli-odeme.html" },
  { key: "legal", hosts: ["legal", "yasal"], target: "/legal/index.html" },
  { key: "wallet", hosts: ["wallet", "hp"], target: "/pages/wallet/hp-nedir.html" },
  { key: "account", hosts: ["account", "hesap"], target: "/pages/account/user.html" },
  { key: "shop", hosts: ["shop", "allonashop", "magaza"], target: "/pages/commerce/allonashop.html" },
  { key: "food", hosts: ["yemek", "food", "allonayemek"], target: "/pages/commerce/allonayemek.html" },
  { key: "market", hosts: ["market", "allonamarket"], target: "/pages/commerce/allonamarket.html" },
  { key: "taxi", hosts: ["taksi", "taxi", "allonataksi"], target: "/pages/ecosystem/allonataksi.html" },
  { key: "mall", hosts: ["avm", "mall"], target: "/pages/ecosystem/allonaavm.html" },
  { key: "travel", hosts: ["seyahat", "travel", "turizm"], target: "/pages/ecosystem/allonaseyahat.html" },
  { key: "real-estate", hosts: ["emlak", "gayrimenkul"], target: "/pages/ecosystem/allonagayrimenkul.html" },
  { key: "maritime", hosts: ["denizcilik", "maritime"], target: "/pages/ecosystem/allonadenizcilik.html" },
  { key: "legal-services", hosts: ["hukuk"], target: "/pages/ecosystem/allonahukuk.html" },
  { key: "consulting", hosts: ["danismanlik", "consulting"], target: "/pages/ecosystem/allonadanismanlik.html" },
  { key: "education", hosts: ["egitim", "education"], target: "/pages/ecosystem/allonaegitim.html" },
  { key: "career", hosts: ["kariyer", "career"], target: "/pages/career/allonakariyer.html" },
  { key: "finance", hosts: ["finans", "finance"], target: "/pages/ecosystem/allonafinans.html" },
  { key: "automotive", hosts: ["otomotiv", "auto", "arac"], target: "/pages/ecosystem/allonaotomotiv.html" },
  { key: "events", hosts: ["eglence", "etkinlik", "events"], target: "/pages/ecosystem/allonaeglence.html" },
  { key: "pet", hosts: ["pet", "evcilhayvan"], target: "/pages/ecosystem/allonaevcilhayvan.html" },
  { key: "technology", hosts: ["teknoloji", "tech"], target: "/pages/ecosystem/allonateknoloji.html" },
  { key: "sports-fitness", hosts: ["spor", "fitness", "sporfitness"], target: "/pages/ecosystem/allonasporfitness.html" },
  { key: "beauty", hosts: ["guzellik", "kozmetik", "beauty"], target: "/pages/ecosystem/allonaguzellik.html" },
  { key: "insurance", hosts: ["sigorta", "insurance"], target: "/pages/ecosystem/allonasigorta.html" },
  { key: "courier", hosts: ["kurye", "teslimat"], target: "/pages/ecosystem/allonakurye.html" },
  { key: "home-services", hosts: ["evhizmetleri", "usta"], target: "/pages/ecosystem/allonaevhizmetleri.html" },
  { key: "logistics", hosts: ["lojistik", "kargo"], target: "/pages/ecosystem/allonalojistik.html" },
  { key: "moving", hosts: ["nakliye"], target: "/pages/ecosystem/allonanakliye.html" },
  { key: "organization", hosts: ["organizasyon", "dugun"], target: "/pages/ecosystem/allonaorganizasyon.html" },
  { key: "agriculture", hosts: ["tarim", "agriculture"], target: "/pages/ecosystem/allonatarim.html" },
  { key: "construction", hosts: ["insaat", "yapi"], target: "/pages/ecosystem/allonainsaat.html" },
  { key: "engineering", hosts: ["muhendislik", "engineering"], target: "/pages/ecosystem/allonamuhendislik.html" },
  { key: "trade", hosts: ["trade", "ticaret"], target: "/pages/ecosystem/allonatrade.html" },
  { key: "hospitality", hosts: ["otelcilik", "otel", "hotel"], target: "/pages/ecosystem/allonaotelcilik.html" },
  { key: "health", hosts: ["saglik", "health"], target: "/pages/ecosystem/allonasaglik.html" }
];

function expressionSet(values) {
  return `{${values.map((value) => `"${value}"`).join(" ")}}`;
}

const moduleSubdomainRedirectRules = MODULE_SUBDOMAIN_ROUTES
  .filter((route) => route.target !== "/index.html")
  .map((route) => {
    const canonicalHost = `${route.hosts[0]}.allonahub.com`;
    const hostNames = route.hosts.map((host) => `${host}.allonahub.com`);
    return {
      ref: `allonahub-subdomain-${route.key}-entry`,
      description: `Route ${canonicalHost} to ${route.target}`,
      expression: `http.host in ${expressionSet(hostNames)} and http.request.uri.path in {"/" "/index.html"}`,
      action: "redirect",
      action_parameters: {
        from_value: {
          status_code: 301,
          target_url: { value: `https://${canonicalHost}${route.target}` },
          preserve_query_string: true
        }
      }
    };
  });

async function upsertDnsRecord(record) {
  const query = new URLSearchParams({
    type: record.type,
    name: record.name
  });
  const existing = await cf(`/zones/${zoneId}/dns_records?${query.toString()}`);
  const payload = {
    type: record.type,
    name: record.name,
    content: record.content,
    proxied: record.proxied !== false,
    ttl: 1,
    comment: record.comment || "Managed by AllonaHub deploy script"
  };
  if (existing && existing.length) {
    return cf(`/zones/${zoneId}/dns_records/${existing[0].id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }
  return cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

const headerRules = [{
  ref: "allonahub-security-headers",
  description: "AllonaHub security headers",
  expression: publicHostExpression,
  action: "rewrite",
  action_parameters: {
    headers: {
      "Strict-Transport-Security": { operation: "set", value: "max-age=31536000; includeSubDomains; preload" },
      "X-Content-Type-Options": { operation: "set", value: "nosniff" },
      "X-Frame-Options": { operation: "set", value: "SAMEORIGIN" },
      "Referrer-Policy": { operation: "set", value: "strict-origin-when-cross-origin" },
      "Permissions-Policy": { operation: "set", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" }
    }
  }
}];

const redirectRules = [
  ...moduleSubdomainRedirectRules,
  {
    ref: "allonahub-main-partner-entry-to-subdomain",
    description: "Move partner entry pages to partner subdomain",
    expression: `${hostExpression} and http.request.uri.path in {"/partner" "/partner/" "/partner.html" "/partner-login.html" "/partner-giris.html" "/partner/index.html" "/partner/login" "/partner/login/" "/partner/giris" "/partner/giris/" "/pages/partner/partner.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://partner.allonahub.com/" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-main-partner-panel-to-subdomain",
    description: "Move partner panel pages to partner subdomain",
    expression: `${hostExpression} and http.request.uri.path in {"/partner-panel" "/partner-panel/" "/partner-panel.html" "/partner/panel" "/partner/panel/" "/partner/os" "/partner/os/" "/partner/partner-panel.html" "/pages/partner/partner-panel.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://partner.allonahub.com/panel" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-main-partner-products-to-subdomain",
    description: "Move partner product manager pages to partner subdomain",
    expression: `${hostExpression} and http.request.uri.path in {"/partner-products" "/partner-products/" "/partner-products.html" "/partner/products" "/partner/products/" "/partner/urunlerim" "/partner/urunlerim/" "/partner/ürünlerim" "/partner/ürünlerim/" "/partner/partner-products.html" "/pages/partner/partner-products.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://partner.allonahub.com/products" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-partner-subdomain-entry",
    description: "Route partner subdomain entry paths to login page",
    expression: `${partnerHostExpression} and http.request.uri.path in {"/" "/login" "/login/" "/giris" "/giris/" "/basvuru" "/basvuru/" "/partner" "/partner/" "/partner.html" "/partner-login.html" "/partner-giris.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://partner.allonahub.com/pages/partner/partner.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-partner-subdomain-panel",
    description: "Route partner subdomain panel paths to Partner OS",
    expression: `${partnerHostExpression} and http.request.uri.path in {"/panel" "/panel/" "/os" "/os/" "/partner-panel" "/partner-panel/" "/partner-panel.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://partner.allonahub.com/pages/partner/partner-panel.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-partner-subdomain-products",
    description: "Route partner subdomain product manager paths to products page",
    expression: `${partnerHostExpression} and http.request.uri.path in {"/products" "/products/" "/urunlerim" "/urunlerim/" "/ürünlerim" "/ürünlerim/" "/partner-products" "/partner-products/" "/partner-products.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://partner.allonahub.com/pages/partner/partner-products.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-partner-entry-shortlinks",
    description: "Redirect partner entry short links",
    expression: `${hostExpression} and http.request.uri.path in {"/partner" "/partner/" "/partner.html" "/partner-login.html" "/partner-giris.html" "/partner/index.html" "/partner/login" "/partner/login/" "/partner/giris" "/partner/giris/"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/partner/partner.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-partner-panel-shortlinks",
    description: "Redirect partner panel short links",
    expression: `${hostExpression} and http.request.uri.path in {"/partner-panel" "/partner-panel/" "/partner-panel.html" "/partner/panel" "/partner/panel/" "/partner/os" "/partner/os/" "/partner/partner-panel.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/partner/partner-panel.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-partner-products-shortlinks",
    description: "Redirect partner product manager short links",
    expression: `${hostExpression} and http.request.uri.path in {"/partner-products" "/partner-products/" "/partner-products.html" "/partner/products" "/partner/products/" "/partner/urunlerim" "/partner/urunlerim/" "/partner/ürünlerim" "/partner/ürünlerim/" "/partner/partner-products.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/partner/partner-products.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-checkout-redirect",
    description: "Redirect legacy checkout to secure payment",
    expression: `${hostExpression} and http.request.uri.path eq "/checkout.html"`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/commerce/guvenli-odeme.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-etbis-shortlinks",
    description: "Redirect ETBIS and Güven Damgasi short links",
    expression: `${hostExpression} and http.request.uri.path in {"/etbis.html" "/guven-damgasi.html" "/etbis-guven-damgasi.html"}`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/legal/etbis-guven-damgasi.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-legal-mesafeli-satis-redirect",
    description: "Redirect old distance sales legal page",
    expression: `${hostExpression} and http.request.uri.path eq "/pages/legal/mesafeli-satis-sozlesmesi.html"`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/legal/mesafeli-satis.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-legal-cerez-redirect",
    description: "Redirect old cookie policy legal page",
    expression: `${hostExpression} and http.request.uri.path eq "/pages/legal/cerez.html"`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/legal/cerez-politikasi.html" },
        preserve_query_string: true
      }
    }
  },
  {
    ref: "allonahub-legal-iptal-iade-redirect",
    description: "Redirect old cancellation/refund legal page",
    expression: `${hostExpression} and http.request.uri.path eq "/pages/legal/iptal-iade.html"`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: "https://allonahub.com/pages/legal/iade-politikasi.html" },
        preserve_query_string: true
      }
    }
  }
];

const apiSkipChallengeParameters = {
  ruleset: "current",
  products: [
    "bic",
    "hot",
    "securityLevel",
    "uaBlock",
    "waf",
    "zoneLockdown"
  ],
  phases: [
    "http_request_firewall_managed",
    "http_request_sbfm"
  ]
};

const wafRules = [
  {
    ref: "allonahub-api-runtime-skip-challenge",
    description: "Skip browser challenges for the public API runtime",
    expression: `${apiHostExpression} and (http.request.uri.path in {"/health" "/ready"} or starts_with(http.request.uri.path, "/v1/"))`,
    action: "skip",
    action_parameters: apiSkipChallengeParameters,
    logging: {
      enabled: true
    }
  },
  {
    ref: "allonahub-api-cron-skip-challenge",
    description: "Skip challenge for authenticated API cron calls",
    expression: `${apiHostExpression} and http.request.method eq "POST" and starts_with(http.request.uri.path, "/v1/cron/")`,
    action: "skip",
    action_parameters: apiSkipChallengeParameters,
    logging: {
      enabled: true
    }
  }
];

const cacheRules = [{
  ref: "allonahub-product-media-cache",
  description: "Cache proxied Supabase product images at Cloudflare edge",
  expression: `${apiHostExpression} and http.request.method eq "GET" and starts_with(http.request.uri.path, "/v1/media/product-images/")`,
  action: "set_cache_settings",
  action_parameters: {
    cache: true,
    edge_ttl: {
      mode: "override_origin",
      default: 31536000
    },
    browser_ttl: {
      mode: "override_origin",
      default: 31536000
    },
    cache_key: {
      ignore_query_strings_order: true
    },
    serve_stale: {
      disable_stale_while_updating: false
    }
  }
}];

if (applyApiWafOnly) {
  await upsertEntrypoint("http_request_firewall_custom", "AllonaHub WAF custom rules", wafRules, { prepend: true });
  console.log("Cloudflare AllonaHub API WAF rules applied.");
  process.exit(0);
}

if (applyPartnerDns) {
  await upsertDnsRecord({
    type: "CNAME",
    name: "partner.allonahub.com",
    content: "allonahub.com",
    proxied: true,
    comment: "AllonaHub partner portal subdomain"
  });
}

if (applyWildcardDns) {
  await upsertDnsRecord({
    type: "CNAME",
    name: "*.allonahub.com",
    content: "allonahub.com",
    proxied: true,
    comment: "AllonaHub wildcard module subdomains"
  });
}

await upsertEntrypoint("http_response_headers_transform", "AllonaHub response header rules", headerRules);
await upsertEntrypoint("http_request_dynamic_redirect", "AllonaHub redirect rules", redirectRules);
await upsertEntrypoint("http_request_firewall_custom", "AllonaHub WAF custom rules", wafRules, { prepend: true });
await upsertEntrypoint("http_request_cache_settings", "AllonaHub cache rules", cacheRules, { prepend: true });

console.log([
  "Cloudflare AllonaHub rules applied.",
  applyPartnerDns ? "Partner DNS applied." : "Partner DNS skipped; set APPLY_PARTNER_DNS=1 to create it.",
  applyWildcardDns ? "Wildcard module DNS applied." : "Wildcard module DNS skipped; set APPLY_WILDCARD_DNS=1 to create it."
].join(" "));
