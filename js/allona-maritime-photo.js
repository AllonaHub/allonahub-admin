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

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  async function portraitCrop(image) {
    const ratio = OUTPUT_WIDTH / OUTPUT_HEIGHT;
    let width = image.naturalWidth;
    let height = width / ratio;
    if (height > image.naturalHeight) {
      height = image.naturalHeight;
      width = height * ratio;
    }
    let left = (image.naturalWidth - width) / 2;
    let top = Math.max(0, (image.naturalHeight - height) * 0.28);
    if ("FaceDetector" in window) {
      try {
        const detector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 1 });
        const faces = await detector.detect(image);
        const box = faces && faces[0] && faces[0].boundingBox;
        if (box) {
          width = clamp(Math.max(box.width * 3.15, box.height * 2.35), 1, image.naturalWidth);
          height = width / ratio;
          if (height > image.naturalHeight) {
            height = image.naturalHeight;
            width = height * ratio;
          }
          left = clamp(box.x + box.width / 2 - width / 2, 0, image.naturalWidth - width);
          top = clamp(box.y - box.height * 0.72, 0, image.naturalHeight - height);
        }
      } catch (error) {}
    }
    return { left, top, width, height };
  }

  function dominantBorderColor(data, width, height) {
    const bins = new Map();
    const step = Math.max(1, Math.floor(Math.min(width, height) / 120));
    const add = function (x, y) {
      const offset = (y * width + x) * 4;
      const key = `${data[offset] >> 5}:${data[offset + 1] >> 5}:${data[offset + 2] >> 5}`;
      const row = bins.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
      row.count += 1;
      row.red += data[offset];
      row.green += data[offset + 1];
      row.blue += data[offset + 2];
      bins.set(key, row);
    };
    for (let x = 0; x < width; x += step) { add(x, 0); add(x, height - 1); }
    for (let y = 0; y < height; y += step) { add(0, y); add(width - 1, y); }
    const best = Array.from(bins.values()).sort(function (first, second) { return second.count - first.count; })[0];
    if (!best) return { red: 255, green: 255, blue: 255 };
    return { red: best.red / best.count, green: best.green / best.count, blue: best.blue / best.count };
  }

  function whitenConnectedBackground(context, width, height) {
    const frame = context.getImageData(0, 0, width, height);
    const pixels = frame.data;
    const target = dominantBorderColor(pixels, width, height);
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    const threshold = 72;
    const thresholdSquared = threshold * threshold;
    const eligible = function (index) {
      const offset = index * 4;
      const red = pixels[offset] - target.red;
      const green = pixels[offset + 1] - target.green;
      const blue = pixels[offset + 2] - target.blue;
      return red * red + green * green + blue * blue <= thresholdSquared;
    };
    const enqueue = function (index) {
      if (visited[index] || !eligible(index)) return;
      visited[index] = 1;
      queue[tail++] = index;
    };
    for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
    for (let y = 0; y < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y + 1 < height) enqueue(index + width);
    }
    for (let index = 0; index < visited.length; index += 1) {
      if (!visited[index]) continue;
      const offset = index * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = 255;
    }
    context.putImageData(frame, 0, 0);
    return tail / Math.max(1, width * height);
  }

  function canvasBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("PHOTO_ENCODE_FAILED")); }, "image/webp", 0.9);
    });
  }

  let segmenterPromise = null;

  function selfieSegmenter() {
    if (!window.SelfieSegmentation) return Promise.reject(new Error("PHOTO_SEGMENTER_UNAVAILABLE"));
    if (!segmenterPromise) {
      segmenterPromise = Promise.resolve().then(function () {
        return new window.SelfieSegmentation({
          locateFile: function (fileName) {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${fileName}`;
          }
        });
      });
    }
    return segmenterPromise;
  }

  async function whitenWithPersonMask(canvas, context) {
    const segmenter = await selfieSegmenter();
    const result = await new Promise(function (resolve, reject) {
      const timer = window.setTimeout(function () { reject(new Error("PHOTO_SEGMENTATION_TIMEOUT")); }, 12000);
      segmenter.onResults(function (payload) {
        window.clearTimeout(timer);
        if (!payload || !payload.segmentationMask) reject(new Error("PHOTO_SEGMENTATION_FAILED"));
        else resolve(payload);
      });
      segmenter.setOptions({ modelSelection: 1 });
      Promise.resolve(segmenter.send({ image: canvas })).catch(function (error) {
        window.clearTimeout(timer);
        reject(error);
      });
    });
    const original = document.createElement("canvas");
    original.width = canvas.width;
    original.height = canvas.height;
    original.getContext("2d").drawImage(canvas, 0, 0);
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(result.segmentationMask, 0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-in";
    context.drawImage(original, 0, 0);
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }

  async function prepare(file) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("PHOTO_TYPE_INVALID");
    if (file.size > 12 * 1024 * 1024) throw new Error("PHOTO_TOO_LARGE");
    const image = await loadImage(file);
    if (image.naturalWidth < 300 || image.naturalHeight < 300) throw new Error("PHOTO_TOO_SMALL");
    const crop = await portraitCrop(image);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    context.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    let backgroundMethod = "connected_border";
    let backgroundRatio = 0;
    try {
      await whitenWithPersonMask(canvas, context);
      backgroundMethod = "local_person_segmentation";
      backgroundRatio = 1;
    } catch (error) {
      backgroundRatio = whitenConnectedBackground(context, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    }
    const blob = await canvasBlob(canvas);
    if (blob.size > 2 * 1024 * 1024) throw new Error("PHOTO_ENCODE_TOO_LARGE");
    return {
      blob,
      preview_url: canvas.toDataURL("image/webp", 0.9),
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      background_ratio: backgroundRatio,
      needs_review: backgroundMethod !== "local_person_segmentation" && backgroundRatio < 0.12,
      background_method: backgroundMethod,
      face_pixels_regenerated: false
    };
  }

  window.AllonaMaritimePhoto = Object.freeze({ prepare });
})();
