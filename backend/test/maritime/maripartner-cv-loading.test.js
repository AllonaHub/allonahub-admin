import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("partner CV preview shows immediate progress in the card and opened tab", () => {
  const script = read("js/maripartner.js");
  const style = read("css/maripartner.css");
  assert.match(script, /function candidateCvProgress\(opened, button\)/);
  assert.match(script, /button\.textContent = "CV hazırlanıyor…"/);
  assert.match(script, /CV hazırlanıyor, lütfen bekleyin…/);
  assert.match(script, /opened\.document\.body\.append\(main\)/);
  assert.match(script, /progress\.done\(\)/);
  assert.match(script, /progress\.fail\(error\.message/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
});
