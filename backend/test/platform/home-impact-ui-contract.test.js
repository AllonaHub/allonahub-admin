import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("smart platform name is consistent across home, ecosystem and installed app", async () => {
  const name = "AllonaHub Akıllı Platform";
  for (const path of ["index.html", "pages/ecosystem/ecosystem.html"]) {
    const html = await source(path);
    assert.ok(html.includes(`<title>${name}</title>`));
    assert.doesNotMatch(html, /yeni nesil süper uygulama/i);
    const platformVersion = path === "index.html" ? "20260920-home-i18n1" : "20260920-smart-platform1";
    assert.ok(html.includes(`platform.js?v=${platformVersion}`));
  }
  assert.ok((await source("index.html")).includes(`<h1 class="home-page-title">${name}</h1>`));
  const current = JSON.parse(await source("manifest.json"));
  assert.equal(current.name, name);
  assert.equal(current.short_name, "AllonaHub");
  assert.deepEqual(JSON.parse(await source("manifest.webmanifest")), current);
  assert.match(await source("index.html"), /manifest\.json\?v=20260920-smart-platform1/);
});

test("smart platform title has translations for every supported language", async () => {
  const catalog = JSON.parse(await source("i18n/catalog.json"));
  const translations = catalog.phrases["AllonaHub Akıllı Platform"];
  for (const language of ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"]) {
    assert.ok(translations[language]?.startsWith("AllonaHub "), language);
  }
  assert.equal(translations.tr, "AllonaHub Akıllı Platform");
  assert.equal(translations.en, "AllonaHub Smart Platform");
});

test("homepage binds the listings card to the live aggregate metric", async () => {
  const [html, script] = await Promise.all([
    source("index.html"),
    source("js/allonahub-home.js")
  ]);

  assert.match(html, /<p>İlanlar<\/p><h3 id="activeListings"/);
  assert.match(script, /activeListings:\["active_listing_count","active_job_count"\]/);
  assert.doesNotMatch(html, /id="crewApps"/);
});

test("maritime module opens the real MarSoh page without an intermediate route", async () => {
  const html = await source("pages/ecosystem/allonadenizcilik.html");
  assert.match(html, /href="\/pages\/ecosystem\/maritime-marsoh\.html"[^>]+aria-label="MarSoh sohbet alanını aç"/);
});

test("responsive controls keep search and Google actions inside their containers", async () => {
  const [homeCss, authCss] = await Promise.all([
    source("css/allonahub-home.css"),
    source("css/allona-auth-page.css")
  ]);

  assert.match(homeCss, /\.nav-search \.search-btn[\s\S]+max-width: max-content !important/);
  assert.match(authCss, /\.google-auth-btn[\s\S]+max-width: 100% !important/);
  assert.match(authCss, /"google google"[\s\S]+"partner partner"/);
});
