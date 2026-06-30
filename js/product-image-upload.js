(function () {
  const App = window.Allona = window.Allona || {};
  const MAX_EDGE = 1800;
  const MAX_IMAGES = 8;
  const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
  const WEBP_QUALITY = 0.86;
  const BUCKET = "product-images";
  const IMAGE_PREFIX = "products/optimized";
  const VIDEO_PREFIX = "products/videos";
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

  function mediaUrl(path, digest) {
    return `${MEDIA_PROXY}/${encodePath(path)}?v=${digest}`;
  }

  function toast(message, type) {
    if (App.core && App.core.toast) App.core.toast(message, type);
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

  function fileBaseName(form, file) {
    return form.elements.name && form.elements.name.value || file.name || "urun-medya";
  }

  async function uploadProductImage(form, file, index) {
    const client = App.db && App.db.client ? App.db.client() : null;
    if (!client) throw new Error("Supabase oturumu hazırlanamadı.");
    const converted = await fileToWebp(file);
    const bytes = await converted.blob.arrayBuffer();
    const digest = (await sha256Hex(bytes)).slice(0, 16);
    const date = new Date().toISOString().slice(0, 10);
    const order = String(Number(index || 0) + 1).padStart(2, "0");
    const path = `${IMAGE_PREFIX}/${date}-${slugify(fileBaseName(form, file))}-${order}-${digest}.webp`;

    const { error } = await client.storage.from(BUCKET).upload(path, converted.blob, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false
    });
    if (error && !/already|exists|duplicate/i.test(error.message || "")) throw error;

    return {
      url: mediaUrl(path, digest),
      path,
      type: "image",
      ...converted
    };
  }

  async function uploadProductImages(form, files) {
    const selected = Array.from(files || []).slice(0, MAX_IMAGES);
    const results = [];
    for (let index = 0; index < selected.length; index += 1) {
      results.push(await uploadProductImage(form, selected[index], index));
    }
    return results;
  }

  function videoExtension(file) {
    const fromName = String(file.name || "").match(/\.([a-z0-9]{2,8})$/i)?.[1];
    if (fromName) return fromName.toLowerCase();
    if (/webm/i.test(file.type || "")) return "webm";
    if (/quicktime|mov/i.test(file.type || "")) return "mov";
    return "mp4";
  }

  async function uploadProductVideo(form, file) {
    const client = App.db && App.db.client ? App.db.client() : null;
    if (!client) throw new Error("Supabase oturumu hazırlanamadı.");
    if (!/^video\//i.test(file.type || "")) throw new Error("Lütfen geçerli bir video seçin.");
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Video en fazla 80 MB olabilir.");

    const buffer = await file.arrayBuffer();
    const digest = (await sha256Hex(buffer)).slice(0, 16);
    const date = new Date().toISOString().slice(0, 10);
    const path = `${VIDEO_PREFIX}/${date}-${slugify(fileBaseName(form, file))}-${digest}.${videoExtension(file)}`;
    const uploadFile = new File([buffer], file.name || `urun-video.${videoExtension(file)}`, {
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified || Date.now()
    });

    const { error } = await client.storage.from(BUCKET).upload(path, uploadFile, {
      contentType: uploadFile.type,
      cacheControl: "31536000",
      upsert: false
    });
    if (error && !/already|exists|duplicate/i.test(error.message || "")) throw error;

    return {
      url: mediaUrl(path, digest),
      path,
      type: "video",
      original: { bytes: file.size }
    };
  }

  function markUrlInput(input, value) {
    if (!input) return;
    input.value = value || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function markGalleryInput(input, results) {
    if (!input) return;
    const urls = (results || []).map((item) => item.url).filter(Boolean).slice(0, MAX_IMAGES);
    input.value = JSON.stringify(urls);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function attachProductImageUpload(form) {
    if (!form || form.dataset.mediaUploadReady === "true") return;
    const fileInput = $("[data-product-image-file]", form);
    const videoInput = $("[data-product-video-file]", form);
    const urlInput = $("[data-product-image-url]", form) || form.elements.image_url;
    const galleryInput = $("[data-product-media-gallery]", form) || form.elements.media_gallery;
    const videoUrlInput = $("[data-product-video-url]", form) || form.elements.video_url;
    if (!fileInput && !videoInput) return;
    form.dataset.mediaUploadReady = "true";
    const defaultPlaceholder = urlInput?.placeholder || "";
    const defaultVideoPlaceholder = videoUrlInput?.placeholder || "";

    if (fileInput && urlInput) {
      fileInput.addEventListener("change", async () => {
        const files = Array.from(fileInput.files || []);
        if (!files.length) return;
        const selected = files.slice(0, MAX_IMAGES);
        if (files.length > MAX_IMAGES) toast("En fazla 8 görsel yüklenebilir; ilk 8 görsel işleme alındı.", "warning");
        setSubmitDisabled(form, true);
        const previousPlaceholder = urlInput.placeholder;
        urlInput.placeholder = "Görseller hazırlanıyor...";
        form.__productImageUpload = uploadProductImages(form, selected);
        try {
          const results = await form.__productImageUpload;
          markUrlInput(urlInput, results[0]?.url || "");
          markGalleryInput(galleryInput, results);
          urlInput.placeholder = previousPlaceholder;
          toast(`${results.length} görsel hazırlandı.`);
        } catch (error) {
          form.__productImageUpload = null;
          fileInput.value = "";
          urlInput.placeholder = previousPlaceholder;
          toast(error.message || "Görsel yüklenemedi.", "error");
        } finally {
          setSubmitDisabled(form, false);
        }
      });
    }

    if (videoInput && videoUrlInput) {
      videoInput.addEventListener("change", async () => {
        const file = videoInput.files && videoInput.files[0];
        if (!file) return;
        setSubmitDisabled(form, true);
        const previousPlaceholder = videoUrlInput.placeholder;
        videoUrlInput.placeholder = "Video hazırlanıyor...";
        form.__productVideoUpload = uploadProductVideo(form, file);
        try {
          const result = await form.__productVideoUpload;
          markUrlInput(videoUrlInput, result.url);
          videoUrlInput.placeholder = previousPlaceholder;
          toast("Video hazırlandı.");
        } catch (error) {
          form.__productVideoUpload = null;
          videoInput.value = "";
          videoUrlInput.placeholder = previousPlaceholder;
          toast(error.message || "Video yüklenemedi.", "error");
        } finally {
          setSubmitDisabled(form, false);
        }
      });
    }

    form.addEventListener("reset", () => {
      form.__productImageUpload = null;
      form.__productVideoUpload = null;
      window.setTimeout(() => {
        if (urlInput) urlInput.placeholder = defaultPlaceholder;
        if (videoUrlInput) videoUrlInput.placeholder = defaultVideoPlaceholder;
        markGalleryInput(galleryInput, []);
      }, 0);
    });

    form.addEventListener("submit", async (event) => {
      if (form.dataset.productMediaSubmitting === "true") return;
      const imageUpload = form.__productImageUpload || null;
      const videoUpload = form.__productVideoUpload || null;
      if (!imageUpload && !videoUpload) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSubmitDisabled(form, true);
      try {
        const [imageResults, videoResult] = await Promise.all([
          imageUpload || Promise.resolve(null),
          videoUpload || Promise.resolve(null)
        ]);
        if (imageResults?.length) {
          markUrlInput(urlInput, imageResults[0].url);
          markGalleryInput(galleryInput, imageResults);
        }
        if (videoResult?.url) markUrlInput(videoUrlInput, videoResult.url);
        form.dataset.productMediaSubmitting = "true";
        form.requestSubmit();
      } catch (error) {
        toast(error.message || "Medya yükleme tamamlanamadı.", "error");
      } finally {
        form.dataset.productMediaSubmitting = "";
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
