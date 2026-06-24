(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  function canQueryRemoteProduct(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
  }

  function compactCount(value) {
    const count = Math.max(0, Number(value || 0));
    if (!count) return "";
    if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1).replace(".", ",")}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(".", ",")}K`;
    return String(count);
  }

  function renderProduct(product) {
    const root = document.querySelector("[data-product-detail]");
    if (!root) return;
    const image = core.sanitizeUrl(product.image_url);
    const compareAt = product.compare_at_price > product.price ? product.compare_at_price : 0;
    const discountPercent = product.discount_percent || (compareAt ? Math.round(((compareAt - product.price) / compareAt) * 100) : 0);
    const discountLabel = product.discount_label || (discountPercent > 0 ? `%${Math.min(95, discountPercent)} indirim` : "");
    const rating = Math.max(0, Math.min(5, Number(product.rating || product.average_rating || 4.8))).toFixed(1);
    const ratingLabel = product.review_count ? `${rating} (${product.review_count})` : rating;
    const freeShipping = product.price >= Number(App.config?.freeShippingThreshold || 1500);
    const couponLabel = product.coupon_label || (discountPercent >= 10 ? "Sepette kupon avantajı" : "");
    const deliveryLabel = product.delivery_label || (freeShipping ? "Ücretsiz kargo" : "Hızlı teslimat");
    const socialSignals = [
      product.sold_count ? `${compactCount(product.sold_count)} satış` : "",
      product.favorite_count ? `${compactCount(product.favorite_count)} favori` : "",
      product.cart_count ? `${compactCount(product.cart_count)} sepette` : "",
      product.view_count ? `${compactCount(product.view_count)} görüntüleme` : ""
    ].filter(Boolean);
    const sellerScore = product.seller_score ? `${Number(product.seller_score).toFixed(1)} satıcı puanı` : "Doğrulanmış satıcı";

    root.innerHTML = `
      <div class="product-detail__media panel">
        <img src="${core.escapeHTML(image)}" alt="${core.escapeHTML(product.name)}" loading="eager" onerror="this.src='${core.url("/images/product-fallback.svg")}'">
      </div>
      <section class="product-detail__info panel">
        <div class="product-detail__topline">
          <span class="pill">${core.escapeHTML(product.category)}</span>
          ${discountLabel ? `<span class="pill pill--deal">${core.escapeHTML(discountLabel)}</span>` : ""}
          ${couponLabel ? `<span class="market-signal market-signal--coupon">${core.escapeHTML(couponLabel)}</span>` : ""}
        </div>
        <h1>${core.escapeHTML(product.name)}</h1>
        <div class="product-detail__signals">
          <span class="product-rating" aria-label="Ürün puanı">★ ${core.escapeHTML(ratingLabel)}</span>
          ${socialSignals.length ? `<span class="product-social-proof">${core.escapeHTML(socialSignals.join(" · "))}</span>` : ""}
        </div>
        <p>${core.escapeHTML(product.description || "Ürün açıklaması yakında güncellenecek.")}</p>
        <div class="price-row">
          <span class="price-stack">
            <span class="price">${core.money(product.price)}</span>
            ${compareAt ? `<span class="compare-price">${core.money(compareAt)}</span>` : ""}
          </span>
          <span class="${product.stock > 0 ? "stock" : "stock stock--out"}">${product.stock > 0 ? `${product.stock} stok` : "Stok yok"}</span>
        </div>
        <div class="product-detail__assurance" aria-label="Alışveriş güvenceleri">
          <span><strong>${core.escapeHTML(deliveryLabel)}</strong> Teslimat bilgisi ödeme adımında netleşir.</span>
          <span><strong>Güvenli ödeme</strong> AllonaHub ödeme altyapısıyla korunur.</span>
          <span><strong>Kolay iade</strong> İade ve destek süreci hesap panelinden izlenir.</span>
        </div>
        <div class="product-detail__seller">
          <span>${core.escapeHTML(product.seller_name || product.brand || "Allona Partner")}</span>
          <strong>${core.escapeHTML(sellerScore)}</strong>
        </div>
        <div class="form-actions">
          <div class="quantity-control" aria-label="Adet">
            <button type="button" data-qty-dec>-</button>
            <input type="number" min="1" max="${Math.max(product.stock, 1)}" value="1" data-product-qty aria-label="Adet">
            <button type="button" data-qty-inc>+</button>
          </div>
          <button class="btn" type="button" data-detail-add ${product.stock <= 0 ? "disabled" : ""}>Sepete Ekle</button>
          <button class="btn btn--light" type="button" data-fav-product="${core.escapeHTML(product.id)}">Favoriye Ekle</button>
        </div>
      </section>
    `;

    core.setMeta({
      title: `${product.meta_title || product.name} | AllonaHub`,
      description: product.meta_description || product.description || "AllonaHub ürün detayı.",
      image,
      url: window.location.href,
      schema: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image,
        sku: String(product.id),
        category: product.category,
        brand: product.brand ? {
          "@type": "Brand",
          name: product.brand
        } : undefined,
        aggregateRating: Number(rating) ? {
          "@type": "AggregateRating",
          ratingValue: rating,
          reviewCount: Math.max(1, Number(product.review_count || product.sold_count || 1))
        } : undefined,
        offers: {
          "@type": "Offer",
          price: product.price,
          priceCurrency: "TRY",
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: window.location.href
        }
      }
    });

    root.addEventListener("click", async (event) => {
      const qtyInput = root.querySelector("[data-product-qty]");
      const qty = Math.max(1, Number(qtyInput.value || 1));

      if (event.target.closest("[data-qty-dec]")) {
        qtyInput.value = Math.max(1, qty - 1);
      }
      if (event.target.closest("[data-qty-inc]")) {
        qtyInput.value = Math.min(Math.max(product.stock, 1), qty + 1);
      }
      if (event.target.closest("[data-detail-add]")) {
        const button = event.target.closest("[data-detail-add]");
        try {
          button.disabled = true;
          await App.cart.add(product.id, qty, product);
        } catch (error) {
          core.toast(error.message || "Ürün sepete eklenemedi.", "error");
        } finally {
          button.disabled = product.stock <= 0;
        }
      }
    });
  }

  async function init() {
    const root = document.querySelector("[data-product-detail]");
    if (!root) return;
    const id = core.getParam("id");
    if (!id) {
      core.renderStatus(root, "Ürün bağlantısı eksik.", "error");
      return;
    }

    core.renderStatus(root, "Ürün yükleniyor...");
    try {
      if (!canQueryRemoteProduct(id)) {
        core.renderStatus(root, "Ürün bağlantısı geçersiz veya eski demo kaydına ait.", "error");
        return;
      }
      const product = await App.db.products.byId(id);
      if (!product) {
        core.renderStatus(root, "Ürün bulunamadı veya aktif değil.", "error");
        return;
      }
      renderProduct(product);
    } catch (error) {
      core.renderStatus(root, error.message || "Ürün yüklenemedi.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
