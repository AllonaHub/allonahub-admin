import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { repairInlineAuthAvatar, preparePasswordLoginSession } from "../../src/lib/auth-session-profile.js";

const photo = "data:image/webp;base64," + "a".repeat(20000);
const smallJwt = metadata => "header." + Buffer.from(JSON.stringify({ user_metadata: metadata })).toString("base64url") + ".signature";

function fixture(options = {}) {
  const user = { id: "member-1", user_metadata: { full_name: "Example Member", avatar_url: photo }, app_metadata: { role: "customer", must_change_password: true } };
  const profile = { id: user.id, avatar_url: options.existingPhoto || null };
  const calls = [];
  const admin = {
    from(table) {
      assert.equal(table, "profiles");
      let patch;
      return {
        select() { return this; },
        eq(key, value) { assert.equal(key, "id"); assert.equal(value, user.id); return this; },
        update(value) { patch = value; return this; },
        async maybeSingle() {
          if (options.profileError) return { error: new Error("profile unavailable") };
          if (options.missingProfile) return { data: null };
          if (patch) { calls.push("profile.save"); Object.assign(profile, patch); }
          return { data: { ...profile } };
        }
      };
    },
    auth: { admin: {
      async updateUserById(id, patch) {
        assert.equal(id, user.id);
        assert.deepEqual(Object.keys(patch), ["user_metadata"]);
        calls.push("auth.compact");
        if (options.authError) return { error: new Error("auth unavailable") };
        Object.assign(user.user_metadata, patch.user_metadata);
        return { data: { user } };
      }
    } }
  };
  const auth = { async signInWithPassword(credentials) {
    calls.push("auth.renew");
    assert.equal(credentials.email, "example@example.invalid");
    assert.equal(credentials.password, "already-verified-password");
    if (options.renewError) return { error: new Error("temporary unavailable") };
    const renewedUser = options.wrongUser ? { ...user, id: "other" } : user;
    return { data: { user: renewedUser, session: { access_token: smallJwt(user.user_metadata) } } };
  } };
  const data = { user, session: { access_token: smallJwt(user.user_metadata) } };
  return { user, profile, calls, admin, auth, data };
}

test("legacy inline photo is preserved before Auth compaction and a new session is returned", async () => {
  const f = fixture();
  const prepared = await preparePasswordLoginSession({ ...f, email: "example@example.invalid", password: "already-verified-password" });
  assert.deepEqual(f.calls, ["profile.save", "auth.compact", "auth.renew"]);
  assert.equal(f.profile.avatar_url, photo);
  assert.equal(f.user.user_metadata.avatar_url, null);
  assert.equal(f.user.user_metadata.full_name, "Example Member");
  assert.equal(f.user.app_metadata.must_change_password, true);
  assert.equal(f.user.app_metadata.role, "customer");
  assert.ok(prepared.session.access_token.length < 12000);
  assert.ok(f.data.session.access_token.length > 16384);
});

test("repaired session fits the actual HTTP header limit that rejects the legacy token", async () => {
  const f = fixture();
  const server = createServer((_request, response) => response.end("accepted"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const oldResponse = await fetch(url, { headers: { Authorization: `Bearer ${f.data.session.access_token}` } });
    assert.equal(oldResponse.status, 431);
    await oldResponse.text();
    const prepared = await preparePasswordLoginSession({ ...f, email: "example@example.invalid", password: "already-verified-password" });
    const newResponse = await fetch(url, { headers: { Authorization: `Bearer ${prepared.session.access_token}` } });
    assert.equal(newResponse.status, 200);
    assert.equal(await newResponse.text(), "accepted");
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("a newer profile photo is not overwritten; repeated repair is idempotent", async () => {
  const f = fixture({ existingPhoto: "https://example.invalid/new-photo.webp" });
  assert.equal(await repairInlineAuthAvatar(f.admin, f.user), true);
  assert.equal(await repairInlineAuthAvatar(f.admin, f.user), false);
  assert.equal(f.profile.avatar_url, "https://example.invalid/new-photo.webp");
  assert.deepEqual(f.calls, ["auth.compact"]);
});

for (const failure of ["missingProfile", "profileError", "authError"]) {
  test(`photo is not lost when ${failure} prevents repair`, async () => {
    const f = fixture({ [failure]: true });
    await assert.rejects(repairInlineAuthAvatar(f.admin, f.user), { code: "AUTH_SESSION_PREPARATION_FAILED" });
    assert.equal(f.user.user_metadata.avatar_url, photo);
    if (failure === "authError") assert.equal(f.profile.avatar_url, photo);
    else assert.deepEqual(f.calls, []);
  });
}

for (const failure of ["renewError", "wrongUser"]) {
  test(`no stale or mismatched session is returned on ${failure}`, async () => {
    const f = fixture({ [failure]: true });
    await assert.rejects(preparePasswordLoginSession({ ...f, email: "example@example.invalid", password: "already-verified-password" }), { code: "AUTH_SESSION_PREPARATION_FAILED" });
    assert.equal(f.profile.avatar_url, photo);
  });
}

test("URL-only accounts do not require mutation or a second sign in", async () => {
  const f = fixture();
  f.user.user_metadata.avatar_url = "https://example.invalid/photo.webp";
  assert.equal(await preparePasswordLoginSession(f), f.data);
  assert.deepEqual(f.calls, []);
});

async function profileClientFixture({ richFailure = false, allFailure = false } = {}) {
  const calls = [];
  const saved = [];
  let metadata;
  const user = { id: "member-1", email: "example@example.invalid" };
  const client = {
    auth: {
      async getSession() { return { data: { session: { user } } }; },
      async updateUser({ data }) { calls.push("auth.save"); metadata = data; return {}; }
    },
    from() {
      let payload;
      return {
        upsert(data) { payload = data; return this; }, select() { return this; },
        async maybeSingle() {
          calls.push("profile.save"); saved.push(payload);
          return allFailure || (richFailure && saved.length === 1) ? { error: new Error("schema unavailable") } : { data: { id: user.id } };
        }
      };
    }
  };
  const values = new Map();
  const window = { Allona: { supabase: client }, location: { href: "https://allonahub.com/" }, dispatchEvent() {} };
  const context = vm.createContext({ window, URL, console: { warn() {} }, localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } });
  vm.runInContext(await readFile(new URL("../../../js/user-profile-sync.js", import.meta.url), "utf8"), context);
  return { client, sync: window.AllonaProfileSync, calls, saved, metadata: () => metadata, values };
}

for (const richFailure of [false, true]) {
  test(`profile photo never enters Auth metadata (legacy schema fallback: ${richFailure})`, async () => {
    const f = await profileClientFixture({ richFailure });
    await f.sync.save(f.client, { full_name: "Example Member", avatar_url: photo });
    assert.equal(f.saved.at(-1).avatar_url, photo);
    assert.equal(f.metadata().avatar_url, null);
    assert.equal(f.metadata().avatar, null);
    assert.equal(f.calls.at(-1), "auth.save");
    assert.equal(f.sync.storedProfile().avatar_url, photo);
  });
}

test("failed persistent profile save neither clears Auth data nor reports a local-only success", async () => {
  const f = await profileClientFixture({ allFailure: true });
  await assert.rejects(f.sync.save(f.client, { avatar_url: photo }), /schema unavailable/);
  assert.equal(f.metadata(), undefined);
  assert.equal(f.values.size, 0);
});
