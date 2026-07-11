(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  let lines = [];

  function uniqueSellerNames() {
    return [...new Set(lines
      .map((item) => item.product.seller_public_name || item.product.seller_name || "AllonaHub")
      .filter(Boolean))]
      .slice(0, 4);
  }

  function renderSummary() {
    const summary = document.querySelector("[data-cart-summary]");
    if (!summary) return;
    const totals = App.cart.totals(lines);
    const sellers = uniqueSellerNames();
    summary.innerHTML = `
      <h2>Sipariş Özeti</h2>
      <div class="summary-line"><span>Ara toplam</span><strong>${core.money(totals.subtotal)}</strong></div>
      <div class="summary-line"><span>Kargo</span><strong>${totals.shipping ? core.money(totals.shipping) : "Ücretsiz"}</strong></div>
      <div class="summary-line summary-line--total"><span>Toplam</span><strong>${core.money(totals.total)}</strong></div>
      ${lines.length ? `
        <div class="summary-legal">
          <strong>Satıcı ve yasal bilgilendirme</strong>
          <p>${core.escapeHTML(sellers.join(", "))}${sellers.length === 4 ? " ve diğer satıcılar" : ""}</p>
          <p>Ödeme öncesinde satıcı, teslimat, fatura, cayma hakkı ve ön bilgilendirme metinlerini kontrol edebilirsiniz.</p>
          <span>
            <a href="${core.url("/pages/legal/on-bilgilendirme.html")}" target="_blank" rel="noopener">Ön Bilgilendirme</a>
            <a href="${core.url("/pages/legal/mesafeli-satis.html")}" target="_blank" rel="noopener">Mesafeli Satış</a>
            <a href="${core.url("/pages/legal/iade-politikasi.html")}" target="_blank" rel="noopener">İade ve Cayma</a>
          </span>
        </div>
      ` : ""}
      ${lines.length
        ? `<a class="btn btn--full" href="${core.url("/pages/commerce/guvenli-odeme.html")}">Ödemeye Geç</a>`
        : `<button class="btn btn--full" type="button" disabled>Ödemeye Geç</button>`}
      <button class="btn btn--light btn--full" type="button" data-clear-cart ${lines.length ? "" : "disabled"}>Sepeti Temizle</button>
    `;
  }

  function renderCart() {
    const list = document.querySelector("[data-cart-list]");
    if (!list) return;
    if (!lines.length) {
      list.innerHTML = `<div class="empty-state">Sepetinizde ürün yok. <a href="${core.url("/pages/commerce/shop.html")}">Mağazaya dönün</a>.</div>`;
      renderSummary();
      return;
    }

    list.innerHTML = lines.map((item) => `
      <article class="cart-item" data-cart-row="${core.escapeHTML(item.product.id)}">
        <img src="${core.escapeHTML(core.sanitizeUrl(item.product.image_url))}" alt="${core.escapeHTML(item.product.name)}" loading="lazy" onerror="this.src='${core.url("/images/product-fallback.svg")}'">
        <div>
          <h3><a href="${core.escapeHTML(core.productUrl(item.product))}">${core.escapeHTML(item.product.name)}</a></h3>
          <p>${core.escapeHTML(item.product.category)} · ${core.money(item.product.price)}</p>
          <p class="cart-item__seller">
            <span>${core.escapeHTML(item.product.seller_kind || "Satıcı")}</span>
            <strong>${core.escapeHTML(item.product.seller_public_name || item.product.seller_name || "AllonaHub")}</strong>
          </p>
        </div>
        <div class="cart-item__actions">
          <div class="quantity-control">
            <button type="button" data-cart-dec="${core.escapeHTML(item.product.id)}">-</button>
            <span>${item.qty}</span>
            <button type="button" data-cart-inc="${core.escapeHTML(item.product.id)}">+</button>
          </div>
          <strong>${core.money(item.product.price * item.qty)}</strong>
          <button class="btn btn--danger" type="button" data-cart-remove="${core.escapeHTML(item.product.id)}">Sil</button>
        </div>
      </article>
    `).join("");
    renderSummary();
  }

  async function loadCart() {
    const list = document.querySelector("[data-cart-list]");
    if (!list) return;
    core.renderStatus(list, "Sepet yükleniyor...");
    try {
      lines = await App.cart.hydrate();
      renderCart();
    } catch (error) {
      core.renderStatus(list, error.message || "Sepet yüklenemedi.", "error");
    }
  }

  function bindCart() {
    document.addEventListener("click", async (event) => {
      const inc = event.target.closest("[data-cart-inc]");
      const dec = event.target.closest("[data-cart-dec]");
      const remove = event.target.closest("[data-cart-remove]");
      const clear = event.target.closest("[data-clear-cart]");

      if (inc) {
        const item = lines.find((line) => String(line.product.id) === String(inc.dataset.cartInc));
        if (item) await App.cart.setQty(item.product.id, item.qty + 1);
        await loadCart();
      }
      if (dec) {
        const item = lines.find((line) => String(line.product.id) === String(dec.dataset.cartDec));
        if (item) await App.cart.setQty(item.product.id, item.qty - 1);
        await loadCart();
      }
      if (remove) {
        await App.cart.remove(remove.dataset.cartRemove);
        await loadCart();
      }
      if (clear) {
        await App.cart.clear();
        await loadCart();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='cart']")) return;
    bindCart();
    loadCart();
    document.addEventListener("allona:currency-changed", () => renderCart());
  });
})();
