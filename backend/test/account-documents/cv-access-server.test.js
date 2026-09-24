import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("../../../js/cv-access.js", import.meta.url), "utf8");

function makeApp(rpcResult) {
  const App = {
    auth: { getUser: async () => ({ id: "user-1" }), requireAuth: async () => ({ id: "user-1" }) },
    db: { client: () => ({ rpc: async () => rpcResult }) }
  };
  const window = {
    Allona: App,
    crypto: {
      randomUUID: () => "device-1",
      subtle: { digest: async () => new Uint8Array(32).buffer }
    },
    location: { protocol: "https:", href: "" },
    TextEncoder
  };
  const document = {
    cookie: "allona_cv_device_id_v1=device-1",
    addEventListener() {},
    querySelector: () => null
  };
  runInNewContext(source, {
    window, document, localStorage: { getItem: () => "device-1", setItem() {} },
    navigator: { userAgent: "test" }, TextEncoder, Uint8Array, Array, Error,
    console: { warn() {} }
  });
  return App;
}

test("CV generation fails closed when server RPC is unavailable", async () => {
  const app = makeApp({ error: new Error("database unavailable") });
  const result = await app.cvAccess.claimGeneration({ title: "Example" });
  assert.equal(result.allowed, false);
  assert.equal(result.service_unavailable, true);
  assert.doesNotMatch(source, /localClaimGeneration|localEnsureAccess|local_fallback/);
});

test("server approval remains the only way to claim a CV generation", async () => {
  const app = makeApp({ data: { allowed: true, generation_type: "free" }, error: null });
  const result = await app.cvAccess.claimGeneration({ title: "Example" });
  assert.equal(result.allowed, true);
});
