const DEFAULT_SUPABASE_URL = "https://xqvikrysciguzholdjeb.supabase.co";

const supabaseUrl = (process.env.SUPABASE_URL || process.env.ALLONA_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.ALLONA_SUPABASE_SERVICE_ROLE_KEY ||
  (process.env.ALLONA_ALLOW_PUBLIC_SEED === "1"
    ? (process.env.SUPABASE_ANON_KEY || process.env.ALLONA_SUPABASE_ANON_KEY)
    : "");

if (!supabaseKey) {
  console.error(JSON.stringify({
    ok: false,
    message: "Seed için SUPABASE_SERVICE_ROLE_KEY veya ALLONA_SUPABASE_SERVICE_ROLE_KEY gerekli.",
    hint: "Anon/publishable key ile test yalnızca geçici RLS audit için ALLONA_ALLOW_PUBLIC_SEED=1 bayrağıyla yapılmalı."
  }, null, 2));
  process.exit(1);
}

const products = [
  {
    product_name: "Premium Burger Menü",
    category: "Yemek Burger",
    brand: "Allona Burger House",
    old_price: 349.99,
    price: 289.99,
    stock: 48,
    image_url: "/images/modules/yemek-light-v5.jpg",
    coupon_status: "Menü kuponu",
    hp_status: "+35 HP",
    description: "Burger, patates, içecek ve özel sosla hızlı teslimat menüsü.",
    status: "active",
    sku: "ALY-BURGER-001",
    barcode: "ALY100000001",
    partner_id: "ALP-FOOD-001",
    partner_email: "burger@allonahub.com"
  },
  {
    product_name: "Pizza Duo Menü",
    category: "Yemek Pizza",
    brand: "Blue Pizza",
    old_price: 459.99,
    price: 399.99,
    stock: 36,
    image_url: "/images/modules/allona-yemek.png",
    coupon_status: "%20 fırsat",
    hp_status: "+30 HP",
    description: "İki kişilik pizza, içecek ve günlük kampanya avantajı.",
    status: "active",
    sku: "ALY-PIZZA-002",
    barcode: "ALY100000002",
    partner_id: "ALP-FOOD-002",
    partner_email: "pizza@allonahub.com"
  },
  {
    product_name: "Kebap Aile Menüsü",
    category: "Yemek Kebap",
    brand: "Kebap Prestige",
    old_price: 699.99,
    price: 599.99,
    stock: 28,
    image_url: "/images/modules/yemek.png",
    coupon_status: "Aile paketi",
    hp_status: "+42 HP",
    description: "Izgara, lahmacun, meze ve aile boyu paylaşım menüsü.",
    status: "active",
    sku: "ALY-KEBAP-003",
    barcode: "ALY100000003",
    partner_id: "ALP-FOOD-003",
    partner_email: "kebap@allonahub.com"
  },
  {
    product_name: "Fit Protein Bowl",
    category: "Yemek Sağlıklı",
    brand: "Fit Bowl Kitchen",
    old_price: 289.99,
    price: 249.99,
    stock: 42,
    image_url: "/images/modules/yemek-light-v5.jpg",
    coupon_status: "Sağlıklı seçim",
    hp_status: "+28 HP",
    description: "Tavuk, yeşillik, tahıl ve özel sosla dengeli bowl menüsü.",
    status: "active",
    sku: "ALY-FIT-004",
    barcode: "ALY100000004",
    partner_id: "ALP-FOOD-004",
    partner_email: "fit@allonahub.com"
  },
  {
    product_name: "Tatlı ve Kahve Seti",
    category: "Yemek Tatlı Kahve",
    brand: "Tatlı Kahve Atelier",
    old_price: 219.99,
    price: 179.99,
    stock: 56,
    image_url: "/images/modules/allona-yemek.png",
    coupon_status: "Kahve yanında tatlı",
    hp_status: "+24 HP",
    description: "Pasta dilimi, özel kahve ve günlük tatlı kampanyası.",
    status: "active",
    sku: "ALY-TATLI-005",
    barcode: "ALY100000005",
    partner_id: "ALP-FOOD-005",
    partner_email: "tatli@allonahub.com"
  },
  {
    product_name: "Hızlı Döner Menü",
    category: "Yemek Döner",
    brand: "Döner Line",
    old_price: 239.99,
    price: 199.99,
    stock: 64,
    image_url: "/images/modules/yemek.png",
    coupon_status: "Öğle fırsatı",
    hp_status: "+22 HP",
    description: "Döner, ayran ve patatesle hızlı teslimat öğle menüsü.",
    status: "active",
    sku: "ALY-DONER-006",
    barcode: "ALY100000006",
    partner_id: "ALP-FOOD-006",
    partner_email: "doner@allonahub.com"
  }
];

function headers(extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: headers(options.headers)
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message = body && (body.message || body.error || body.code) || response.statusText;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function inList(values) {
  return `(${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(",")})`;
}

async function seedProducts() {
  const skus = products.map((item) => item.sku);
  const existing = await request(`/rest/v1/products?select=id,sku&sku=in.${encodeURIComponent(inList(skus))}`);
  const existingSkus = new Set((existing || []).map((item) => item.sku));
  const missing = products.filter((item) => !existingSkus.has(item.sku));
  if (!missing.length) {
    return { inserted: 0, skipped: products.length };
  }
  const inserted = await request("/rest/v1/products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(missing)
  });
  return { inserted: inserted.length, skipped: products.length - missing.length };
}

async function seedPartnerAds() {
  try {
    await request("/rest/v1/partner_ads?select=id&limit=1");
  } catch (error) {
    if (error.status === 404) return { inserted: 0, skipped: 0, note: "partner_ads tablosu canlı Supabase schema cache içinde yok" };
    throw error;
  }

  const ads = products.slice(0, 5).map((product, index) => ({
    partner_id: product.partner_id,
    placement: "allonayemek_hero",
    title: product.product_name,
    subtitle: product.brand,
    campaign_text: product.coupon_status,
    description: product.description,
    image_url: product.image_url,
    cta_label: "Menüyü İncele",
    link_url: "/pages/commerce/allonayemek.html#food-restaurants",
    priority: 100 - index,
    status: "active"
  }));
  const inserted = await request("/rest/v1/partner_ads", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(ads)
  });
  return { inserted: inserted.length, skipped: 0 };
}

try {
  const productResult = await seedProducts();
  let adResult;
  try {
    adResult = await seedPartnerAds();
  } catch (error) {
    adResult = { inserted: 0, skipped: 0, note: `partner_ads yüklenemedi: ${error.message}` };
  }
  console.log(JSON.stringify({ ok: true, products: productResult, ads: adResult }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    status: error.status || null,
    message: error.message,
    details: error.body || null,
    hint: "Yazma yetkisi yoksa SUPABASE_SERVICE_ROLE_KEY veya yetkili partner oturumu gerekir."
  }, null, 2));
  process.exit(1);
}
