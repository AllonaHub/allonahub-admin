(function () {
  const App = window.Allona = window.Allona || {};
  const LANG_KEY = "allona.language";
  const THEME_KEY = "allona.theme";
  const REMOTE_CACHE_PREFIX = "allona.remoteTranslations.";
  const languages = [
    { code: "tr", label: "TR" },
    { code: "en", label: "EN" },
    { code: "de", label: "DE" },
    { code: "ru", label: "RU" },
    { code: "ar", label: "AR" }
  ];
  const themes = [
    { code: "neon", label: "Beyaz Neon" },
    { code: "allona", label: "Deniz Mavisi" },
    { code: "marketplace", label: "Ferah Market" }
  ];
  const themeAliases = {
    ocean: "allona",
    forest: "marketplace",
    sunset: "neon",
    graphite: "allona"
  };
  const state = {
    language: localStorage.getItem(LANG_KEY) || "tr",
    theme: themeAliases[localStorage.getItem(THEME_KEY)] || localStorage.getItem(THEME_KEY) || "neon",
    packs: {}
  };

  function isNestedPage() {
    return /\/(admin|partner)\//.test(window.location.pathname);
  }

  function assetUrl(path) {
    if (App.core && App.core.url) return App.core.url(path);
    if (/^(https?:)?\/\//.test(path) || path.startsWith("mailto:") || path.startsWith("tel:")) return path;
    return `${isNestedPage() ? "../" : ""}${path}`;
  }

  function ensurePlatformCss() {
    if (document.querySelector('link[href$="css/platform.css"], link[href$="../css/platform.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetUrl("css/platform.css");
    document.head.appendChild(link);
  }

  function applyTheme(theme) {
    const normalized = themeAliases[theme] || theme;
    const selected = themes.some((item) => item.code === normalized) ? normalized : "neon";
    state.theme = selected;
    localStorage.setItem(THEME_KEY, selected);
    document.body.setAttribute("data-theme", selected);
    document.querySelectorAll("[data-theme-select]").forEach((node) => {
      node.value = selected;
    });
  }

  async function loadLanguage(language) {
    const selected = languages.some((item) => item.code === language) ? language : "tr";
    if (state.packs[selected]) return state.packs[selected];
    try {
      const response = await fetch(assetUrl(`i18n/${selected}.json`), { cache: "no-cache" });
      if (!response.ok) throw new Error(`i18n ${selected} ${response.status}`);
      const pack = await response.json();
      state.packs[selected] = pack;
      return pack;
    } catch (error) {
      console.warn("AllonaHub language pack could not be loaded:", error.message);
      state.packs[selected] = { dir: "ltr", phrases: {}, keys: {} };
      return state.packs[selected];
    }
  }

  function ownTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION)$/i.test(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function translateExactText(pack) {
    const phrases = pack.phrases || {};
    const roots = document.querySelectorAll("header, nav, main, footer, .top-mini-nav, .site-shell");
    roots.forEach((root) => {
      ownTextNodes(root).forEach((node) => {
        if (!node.__allonaSourceText) node.__allonaSourceText = node.textContent;
        const source = node.__allonaSourceText.trim();
        const translated = phrases[source];
        if (!translated) {
          node.textContent = node.__allonaSourceText;
          return;
        }
        const prefix = node.__allonaSourceText.match(/^\s*/)[0];
        const suffix = node.__allonaSourceText.match(/\s*$/)[0];
        node.textContent = `${prefix}${translated}${suffix}`;
      });
    });

    document.querySelectorAll("[placeholder]").forEach((node) => {
      if (!node.__allonaSourcePlaceholder) node.__allonaSourcePlaceholder = node.getAttribute("placeholder");
      const translated = phrases[node.__allonaSourcePlaceholder];
      node.setAttribute("placeholder", translated || node.__allonaSourcePlaceholder);
    });
  }

  function translationEndpoint() {
    return (App.config && App.config.translationEndpoint) || window.ALLONA_TRANSLATION_ENDPOINT || "";
  }

  function sourceTextNodes(pack) {
    const phrases = pack.phrases || {};
    const nodes = [];
    const roots = document.querySelectorAll("header, nav, main, footer, .top-mini-nav, .site-shell");
    roots.forEach((root) => {
      ownTextNodes(root).forEach((node) => {
        const source = (node.__allonaSourceText || node.textContent || "").trim();
        if (!source || phrases[source]) return;
        if (source.length < 2 || source.length > 180) return;
        nodes.push({ node, source });
      });
    });
    return nodes;
  }

  function readRemoteCache(language) {
    try {
      return JSON.parse(localStorage.getItem(`${REMOTE_CACHE_PREFIX}${language}`) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeRemoteCache(language, cache) {
    try {
      localStorage.setItem(`${REMOTE_CACHE_PREFIX}${language}`, JSON.stringify(cache));
    } catch (error) {
      // Translation still works for the current page when storage quota is full.
    }
  }

  function applyRemoteTranslations(nodes, translations) {
    nodes.forEach(({ node, source }) => {
      const translated = translations[source];
      if (!translated) return;
      const original = node.__allonaSourceText || node.textContent;
      const prefix = original.match(/^\s*/)[0];
      const suffix = original.match(/\s*$/)[0];
      node.textContent = `${prefix}${translated}${suffix}`;
    });
  }

  async function translateOnline(language, pack) {
    const endpoint = translationEndpoint();
    if (!endpoint || language === "tr") return;
    const nodes = sourceTextNodes(pack);
    if (!nodes.length) return;
    const cache = readRemoteCache(language);
    applyRemoteTranslations(nodes, cache);
    const missing = [...new Set(nodes.map((item) => item.source).filter((source) => !cache[source]))].slice(0, 80);
    if (!missing.length) return;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "tr", target: language, texts: missing })
      });
      if (!response.ok) throw new Error(`translation endpoint ${response.status}`);
      const payload = await response.json();
      const remote = Array.isArray(payload.translations)
        ? Object.fromEntries(missing.map((source, index) => [source, payload.translations[index]]))
        : (payload.translations || {});
      const nextCache = { ...cache, ...remote };
      writeRemoteCache(language, nextCache);
      applyRemoteTranslations(nodes, nextCache);
    } catch (error) {
      console.warn("AllonaHub online translation fallback failed:", error.message);
    }
  }

  async function applyLanguage(language) {
    const selected = languages.some((item) => item.code === language) ? language : "tr";
    state.language = selected;
    localStorage.setItem(LANG_KEY, selected);
    const pack = await loadLanguage(selected);
    document.documentElement.lang = selected;
    document.documentElement.dir = pack.dir || (selected === "ar" ? "rtl" : "ltr");
    translateExactText(pack);
    translateOnline(selected, pack);
    document.querySelectorAll("[data-language-select]").forEach((node) => {
      node.value = selected;
      node.setAttribute("aria-label", (pack.keys && pack.keys.languageLabel) || "Dil");
    });
    document.dispatchEvent(new CustomEvent("allona:language-changed", { detail: { language: selected } }));
  }

  function controlsMarkup(mode) {
    return `
      <div class="platform-controls ${mode === "home" ? "platform-controls--home" : ""}" data-platform-controls>
        <select class="platform-select" data-language-select aria-label="Dil seçimi">
          ${languages.map((item) => `<option value="${item.code}">${item.label}</option>`).join("")}
        </select>
        <select class="platform-select" data-theme-select aria-label="Tema seçimi">
          ${themes.map((item) => `<option value="${item.code}">${item.label}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function mountControls() {
    if (document.querySelector("[data-platform-controls]")) return;
    const slot = document.querySelector("[data-platform-controls-slot]");
    if (slot) {
      slot.innerHTML = controlsMarkup(slot.dataset.platformControlsSlot || "");
      bindControlValues();
      return;
    }
    const account = document.querySelector("[data-account-link], a.login");
    if (account) {
      account.insertAdjacentHTML("afterend", controlsMarkup(account.classList.contains("login") ? "home" : ""));
      bindControlValues();
    }
  }

  function bindControlValues() {
    document.querySelectorAll("[data-language-select]").forEach((node) => {
      node.value = state.language;
    });
    document.querySelectorAll("[data-theme-select]").forEach((node) => {
      node.value = state.theme;
    });
  }

  function inferRoute(label) {
    const text = String(label || "").toLocaleLowerCase("tr-TR").trim();
    const rules = [
      [/sepet|ödeme|sipariş/i, "cart.html"],
      [/favori/i, "favorites.html"],
      [/adres/i, "addresses.html"],
      [/profil|hesab/i, "profile.html"],
      [/partner|başvuru|restoran partneri|hizmet veren/i, "partner.html"],
      [/destek|yardım|sss|sıkça/i, "destek.html"],
      [/kampanya|kupon/i, "kuponlar.html"],
      [/hp|wallet|cüzdan|puan/i, "hubwallet.html"],
      [/gizlilik/i, "gizlilik.html"],
      [/çerez/i, "cerez.html"],
      [/kvkk/i, "kvkk.html"],
      [/kullanım|şart/i, "kullanim-sartlari.html"],
      [/mesafeli|sözleşme/i, "mesafeli-satis.html"],
      [/iletişim|bize/i, "iletisim.html"],
      [/modül|hizmet/i, "ecosystem.html#modules"],
      [/kariyer|iş/i, "allonakariyer.html"],
      [/allona shop|ürün|mağaza/i, "allonashop.html"],
      [/yemek|restoran/i, "allonayemek.html"],
      [/market/i, "allonamarket.html"],
      [/taksi|taxi/i, "allonataksi.html"]
    ];
    const found = rules.find(([rule]) => rule.test(text));
    if (found) return found[1];
    return `arama.html?q=${encodeURIComponent(label || "AllonaHub")}`;
  }

  function repairEmptyLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href="#"]');
      if (!link) return;
      event.preventDefault();
      const label = link.textContent.trim() || link.getAttribute("aria-label") || "AllonaHub";
      window.location.href = assetUrl(inferRoute(label));
    });
  }

  function bindEvents() {
    document.addEventListener("change", (event) => {
      const languageSelect = event.target.closest("[data-language-select]");
      if (languageSelect) applyLanguage(languageSelect.value);
      const themeSelect = event.target.closest("[data-theme-select]");
      if (themeSelect) applyTheme(themeSelect.value);
    });
    document.addEventListener("allona:layout-ready", () => {
      mountControls();
      applyTheme(state.theme);
      applyLanguage(state.language);
    });
  }

  async function init() {
    ensurePlatformCss();
    applyTheme(state.theme);
    mountControls();
    repairEmptyLinks();
    await applyLanguage(state.language);
  }

  bindEvents();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  App.platform = {
    languages,
    themes,
    setLanguage: applyLanguage,
    setTheme: applyTheme,
    assetUrl
  };
})();
