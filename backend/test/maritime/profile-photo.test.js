import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import sharp from "sharp";
import { normalizeMaritimeProfilePhoto, registerMaritimePhotoParsers } from "../../src/lib/maritime-profile-photo.js";
import { MARITIME_PROFILE_PHOTO_MAX_BYTES } from "../../src/lib/maritime-document-doctor.js";

const photo = (format, width = 600, height = 800) => sharp({
  create: { width, height, channels: 3, background: { r: 110, g: 170, b: 200 } }
}).toFormat(format).toBuffer();

for (const [format, mime] of [["png", "image/png"], ["jpeg", "image/jpeg"], ["webp", "image/webp"]]) {
  test(`${mime} is decoded into a bounded, metadata-free WebP profile image`, async () => {
    const input = await sharp(await photo(format)).withMetadata().toBuffer();
    const output = await normalizeMaritimeProfilePhoto(input, mime);
    const info = await sharp(output).metadata();
    assert.equal(info.format, "webp");
    assert.equal(info.width, 600);
    assert.equal(info.height, 800);
    assert.equal(info.exif, undefined);
    assert.equal(info.xmp, undefined);
    assert.ok(output.length < MARITIME_PROFILE_PHOTO_MAX_BYTES);
  });
}

test("photo validation rejects MIME spoofing, SVG, truncated files and non-buffers", async () => {
  const png = await photo("png");
  for (const [bytes, mime] of [
    [png, "image/webp"], [png, "image/svg+xml"], [png.subarray(0, 32), "image/png"],
    [Buffer.from('<svg onload="alert(1)"></svg>'), "image/png"], [null, "image/png"]
  ]) {
    await assert.rejects(normalizeMaritimeProfilePhoto(bytes, mime), { code: "MARITIME_PHOTO_INVALID", statusCode: 400 });
  }
});

test("photo validation bounds byte size, decoded pixels and minimum resolution", async () => {
  for (const bytes of [Buffer.alloc(MARITIME_PROFILE_PHOTO_MAX_BYTES + 1), await photo("png", 2500, 2000), await photo("png", 100, 100)]) {
    await assert.rejects(normalizeMaritimeProfilePhoto(bytes, "image/png"), { code: "MARITIME_PHOTO_INVALID" });
  }
});

// Exercise the actual authenticated route and Supabase SDK transport without
// sending test identities or images to a real project.
process.env.SUPABASE_URL = "https://cv-photo.test";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.AUDIT_LOG_ENABLED = "false";
const { registerMaritimeDocumentRoutes } = await import("../../src/routes/maritime-documents.js");

async function routeHarness(t, role = "customer", storageError = false) {
  const userId = "00000000-0000-4000-8000-000000000001";
  const uploads = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(String(url));
    assert.equal(target.origin, "https://cv-photo.test", "test must never contact a live service");
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (target.pathname === "/auth/v1/user") return json({ id: userId, app_metadata: { role } });
    if (target.pathname === "/rest/v1/profiles") return json({ id: userId, role, account_status: "active", module: "maritime" });
    if (target.pathname.startsWith("/storage/v1/object/sign/")) return json({ signedURL: "/object/sign/private-photo?token=test" });
    if (target.pathname === `/storage/v1/object/maritime-profile-photos/users/${userId}/profile.webp`) {
      uploads.push({ bytes: Buffer.from(options.body), headers: new Headers(options.headers) });
      return storageError ? json({ message: "Storage unavailable" }, 503) : json({ Key: "profile.webp" });
    }
    throw new Error(`Unexpected mocked Supabase request: ${target.pathname}`);
  };
  const app = Fastify({ logger: false });
  registerMaritimePhotoParsers(app);
  registerMaritimeDocumentRoutes(app);
  t.after(async () => { await app.close(); globalThis.fetch = originalFetch; });
  return { app, uploads };
}

test("real profile-photo endpoint accepts Safari PNG and persists only validated WebP privately", async (t) => {
  const { app, uploads } = await routeHarness(t);
  const result = await app.inject({ method: "POST", url: "/v1/maritime/profile-photo",
    headers: { authorization: "Bearer test-user", "content-type": "image/png" }, payload: await photo("png") });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().ok, true);
  assert.ok(result.json().profile_photo_url);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].headers.get("content-type"), "image/webp");
  assert.equal((await sharp(uploads[0].bytes).metadata()).format, "webp");
});

test("profile-photo endpoint rejects unauthenticated and mismatched-image requests before storage", async (t) => {
  const { app, uploads } = await routeHarness(t);
  const payload = await photo("png");
  const guest = await app.inject({ method: "POST", url: "/v1/maritime/profile-photo", headers: { "content-type": "image/png" }, payload });
  assert.equal(guest.statusCode, 401);
  const bad = await app.inject({ method: "POST", url: "/v1/maritime/profile-photo",
    headers: { authorization: "Bearer test-user", "content-type": "image/webp" }, payload });
  assert.equal(bad.statusCode, 400);
  assert.equal(uploads.length, 0);
});

test("partner account cannot upload a personal Maritime CV photo", async (t) => {
  const { app, uploads } = await routeHarness(t, "partner");
  const result = await app.inject({ method: "POST", url: "/v1/maritime/profile-photo",
    headers: { authorization: "Bearer test-user", "content-type": "image/png" }, payload: await photo("png") });
  assert.equal(result.statusCode, 403);
  assert.equal(uploads.length, 0);
});

test("storage failure never returns a successful photo save", async (t) => {
  const { app } = await routeHarness(t, "customer", true);
  const result = await app.inject({ method: "POST", url: "/v1/maritime/profile-photo",
    headers: { authorization: "Bearer test-user", "content-type": "image/jpeg" }, payload: await photo("jpeg") });
  assert.equal(result.statusCode, 503);
  assert.equal(result.json().code, "MARITIME_PHOTO_SAVE_FAILED");
});
