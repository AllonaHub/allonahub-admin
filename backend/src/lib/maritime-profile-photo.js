import sharp from "sharp";
import { MARITIME_PROFILE_PHOTO_MAX_BYTES, maritimeDocumentSignatureMatches } from "./maritime-document-doctor.js";

const formats = new Map([["image/png", "png"], ["image/jpeg", "jpeg"], ["image/webp", "webp"]]);

function invalidPhoto() {
  return Object.assign(new Error("Profil fotoğrafı güvenli biçimde doğrulanamadı."), {
    statusCode: 400,
    code: "MARITIME_PHOTO_INVALID"
  });
}

export function registerMaritimePhotoParsers(app) {
  app.addContentTypeParser([...formats.keys()], { parseAs: "buffer" }, (_request, body, done) => done(null, body));
}

export async function normalizeMaritimeProfilePhoto(bytes, contentType) {
  const mime = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MARITIME_PROFILE_PHOTO_MAX_BYTES ||
      !formats.has(mime) || !maritimeDocumentSignatureMatches(bytes, mime)) throw invalidPhoto();
  try {
    // Safari may encode canvas output as PNG even when WebP was requested.
    // Decode and re-encode on the server; private storage remains WebP-only.
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: 4_000_000, animated: false });
    const metadata = await image.metadata();
    if (metadata.format !== formats.get(mime) || (metadata.pages || 1) !== 1 ||
        metadata.width < 300 || metadata.height < 300) throw invalidPhoto();
    const output = await image.rotate()
      .resize({ width: 600, height: 800, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 90 })
      .timeout({ seconds: 5 })
      .toBuffer();
    if (output.length > MARITIME_PROFILE_PHOTO_MAX_BYTES) throw invalidPhoto();
    return output;
  } catch {
    throw invalidPhoto();
  }
}
