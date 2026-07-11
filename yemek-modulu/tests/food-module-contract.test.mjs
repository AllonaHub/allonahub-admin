import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  FOOD_BUTTON_ACTIONS,
  buildCourierHandoffPayload,
  inferImageNameMatch,
  listUnwiredFoodButtons,
  resolveButtonAction,
  validateFoodProductForSale
} from "../src/food-module-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const productsPath = resolve(__dirname, "../assets/data/sale-ready-products.json");
const products = JSON.parse(await readFile(productsPath, "utf8"));

test("satışa hazır örnek ürünlerin tamamı satış validasyonundan geçer", () => {
  for (const product of products) {
    const result = validateFoodProductForSale(product);
    assert.equal(result.ready, true, `${product.name}: ${result.missing.join(", ")}`);
    assert.equal(result.imageMatch.status, "approved", product.name);
  }
});

test("görsel eşleşme denetimi alakasız görseli incelemeye düşürür", () => {
  const mismatch = inferImageNameMatch({
    name: "Fıstıklı Baklava",
    slug: "fistikli-baklava",
    image_url: "assets/img/mercimek-corbasi.png",
    image_alt: "Mercimek çorbası kase içinde",
    tags: ["çorba"],
    ingredients: ["mercimek"]
  });

  assert.equal(mismatch.status, "needs_review");
});

test("tanımlı buton aksiyonları food namespace dışında tablo kullanmaz", () => {
  for (const key of Object.keys(FOOD_BUTTON_ACTIONS)) {
    const action = resolveButtonAction(key);
    assert.match(action.event, /^food\./);
    assert.match(action.table, /^food_/);
  }
});

test("UI tarafında gelen bilinmeyen buton anahtarları yakalanır", () => {
  const unwired = listUnwiredFoodButtons(["selectCategory", "addToCart", "ghostButton"]);
  assert.deepEqual(unwired, ["ghostButton"]);
});

test("kurye handoff payload'ı ileride kurye modülüne bağlanabilir sözleşme üretir", () => {
  const payload = buildCourierHandoffPayload({
    id: "order-1",
    partner_id: "partner-1",
    pickup_location: { lat: 41.01, lng: 28.97, address: "Restoran" },
    dropoff_location: { lat: 41.02, lng: 28.98, address: "Müşteri" },
    delivery_note: "Kapıya bırak",
    payment_status: "paid",
    package_count: 1,
    items: [
      {
        product_id: "product-1",
        name: "Tavuk Döner Dürüm",
        quantity: 2
      }
    ]
  });

  assert.equal(payload.schema_version, "food-courier-handoff.v1");
  assert.equal(payload.source_module, "food");
  assert.equal(payload.items[0].name, "Tavuk Döner Dürüm");
});

