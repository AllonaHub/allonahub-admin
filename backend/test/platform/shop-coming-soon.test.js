import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("Shop card and home search open the existing coming-soon page", async () => {
  assert.match(await source("index.html"), /module-card--shop[^>]*href="pages\/ecosystem\/yakında.html\?module=shop"/);
  assert.doesNotMatch(await source("js/allonahub-home.js"), /pages\/commerce\/allonashop.html/);
});

test("bookmarked Shop entry and catalog redirect without deleting the old storefront", async () => {
  for (const path of ["allonashop.html", "shop.html"]) {
    const html = await source(`pages/commerce/${path}`);
    assert.match(html, /http-equiv="refresh" content="0;url=\.\.\/ecosystem\/yak%C4%B1nda.html\?module=shop"/);
    assert.match(html, /data-page="shop"/);
    assert.match(await source("_redirects"), new RegExp(`/pages/commerce/${path} /pages/ecosystem/yak%C4%B1nda.html\\?module=shop 302!`));
  }
});

test("neon announcement is scoped only to the Shop coming-soon variant", async () => {
  const html = await source("pages/ecosystem/yakında.html");
  assert.match(html, /if \(key === "shop"\)/);
  assert.match(html, /data-soon-back/);
  assert.match(html, /shop-soon-navigation/);
  const css = await source("css/shop-coming-soon.css");
  assert.match(css, /body\[data-soon-module="shop"\]/);
  assert.match(css, /text-align: center/);
  assert.match(css, /text-shadow:/);
  assert.doesNotMatch(css, /animation:\s*(?!none)[\w-]+\s+\d/);
  assert.doesNotMatch(await source("pages/ecosystem/allonadenizcilik.html"), /shop-coming-soon|data-shop-soon-headline/);
});

test("Shop announcement is translated into all nine platform languages", async () => {
  const catalog = JSON.parse(await source("i18n/catalog.json"));
  for (const phrase of ["Allona Shop alışveriş modülümüz geliştirilmeye devam ediyor.", "Yakında Hizmetinizde", "Geri Dön"]) {
    for (const lang of Object.keys(catalog.dirs)) assert.ok(catalog.phrases[phrase][lang], `${lang}: ${phrase}`);
  }
});
