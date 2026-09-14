import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const authScriptUrl = new URL("../../../js/auth.js", import.meta.url);

function queryResult(data) {
  return {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return this; },
    async maybeSingle() { return { data, error: null }; }
  };
}

async function authRuntime({ role, authRole = "", profileExists = true, partnerBusiness = null, pathname = "/pages/account/user.html", hostname = "allonahub.com" }) {
  const source = await readFile(authScriptUrl, "utf8");
  const replacements = [];
  const window = {
    location: {
      hostname,
      origin: `https://${hostname}`,
      pathname,
      search: "",
      hash: "",
      href: `https://${hostname}${pathname}`,
      replace(value) { replacements.push(value); }
    },
    Allona: {
      core: { url: (value) => value },
      supabase: {
        auth: {
          async getUser() { return { data: { user: { id: "account-1", app_metadata: authRole ? { role: authRole } : {} } }, error: null }; }
        }
      },
      db: {
        client() {
          return {
            from(table) {
              if (table === "profiles") return queryResult(profileExists ? { id: "account-1", role } : null);
              if (table === "partner_businesses") return queryResult(partnerBusiness);
              throw new Error(`Unexpected table: ${table}`);
            }
          };
        }
      }
    }
  };
  const context = vm.createContext({
    window,
    document: { body: { dataset: {} } },
    localStorage: { setItem() {}, removeItem() {} },
    URL,
    URLSearchParams,
    console
  });
  vm.runInContext(source, context, { filename: "auth.js" });
  return { auth: window.Allona.auth, replacements };
}

test("partner accounts ignore customer return paths and resolve to the company panel", async () => {
  const { auth } = await authRuntime({
    role: "partner",
    partnerBusiness: { id: "business-1", status: "active" }
  });
  const destination = await auth.accountDestination("/pages/ecosystem/maritime-account.html", { id: "account-1" });
  assert.equal(destination, "/pages/partner/partner-panel.html");
});

test("customer accounts canonicalize the retired maritime account alias to the user panel", async () => {
  const { auth } = await authRuntime({ role: "customer" });
  const destination = await auth.accountDestination("/pages/ecosystem/maritime-account.html", { id: "account-1" });
  assert.equal(destination, "/pages/account/user-panel.html");
});

test("customer accounts cannot use a company-panel return path", async () => {
  const { auth } = await authRuntime({ role: "customer" });
  const destination = await auth.accountDestination("/pages/partner/partner-panel.html", { id: "account-1" });
  assert.equal(destination, "/pages/account/user-panel.html");
});

test("a company row cannot promote a customer profile into the partner role", async () => {
  const { auth } = await authRuntime({
    role: "customer",
    partnerBusiness: { id: "business-1", status: "active" }
  });
  const context = await auth.getAccountContext({ id: "account-1" });
  assert.equal(context.type, "customer");
  await assert.rejects(() => auth.requireRole(["partner"]), /erişim yetkiniz yok/i);
});

test("admin accounts resolve to their own administration area", async () => {
  const { auth } = await authRuntime({ role: "admin" });
  const destination = await auth.accountDestination("/pages/account/user-panel.html", { id: "account-1" });
  assert.equal(destination, "/admin/index.html");
});

test("a partner account is redirected away from customer-only screens", async () => {
  const { auth, replacements } = await authRuntime({
    role: "partner",
    partnerBusiness: { id: "business-1", status: "active" },
    pathname: "/pages/ecosystem/maritime-applications.html"
  });
  const result = await auth.requireAccountType("customer", { user: { id: "account-1" } });
  assert.equal(result, null);
  assert.deepEqual(replacements, ["/pages/partner/partner-panel.html"]);
});

test("a customer account is redirected away from the partner panel", async () => {
  const { auth, replacements } = await authRuntime({
    role: "customer",
    pathname: "/pages/partner/partner-panel.html",
    hostname: "partner.allonahub.com"
  });
  const result = await auth.requireAccountType("partner", { user: { id: "account-1" } });
  assert.equal(result, null);
  assert.deepEqual(replacements, ["https://allonahub.com/pages/account/user-panel.html"]);
});

test("a standard auth account without a profile is recovered as a customer", async () => {
  const { auth } = await authRuntime({ role: "customer", profileExists: false });
  const context = await auth.getAccountContext({ id: "account-1", app_metadata: {} });
  assert.equal(context.type, "customer");
  assert.equal(context.profilePersisted, false);
});

test("a trusted partner auth role never falls through to the customer account", async () => {
  const { auth } = await authRuntime({
    role: "customer",
    authRole: "partner",
    profileExists: false,
    partnerBusiness: { id: "business-1", status: "active" }
  });
  const context = await auth.getAccountContext({ id: "account-1", app_metadata: { role: "partner" } });
  assert.equal(context.type, "partner");
  assert.equal(context.profilePersisted, false);
});
