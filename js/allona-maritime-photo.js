(function () {
  "use strict";

  const OUTPUT_WIDTH = 600;
  const OUTPUT_HEIGHT = 800;

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("PHOTO_READ_FAILED")); };
      image.src = url;
    });
  }

  function canvasBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("PHOTO_ENCODE_FAILED")); }, "image/webp", 0.9);
    });
  }

  async function prepare(file) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("PHOTO_TYPE_INVALID");
    if (file.size > 12 * 1024 * 1024) throw new Error("PHOTO_TOO_LARGE");
    const image = await loadImage(file);
    if (image.naturalWidth < 300 || image.naturalHeight < 300) throw new Error("PHOTO_TOO_SMALL");
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    const scale = Math.min(OUTPUT_WIDTH / image.naturalWidth, OUTPUT_HEIGHT / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (OUTPUT_WIDTH - width) / 2, (OUTPUT_HEIGHT - height) / 2, width, height);
    const blob = await canvasBlob(canvas);
    if (blob.size > 2 * 1024 * 1024) throw new Error("PHOTO_ENCODE_TOO_LARGE");
    return {
      blob,
      preview_url: canvas.toDataURL("image/webp", 0.9),
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      background_ratio: 0,
      needs_review: false,
      background_method: "original_preserved",
      face_pixels_regenerated: false
    };
  }

  window.AllonaMaritimePhoto = Object.freeze({ prepare });
})();
