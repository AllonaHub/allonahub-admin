(function () {
  "use strict";

  const storageKey = "allonahub.maritime.cvDraft.v3";
  const legacyStorageKey = "allonahub_maritime_cv_v2";
  const version = 3;
  const moduleKey = "maritime";
  const maxAgeMs = 2 * 60 * 60 * 1000;
  const maxSerializedLength = 4 * 1024 * 1024;
  const maxPhotoBytes = 2 * 1024 * 1024;
  const maxPhotoDataUrlLength = Math.ceil(maxPhotoBytes * 4 / 3) + 128;
  const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  function removeSessionDraft() {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch (error) {}
  }

  function removeLegacyDraft() {
    try {
      window.localStorage.removeItem(legacyStorageKey);
    } catch (error) {}
  }

  function parseObject(raw) {
    if (!raw || raw.length > maxSerializedLength) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function validEnvelope(envelope) {
    if (!envelope || envelope.version !== version || envelope.module_key !== moduleKey) return false;
    if (!envelope.data || typeof envelope.data !== "object" || Array.isArray(envelope.data)) return false;
    const updatedAt = Date.parse(String(envelope.updated_at || ""));
    const expiresAt = Date.parse(String(envelope.expires_at || ""));
    const age = Date.now() - updatedAt;
    return Number.isFinite(updatedAt)
      && Number.isFinite(expiresAt)
      && age >= -5 * 60 * 1000
      && age <= maxAgeMs
      && expiresAt > Date.now()
      && expiresAt <= updatedAt + maxAgeMs + 1000;
  }

  function write(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    const updatedAt = new Date();
    const envelope = {
      version,
      module_key: moduleKey,
      updated_at: updatedAt.toISOString(),
      expires_at: new Date(updatedAt.getTime() + maxAgeMs).toISOString(),
      data
    };

    try {
      const serialized = JSON.stringify(envelope);
      if (serialized.length > maxSerializedLength) return false;
      window.sessionStorage.setItem(storageKey, serialized);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readSessionDraft() {
    let envelope = null;
    try {
      envelope = parseObject(window.sessionStorage.getItem(storageKey));
    } catch (error) {
      return null;
    }
    if (!validEnvelope(envelope)) {
      removeSessionDraft();
      return null;
    }
    return envelope.data;
  }

  function migrateLegacyDraft() {
    let legacyRaw = "";
    try {
      legacyRaw = window.localStorage.getItem(legacyStorageKey) || "";
    } catch (error) {
      return null;
    } finally {
      removeLegacyDraft();
    }

    const legacyData = parseObject(legacyRaw);
    if (!legacyData) return null;
    write(legacyData);
    return legacyData;
  }

  function read() {
    return readSessionDraft() || migrateLegacyDraft();
  }

  function clear() {
    removeSessionDraft();
    removeLegacyDraft();
  }

  function isSafePhotoDataUrl(value) {
    const photo = String(value || "");
    if (!photo) return true;
    return photo.length <= maxPhotoDataUrlLength
      && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(photo);
  }

  function isAllowedPhotoFile(file) {
    return Boolean(file)
      && photoTypes.has(String(file.type || "").toLowerCase())
      && Number.isFinite(file.size)
      && file.size > 0
      && file.size <= maxPhotoBytes;
  }

  window.AllonaMaritimeCvDraft = Object.freeze({
    clear,
    isAllowedPhotoFile,
    isSafePhotoDataUrl,
    legacyStorageKey,
    maxAgeMs,
    maxPhotoBytes,
    read,
    storageKey,
    write
  });
})();
