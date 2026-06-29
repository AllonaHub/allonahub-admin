(function () {
  const App = window.Allona = window.Allona || {};
  const MAX_EDGE = 1800;
  const WEBP_QUALITY = 0.86;
  const BUCKET = "product-images";
  const PREFIX = "products/optimized";
  const MEDIA_PROXY = "https://api.allonahub.com/v1/media/product-images";

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function slugify(value) {
    const coreSlug = App.core && App.core.slugify ? App.core.slugify(value) : "";
    return (coreSlug || String(value || "urun-gorseli")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""))
      .slice(0, 80) || "urun-gorseli";
  }

  function setSubmitDisabled(form, disabled) {
    form.querySelectorAll("button[type='submit']").forEach((button) => {
      button.disabled = disabled;
    });
  }

  function encodePath(path) {
    return String(path || "")
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function imageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Görsel okunamadı."));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
    });
  }

  async function fileToWebp(file) {
    if (!/^image\//i.test(file.type || "")) throw new Error("Lütfen geçerli bir görsel seçin.");
    const image = await imageFromFile(file);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error("Görsel ölçüleri okunamadı.");

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error("Tarayıcı WebP dönüşümünü tamamlayamadı.");
    return {
      blob,
      original: { width, height, bytes: file.size },
      optimized: { width: targetWidth, height: targetHeight, bytes: blob.size }
    };
  }

  async function uploadProductImage(form, file) {
    const client = App.db && App.db.client ? App.db.client() : null;
    if (!client) throw new Error("Supabase oturumu hazırlanamadı.");
    const name = form.elements.name && form.elements.name.value || file.name;
    const converted = await fileToWebp(file);
    const bytes = await converted.blob.arrayBuffer();
    const digest = (await sha256Hex(bytes)).slice(0, 16);
    const date = new Date().toISOString().slice(0, 10);
    const path = `${PREFIX}/${date}-${slugify(name)}-${digest}.webp`;

    const { error } = await client.storage.from(BUCKET).upload(path, converted.blob, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false
    });
    if (error && !/already|exists|duplicate/i.test(error.message || "")) throw error;

    return {
      url: `${MEDIA_PROXY}/${encodePath(path)}?v=${digest}`,
      path,
      ...converted
    };
  }

  function markUrlInput(input, value) {
    if (!input) return;
    input.value = value || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function attachProductImageUpload(form) {
    const fileInput = $("[data-product-image-file]", form);
    const urlInput = $("[data-product-image-url]", form) || form.elements.image_url;
    if (!fileInput || !urlInput || fileInput.dataset.mediaUploadReady === "true") return;
    fileInput.dataset.mediaUploadReady = "true";
    const defaultPlaceholder = urlInput.placeholder;

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      setSubmitDisabled(form, true);
      const previousPlaceholder = urlInput.placeholder;
      urlInput.placeholder = "Görsel hazırlanıyor...";
      form.__productImageUpload = uploadProductImage(form, file);
      try {
        const result = await form.__productImageUpload;
        markUrlInput(urlInput, result.url);
        urlInput.placeholder = previousPlaceholder;
        if (App.core && App.core.toast) App.core.toast("Görsel hazırlandı.");
      } catch (error) {
        form.__productImageUpload = null;
        fileInput.value = "";
        urlInput.placeholder = previousPlaceholder;
        if (App.core && App.core.toast) App.core.toast(error.message || "Görsel yüklenemedi.", "error");
      } finally {
        setSubmitDisabled(form, false);
      }
    });

    form.addEventListener("reset", () => {
      form.__productImageUpload = null;
      window.setTimeout(() => {
        urlInput.placeholder = defaultPlaceholder;
      }, 0);
    });

    form.addEventListener("submit", async (event) => {
      if (!form.__productImageUpload || form.dataset.productImageSubmitting === "true") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSubmitDisabled(form, true);
      try {
        const result = await form.__productImageUpload;
        markUrlInput(urlInput, result.url);
        form.dataset.productImageSubmitting = "true";
        form.requestSubmit();
      } catch (error) {
        if (App.core && App.core.toast) App.core.toast(error.message || "Görsel yüklenemedi.", "error");
      } finally {
        form.dataset.productImageSubmitting = "";
        setSubmitDisabled(form, false);
      }
    }, true);
  }

  function init() {
    document.querySelectorAll("[data-product-form]").forEach(attachProductImageUpload);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
