import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const newPanelUrl = new URL("../../../pages/account/user-panel.html", import.meta.url);
const legacyAliasUrl = new URL("../../../pages/ecosystem/maritime-account.html", import.meta.url);
const archiveBase = new URL("../../../.archive/legacy-user-panel/2026-09-14/", import.meta.url);
const dockerIgnoreUrl = new URL("../../../.dockerignore", import.meta.url);
const portalUrl = new URL("../../../js/allona-maritime-portal.js", import.meta.url);
const profileHelperUrl = new URL("../../src/lib/maritime-customer-profile.js", import.meta.url);

test("the public user-panel address serves the new simple account", async () => {
  const [page, portal] = await Promise.all([readFile(newPanelUrl, "utf8"), readFile(portalUrl, "utf8")]);
  assert.match(page, /data-maritime-view="account"/);
  assert.match(page, /\.\.\/ecosystem\/maritime-documents\.html/);
  assert.match(page, /allona-maritime-portal\.js/);
  assert.match(portal, /view === "account" && session && context && context\.type === "partner"/);
  assert.match(portal, /window\.location\.replace\(destination\)/);
  assert.doesNotMatch(page, /user-panel-premium\.(?:css|js)/);
  assert.doesNotMatch(page, /class="premium-shell"/);
});

test("the former maritime account address redirects to the canonical user panel", async () => {
  const page = await readFile(legacyAliasUrl, "utf8");
  assert.match(page, /\.\.\/account\/user-panel\.html/);
  assert.match(page, /window\.location\.replace\(target\.href\)/);
  assert.match(page, /rel="canonical" href="https:\/\/allonahub\.com\/pages\/account\/user-panel\.html"/);
});

test("the retired dense panel is isolated in a dated non-public archive", async () => {
  const [page, css, script, readme, dockerIgnore] = await Promise.all([
    readFile(new URL("eski-user-panel.html", archiveBase), "utf8"),
    readFile(new URL("user-panel-premium.css", archiveBase), "utf8"),
    readFile(new URL("user-panel-premium.js", archiveBase), "utf8"),
    readFile(new URL("README.md", archiveBase), "utf8"),
    readFile(dockerIgnoreUrl, "utf8")
  ]);
  assert.match(page, /class="premium-shell"/);
  assert.match(page, /user-panel-premium\.css/);
  assert.match(css, /premium-shell/);
  assert.match(script, /Allona/);
  assert.match(readme, /2026-12-13/);
  assert.match(readme, /Silme işlemi otomatik değildir/);
  assert.match(dockerIgnore, /^\.archive$/m);
});

test("the new account uses canonical maritime routes and document-led profile activation", async () => {
  const [portal, helper] = await Promise.all([readFile(portalUrl, "utf8"), readFile(profileHelperUrl, "utf8")]);
  assert.match(portal, /const maritimeBasePath = "\/pages\/ecosystem\/"/);
  assert.match(portal, /portalUrl\("maritime-documents\.html"\)/);
  assert.match(portal, /seafarerStatusApproved/);
  assert.match(helper, /module: "maritime"/);
  assert.doesNotMatch(helper, /user_id: ctx\.user\.id/);
});
