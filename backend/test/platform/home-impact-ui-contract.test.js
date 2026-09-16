import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

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
