import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../js/maritime-cv-account.js", import.meta.url), "utf8");
const cv = { lang: "en", fields: { firstName: "Example" }, stcwData: [], seaData: [], additionalData: [] };

function harness(options = {}) {
  const events = new Map();
  const calls = [];
  const status = { textContent: "", className: "" };
  const button = { disabled: false, setAttribute() {}, removeAttribute() {} };
  const photoInput = { files: options.photo ? [options.photo] : [] };
  let session = { access_token: "initial-token", user: { id: "owner" } };
  let draft = null;
  let stored = null;
  let applied = null;
  let proofCalls = 0;
  const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const window = {
    location: { pathname: "/cv", search: "", origin: "https://example.test" },
    Allona: {
      auth: { getSession: async () => session, requireAccountType: async () => true },
      cvAccess: { getDeviceKey: async () => "a".repeat(64) }
    },
    AllonaMaritimeCvDraft: {
      write: (data) => { draft = structuredClone(data); return true; },
      read: () => draft,
      isSafePhotoDataUrl: (value) => /^data:image\/(?:png|jpeg|webp);base64,/.test(value || "")
    },
    AllonaMaritimePhoto: { prepare: async () => {
      if (options.photoError) throw new Error(options.photoError);
      return { blob: new Blob(["photo"], { type: options.photoType || "image/webp" }) };
    } },
    AllonaMaritimePasskey: { authorize: async () => {
      proofCalls++;
      if (options.passkeyError) throw Object.assign(new Error("cancelled"), { code: "MARITIME_PASSKEY_CANCELLED" });
      return "proof";
    } },
    applyMaritimeCVData: (data) => { applied = data; },
    applyMaritimeIdentityLock() {},
    setMaritimeCvPhoto() {}
  };
  const document = {
    readyState: "loading",
    addEventListener: (name, callback) => events.set(name, callback),
    querySelectorAll: () => [button],
    querySelector: (selector) => selector === "[data-cv-account-status]" ? status : null,
    getElementById: (id) => id === "photoInput" ? photoInput : null
  };
  const fetch = async (url, init = {}) => {
    if (url.startsWith("data:")) return { blob: async () => new Blob(["local-photo"], { type: "image/png" }) };
    calls.push({ url, ...init });
    const path = new URL(url).pathname;
    if (options.failure) {
      const failure = await options.failure(path, init);
      if (failure) return failure;
    }
    if (init.method === "GET") return response({ ok: true, cv: stored, identity_lock: { locked: false } });
    if (path.endsWith("/draft") || path.endsWith("/cv-profile")) {
      stored = JSON.parse(init.body).cv;
      return response({ ok: true, cv: stored, identity_lock: { locked: true } });
    }
    return response({ ok: true });
  };
  vm.runInNewContext(source, { window, document, fetch, Blob, URL, console });
  return {
    account: window.AllonaMaritimeCvAccount, calls, status, button, response,
    load: () => events.get("DOMContentLoaded")(),
    setSession: (value) => { session = value; },
    setDraft: (value) => { draft = value; },
    setStored: (value) => { stored = value; },
    get stored() { return stored; },
    get draft() { return draft; },
    get applied() { return applied; },
    get proofCalls() { return proofCalls; }
  };
}

test("long-open CV uses refreshed session for both draft and final save", async () => {
  const h = harness();
  await h.load();
  h.setSession({ access_token: "renewed-token", user: { id: "owner" } });
  const result = await h.account.save(cv);
  assert.equal(result.finalized, true);
  assert.deepEqual(h.calls.slice(1).map((call) => call.headers.Authorization), ["Bearer renewed-token", "Bearer renewed-token"]);
  assert.equal(h.calls.at(-1).headers["X-Allona-Passkey-Proof"], "proof");
  assert.equal(h.stored.fields.firstName, "Example");
  assert.equal(h.button.disabled, false);
});

test("sign-out cannot save with a cached token", async () => {
  const h = harness();
  await h.load();
  h.setSession(null);
  await assert.rejects(h.account.save(cv), { code: "AUTH_REQUIRED", draftSaved: false });
  assert.equal(h.calls.length, 1);
});

test("account switch never writes the previous person's CV into the new account", async () => {
  const h = harness();
  await h.load();
  h.setSession({ access_token: "other-token", user: { id: "other" } });
  await assert.rejects(h.account.save(cv), { code: "AUTH_ACCOUNT_CHANGED" });
  assert.equal(h.calls.length, 1);
});

test("photo failure preserves server draft and reports photo-specific reason", async () => {
  const h = harness({ photo: new Blob(["photo"]), photoError: "PHOTO_TOO_SMALL" });
  const input = { ...cv, photo: "data:image/png;base64,YQ==" };
  await assert.rejects(h.account.save(input), { code: "PHOTO_TOO_SMALL", stage: "photo", draftSaved: true });
  assert.deepEqual(h.stored, cv);
  assert.equal(h.draft.photo, input.photo);
  assert.equal(h.proofCalls, 0);
  assert.match(h.status.textContent, /300/);
});

test("photo upload runs after draft save and before secured final confirmation", async () => {
  const h = harness({ photo: new Blob(["photo"]) });
  await h.account.save(cv);
  assert.deepEqual(h.calls.map((call) => new URL(call.url).pathname), [
    "/v1/maritime/cv-profile/draft", "/v1/maritime/profile-photo", "/v1/maritime/cv-profile"
  ]);
  assert.equal(h.calls[1].headers["Content-Type"], "image/webp");
});

test("photo restored from local draft is uploaded even when file input is empty after reload", async () => {
  const h = harness();
  const result = await h.account.save({ ...cv, photo: "data:image/png;base64,YQ==" });
  assert.equal(result.finalized, true);
  assert.equal(h.calls.filter((call) => call.url.endsWith("/profile-photo")).length, 1);
  assert.equal(h.stored.photo, undefined);
});

test("Safari PNG canvas output is sent with its actual MIME type, not mislabeled as WebP", async () => {
  const h = harness({ photo: new Blob(["photo"]), photoType: "image/png" });
  const result = await h.account.save(cv);
  const upload = h.calls.find((call) => call.url.endsWith("/profile-photo"));
  assert.equal(upload.headers["Content-Type"], "image/png");
  assert.equal(upload.body.type, "image/png");
  assert.equal(result.finalized, true);
});

test("loading a persisted draft preserves its not-yet-uploaded local photo", async () => {
  const h = harness();
  h.setStored(cv);
  h.setDraft({ ...cv, photo: "data:image/png;base64,YQ==" });
  await h.load();
  assert.equal(h.applied.photo, "data:image/png;base64,YQ==");
  assert.equal(h.draft.photo, h.applied.photo);
});

test("remote image URL in CV data is not fetched or uploaded as a photo", async () => {
  const h = harness();
  await h.account.save({ ...cv, photo: "https://untrusted.example/image.png" }, { finalize: false });
  assert.equal(h.calls.length, 1);
});

test("passkey cancellation preserves draft but cannot claim final save or skip security", async () => {
  const h = harness({ passkeyError: true });
  await assert.rejects(h.account.save(cv), { code: "MARITIME_PASSKEY_CANCELLED", draftSaved: true });
  assert.deepEqual(h.stored, cv);
  assert.equal(h.calls.length, 1);
  assert.match(h.status.textContent, /cancelled/i);
});

test("network failure is actionable and leaves save controls usable", async () => {
  const h = harness({ failure: async () => { throw new TypeError("Failed to fetch"); } });
  await assert.rejects(h.account.save(cv), { code: "CV_NETWORK_ERROR", draftSaved: false });
  assert.match(h.status.textContent, /connection/i);
  assert.equal(h.button.disabled, false);
});

test("401 is reported as sign-in required, not a generic CV failure", async () => {
  const h = harness({ failure: async () => ({ ok: false, status: 401, json: async () => ({ error: "REQUEST_ERROR" }) }) });
  await assert.rejects(h.account.save(cv), { code: "AUTH_REQUIRED" });
  assert.match(h.status.textContent, /sign in/i);
});

test("failed account load does not clear or overwrite local draft", async () => {
  const h = harness({ failure: async () => { throw new TypeError("network"); } });
  h.setDraft(cv);
  await h.load();
  assert.equal(h.applied, null);
  assert.deepEqual(h.draft, cv);
  assert.match(h.status.textContent, /not been cleared/);
});

test("incomplete CV saves as draft without requiring passkey or claiming finalization", async () => {
  const h = harness();
  const result = await h.account.save(cv, { finalize: false });
  assert.equal(result.finalized, false);
  assert.equal(h.proofCalls, 0);
  assert.equal(h.calls.length, 1);
});

test("concurrent save cannot return an undefined false-success result", async () => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const h = harness({ failure: async () => { await wait; } });
  const first = h.account.save(cv, { finalize: false });
  await assert.rejects(h.account.save(cv), { code: "CV_SAVE_IN_PROGRESS" });
  release();
  await first;
});

for (const file of ["allona-maritime-smart-account.js", "allona-maritime-documents.js"]) {
  test(`${file}: Global CV requests use current token and reject account changes`, async () => {
    const source = await readFile(new URL(`../../../js/${file}`, import.meta.url), "utf8");
    const instrumented = source.replace(/\}\)\(\);\s*$/, "window.__api = api; window.__state = state; })();");
    let session = { access_token: "fresh", user: { id: "owner" } };
    const calls = [];
    const window = {
      Allona: { auth: { getSession: async () => session }, cvAccess: { getDeviceKey: async () => "a".repeat(64) } },
      addEventListener() {}
    };
    vm.runInNewContext(instrumented, {
      window, Blob, URL, console,
      localStorage: { getItem: () => null },
      document: { readyState: "loading", body: { dataset: {} }, documentElement: { lang: "tr" }, addEventListener() {}, querySelector: () => null },
      fetch: async (url, init) => {
        calls.push({ url, ...init });
        return { ok: true, status: 201, json: async () => ({ ok: true }) };
      }
    });
    window.__state.session = { access_token: "expired", user: { id: "owner" } };
    await window.__api("/v1/maritime/smart-account/prepare", { method: "POST", body: "{}" });
    assert.equal(calls[0].headers.Authorization, "Bearer fresh");
    session = { access_token: "other", user: { id: "other" } };
    await assert.rejects(window.__api("/v1/maritime/smart-account/prepare", {}), /AUTH_REQUIRED/);
    session = null;
    await assert.rejects(window.__api("/v1/maritime/smart-account/prepare", {}), /AUTH_REQUIRED/);
    assert.equal(calls.length, 1);
  });
}
