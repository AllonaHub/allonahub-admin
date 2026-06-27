const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function finish(code, payload) {
  const writer = code === 0 ? console.log : console.error;
  writer(JSON.stringify(payload, null, 2));
  process.exit(code);
}

if (!supabaseUrl || !anonKey) {
  finish(2, {
    ok: false,
    check: "supabase-env",
    missing: [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null
    ].filter(Boolean),
    message: "Supabase canlı bağlantı kontrolü için env değerleri gerekli."
  });
}

const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/food_products?select=id,name,status&limit=1`;

try {
  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok) {
    finish(1, {
      ok: false,
      check: "supabase-food-products-rest",
      status: response.status,
      body
    });
  }

  finish(0, {
    ok: true,
    check: "supabase-food-products-rest",
    status: response.status,
    sample: body
  });
} catch (error) {
  finish(1, {
    ok: false,
    check: "supabase-network",
    message: error.message
  });
}

