#!/usr/bin/env node

const API = "https://api.cloudflare.com/client/v4";
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;

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
const apiHostExpression = 'http.host eq "api.allonahub.com"';

const headerRules = [{
  ref: "allonahub-security-headers",
  description: "AllonaHub security headers",
  expression: hostExpression,
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

const wafRules = [{
  ref: "allonahub-api-cron-skip-challenge",
  description: "Skip challenge for authenticated API cron calls",
  expression: `${apiHostExpression} and http.request.method eq "POST" and starts_with(http.request.uri.path, "/v1/cron/")`,
  action: "skip",
  action_parameters: {
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
  },
  logging: {
    enabled: true
  }
}];

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

await upsertEntrypoint("http_response_headers_transform", "AllonaHub response header rules", headerRules);
await upsertEntrypoint("http_request_dynamic_redirect", "AllonaHub redirect rules", redirectRules);
await upsertEntrypoint("http_request_firewall_custom", "AllonaHub WAF custom rules", wafRules, { prepend: true });
await upsertEntrypoint("http_request_cache_settings", "AllonaHub cache rules", cacheRules, { prepend: true });

console.log("Cloudflare AllonaHub rules applied.");
