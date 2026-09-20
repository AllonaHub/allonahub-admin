(function () {
  "use strict";

  const storageKey = "allonahub.maritime.cvDraft.v4";
  const sessionStorageKey = "allonahub.maritime.cvDraft.v3";
  const legacyStorageKey = "allonahub_maritime_cv_v2";
  const version = 4;
  const moduleKey = "maritime";
  const maxSerializedLength = 4 * 1024 * 1024;
  const maxPhotoBytes = 12 * 1024 * 1024;
  const maxPhotoDataUrlLength = Math.ceil(maxPhotoBytes * 4 / 3) + 128;
  const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  function removeStoredDrafts() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {}
    try {
      window.sessionStorage.removeItem(sessionStorageKey);
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
    return Number.isFinite(updatedAt) && updatedAt <= Date.now() + 5 * 60 * 1000;
  }

  function write(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    const updatedAt = new Date();
    const envelope = {
      version,
      module_key: moduleKey,
      updated_at: updatedAt.toISOString(),
      data
    };

    try {
      const serialized = JSON.stringify(envelope);
      if (serialized.length > maxSerializedLength) return false;
      window.localStorage.setItem(storageKey, serialized);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readPersistentDraft() {
    let envelope = null;
    try {
      envelope = parseObject(window.localStorage.getItem(storageKey));
    } catch (error) {
      return null;
    }
    if (!validEnvelope(envelope)) {
      try { window.localStorage.removeItem(storageKey); } catch (error) {}
      return null;
    }
    return envelope.data;
  }

  function migrateSessionDraft() {
    let envelope = null;
    try {
      envelope = parseObject(window.sessionStorage.getItem(sessionStorageKey));
      window.sessionStorage.removeItem(sessionStorageKey);
    } catch (error) {
      return null;
    }
    const data = envelope && envelope.module_key === moduleKey && envelope.data && typeof envelope.data === "object"
      ? envelope.data
      : null;
    if (!data) return null;
    write(data);
    return data;
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
    return readPersistentDraft() || migrateSessionDraft() || migrateLegacyDraft();
  }

  function clear() {
    removeStoredDrafts();
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
    maxAgeMs: null,
    maxPhotoBytes,
    read,
    storageKey,
    write
  });
})();
