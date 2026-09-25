import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

for (const filename of ["config.js", "core.js", "platform.js"]) {
  test(`${filename} redirects the GitHub Pages mirror before initializing the app`, async () => {
    const source = await readFile(new URL(`../../../js/${filename}`, import.meta.url), "utf8");
    let redirectedTo = "";
    vm.runInNewContext(source, {
      window: {
        location: {
          hostname: "allonahub.github.io",
          pathname: "/allonahub-admin/pages/ecosystem/maritime-jobs.html",
          search: "?returnTo=%2Fpages%2Faccount%2Fuser-panel.html",
          hash: "#jobs",
          replace(url) { redirectedTo = url; }
        }
      }
    });
    assert.equal(redirectedTo, "https://allonahub.com/pages/ecosystem/maritime-jobs.html?returnTo=%2Fpages%2Faccount%2Fuser-panel.html#jobs");
  });
}
