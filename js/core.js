(function () {
  const App = window.Allona = window.Allona || {};

  const legacyRoutes = {
    "index.html": "/index.html",
    "addresses.html": "/pages/account/addresses.html",
    "belgeler.html": "/pages/account/belgeler.html",
    "bildirimler.html": "/pages/account/bildirimler.html",
    "favorites.html": "/pages/account/favorites.html",
    "forgot-password.html": "/pages/account/forgot-password.html",
    "gorevler.html": "/pages/account/gorevler.html",
    "login.html": "/pages/account/login.html",
    "mfa.html": "/pages/account/mfa.html",
    "orders.html": "/pages/account/orders.html",
    "order-detail.html": "/pages/account/order-detail.html",
    "premium.html": "/pages/account/premium.html",
    "profil.html": "/pages/account/profil.html",
    "profile.html": "/pages/account/profile.html",
    "register.html": "/pages/account/register.html",
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
    "cart.html": "/pages/commerce/cart.html",
    "checkout.html": "/pages/commerce/guvenli-odeme.html",
    "guvenli-odeme.html": "/pages/commerce/guvenli-odeme.html",
    "iyzico-pay.html": "/pages/commerce/iyzico-pay.html",
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
    "partner-pay.html": "/pages/partner/pay.html",
    "partner-uyelik.html": "/pages/partner/partner-uyelik.html",
    "pazaryeri-satis.html": "/pages/partner/pazaryeri-satis.html",
    "cerez-politikasi.html": "/pages/legal/cerez-politikasi.html",
    "cerez.html": "/pages/legal/cerez.html",
    "gizlilik.html": "/pages/legal/gizlilik.html",
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
    return target ? `${target}${match[2] || ""}` : raw;
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
      seller_name: product.seller_name || product.partner_name || product.store_name || product.brand || "Allona Partner",
      seller_score: Number(product.seller_score || product.store_score || product.partner_score || 0),
      meta_title: product.meta_title || name,
      meta_description: product.meta_description || description
    };
  }

  function productUrl(product) {
    const item = normalizeProduct(product);
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
      seller_score: product.seller_score
    };
    return escapeHTML(encodeURIComponent(JSON.stringify(snapshot)));
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

    return `
      <article class="product-card" data-product-card="${escapeHTML(product.id)}">
        <a class="product-card__media" href="${escapeHTML(productHref)}" aria-label="${escapeHTML(product.name)}">
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
          <p class="product-card__description">${escapeHTML(truncate(product.description, 92))}</p>
          <div class="product-card__signals">
            <span class="product-rating" aria-label="Ürün puanı">★ ${escapeHTML(ratingLabel)}</span>
            <span class="product-social-proof">${escapeHTML(socialProof)}</span>
          </div>
          <div class="price-row">
            <span class="price-stack">
              <span class="price">${money(product.price)}</span>
              ${compareAt ? `<span class="compare-price">${money(compareAt)}</span>` : ""}
            </span>
            <span class="pill pill--gold">Allona</span>
          </div>
          <div class="product-card__actions">
            <button class="btn" type="button" data-add-product="${escapeHTML(product.id)}" data-product-snapshot="${productSnapshotAttr(product)}" ${disabled ? "disabled" : ""}>Sepete Ekle</button>
            <a class="link-btn product-card__detail-link" href="${escapeHTML(productHref)}">İncele</a>
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
})();
