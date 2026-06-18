(function () {
  const App = window.Allona = window.Allona || {};

  function isNestedPage() {
    return /\/(admin|partner)\//.test(window.location.pathname);
  }

  function url(path) {
    if (/^(https?:)?\/\//.test(path) || path.startsWith("mailto:") || path.startsWith("tel:")) {
      return path;
    }
    return `${isNestedPage() ? "../" : ""}${path}`;
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
    const fallback = url(fallbackPath || "images/product-fallback.svg");
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    try {
      const parsed = new URL(raw, window.location.href);
      if (["http:", "https:", "file:"].includes(parsed.protocol)) return parsed.href;
    } catch (error) {
      if (/^[./\w-]/.test(raw)) return escapeHTML(raw);
    }
    return fallback;
  }

  function money(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString(App.config.locale, {
      style: "currency",
      currency: App.config.currency
    });
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

  function normalizeProduct(raw) {
    const product = raw || {};
    const name = product.name || product.product_name || "Ürün";
    const description = product.description || product.short_description || "";
    const category = product.category || "Genel";
    const id = product.id;
    const slug = product.slug || product.seo_slug || slugify(`${name}-${id || ""}`);

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
      image_url: product.image_url || product.image || "",
      created_at: product.created_at || "",
      sold_count: Number(product.sold_count || 0),
      meta_title: product.meta_title || name,
      meta_description: product.meta_description || description
    };
  }

  function productUrl(product) {
    const item = normalizeProduct(product);
    const params = new URLSearchParams();
    if (item.id) params.set("id", item.id);
    if (item.slug) params.set("slug", item.slug);
    return url(`product.html?${params.toString()}`);
  }

  function truncate(value, limit) {
    const text = String(value || "").trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
  }

  function productCard(raw) {
    const product = normalizeProduct(raw);
    const disabled = product.stock <= 0;
    const image = sanitizeUrl(product.image_url);

    return `
      <article class="product-card" data-product-card="${escapeHTML(product.id)}">
        <a class="product-card__media" href="${escapeHTML(productUrl(product))}" aria-label="${escapeHTML(product.name)}">
          <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.src='${url("images/product-fallback.svg")}'">
        </a>
        <div class="product-card__body">
          <div class="product-card__meta">
            <span class="pill">${escapeHTML(product.category)}</span>
            <span class="${disabled ? "stock stock--out" : "stock"}">${disabled ? "Stok yok" : `${product.stock} stok`}</span>
          </div>
          <h3><a href="${escapeHTML(productUrl(product))}">${escapeHTML(product.name)}</a></h3>
          <p class="product-card__description">${escapeHTML(truncate(product.description, 92))}</p>
          <div class="price-row">
            <span class="price">${money(product.price)}</span>
            <span class="pill pill--gold">Allona</span>
          </div>
          <div class="product-card__actions">
            <button class="btn" type="button" data-add-product="${escapeHTML(product.id)}" ${disabled ? "disabled" : ""}>Sepete Ekle</button>
            <button class="icon-btn" type="button" data-fav-product="${escapeHTML(product.id)}" aria-label="Favoriye ekle">♡</button>
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
    let wrap = document.querySelector(".toast");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast";
      wrap.setAttribute("aria-live", "polite");
      document.body.appendChild(wrap);
    }
    const item = document.createElement("div");
    item.className = `toast__item ${type === "error" ? "toast__item--error" : ""}`;
    item.textContent = message;
    wrap.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function parseForm(form) {
    return Object.fromEntries(new FormData(form).entries());
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
    money,
    slugify,
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
})();
