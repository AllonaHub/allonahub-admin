(function () {
  const ROOT_DOMAIN = "allonahub.com";

  const routes = [
    { key: "app", hosts: ["app"], target: "/index.html" },
    { key: "admin", hosts: ["admin"], target: "/admin/index.html" },
    { key: "owner", hosts: ["owner", "superadmin", "super-admin"], target: "/admin/super-admin.html" },
    {
      key: "partner",
      hosts: ["partner", "seller", "satici"],
      target: "/pages/partner/partner.html",
      aliases: {
        "/login": "/pages/partner/partner.html",
        "/giris": "/pages/partner/partner.html",
        "/basvuru": "/pages/partner/partner.html",
        "/panel": "/pages/partner/partner-panel.html",
        "/os": "/pages/partner/partner-panel.html",
        "/products": "/pages/partner/partner-products.html",
        "/urunlerim": "/pages/partner/partner-products.html",
        "/ürünlerim": "/pages/partner/partner-products.html"
      }
    },
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
    { key: "real_estate", hosts: ["emlak", "gayrimenkul"], target: "/pages/ecosystem/allonagayrimenkul.html" },
    { key: "maritime", hosts: ["denizcilik", "maritime"], target: "/pages/ecosystem/allonadenizcilik.html" },
    { key: "legal_services", hosts: ["hukuk"], target: "/pages/ecosystem/allonahukuk.html" },
    { key: "consulting", hosts: ["danismanlik", "consulting"], target: "/pages/ecosystem/allonadanismanlik.html" },
    { key: "education", hosts: ["egitim", "education"], target: "/pages/ecosystem/allonaegitim.html" },
    { key: "career", hosts: ["kariyer", "career"], target: "/pages/career/allonakariyer.html" },
    { key: "finance", hosts: ["finans", "finance"], target: "/pages/ecosystem/allonafinans.html" },
    { key: "automotive", hosts: ["otomotiv", "auto", "arac"], target: "/pages/ecosystem/allonaotomotiv.html" },
    { key: "events", hosts: ["eglence", "etkinlik", "events"], target: "/pages/ecosystem/allonaeglence.html" },
    { key: "pet", hosts: ["pet", "evcilhayvan"], target: "/pages/ecosystem/allonaevcilhayvan.html" },
    { key: "technology", hosts: ["teknoloji", "tech"], target: "/pages/ecosystem/allonateknoloji.html" },
    { key: "sports_fitness", hosts: ["spor", "fitness", "sporfitness"], target: "/pages/ecosystem/allonasporfitness.html" },
    { key: "beauty", hosts: ["guzellik", "kozmetik", "beauty"], target: "/pages/ecosystem/allonaguzellik.html" },
    { key: "insurance", hosts: ["sigorta", "insurance"], target: "/pages/ecosystem/allonasigorta.html" },
    { key: "courier", hosts: ["kurye", "teslimat"], target: "/pages/ecosystem/allonakurye.html" },
    { key: "home_services", hosts: ["evhizmetleri", "usta"], target: "/pages/ecosystem/allonaevhizmetleri.html" },
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

  const App = window.Allona = window.Allona || {};
  App.subdomainRoutes = routes;

  function currentSubdomain(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
    if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return "";
    const suffix = `.${ROOT_DOMAIN}`;
    if (!host.endsWith(suffix)) return "";
    const prefix = host.slice(0, -suffix.length);
    return prefix && !prefix.includes(".") ? prefix : "";
  }

  function normalizePath(path) {
    const clean = String(path || "/").replace(/\/{2,}/g, "/");
    if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
    return clean || "/";
  }

  function routeForSubdomain(subdomain) {
    return routes.find((route) => route.hosts.includes(subdomain));
  }

  function targetForPath(route, pathname) {
    const path = normalizePath(pathname);
    const aliases = Object.assign({}, route.aliases || {});
    if (route.target !== "/index.html") {
      aliases["/"] = route.target;
      aliases["/index.html"] = route.target;
    }
    return aliases[path] || "";
  }

  function redirectTo(target) {
    const nextPath = normalizePath(target);
    const currentPath = normalizePath(window.location.pathname);
    if (!nextPath || nextPath === currentPath) return;
    window.location.replace(`${window.location.origin}${nextPath}${window.location.search}${window.location.hash}`);
  }

  const subdomain = currentSubdomain(window.location.hostname);
  const route = routeForSubdomain(subdomain);
  if (!route) return;

  App.currentSubdomainRoute = route;
  redirectTo(targetForPath(route, window.location.pathname));
})();
