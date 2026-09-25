import test from "node:test";
import assert from "node:assert/strict";
import { renderAllonaHubEmail } from "../../src/lib/allonahub-email-template.js";

test("shared email template keeps welcome copy readable without animation", () => {
  const html = renderAllonaHubEmail({ variant: "welcome", eyebrow: "KAYDINIZ OLUŞTURULDU", title: "AllonaHub ekosistemine hoş geldin", message: "Hesabın hazır.", action: "Hesabıma git", actionUrl: "https://allonahub.com/pages/account/user.html" });
  assert.match(html, /AllonaHub ekosistemine hoş geldin/);
  assert.match(html, /allonahub-welcome\.gif/);
  assert.match(html, /https:\/\/allonahub.com\/pages\/account\/user.html/);
  assert.match(html, /background:#08243d/);
  assert.match(html, /border-top:2px solid #10bde8/);
  assert.match(html, /https:\/\/www\.instagram\.com\/allonahub/);
  assert.doesNotMatch(html, /https:\/\/www\.linkedin\.com\/company\/allonahub/);
});

test("shared email template escapes user values and rejects unsafe action URLs", () => {
  const html = renderAllonaHubEmail({ title: "<script>alert(1)</script>", message: "<b>unsafe</b>", lines: ["A&B"], action: "Click", actionUrl: "javascript:alert(1)" });
  assert.doesNotMatch(html, /<script>|<b>unsafe<\/b>|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A&amp;B/);
});
