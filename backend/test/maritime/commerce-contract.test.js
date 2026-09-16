import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260916030000_create_maritime_premium_and_pdf_access.sql", import.meta.url);
const vesselFallbackMigrationUrl = new URL("../../../supabase/migrations/20260916040000_add_open_vessel_lookup_fallback.sql", import.meta.url);
const currentVesselMigrationUrl = new URL("../../../supabase/migrations/20260916050000_add_current_public_vessel_provider.sql", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-commerce.js", import.meta.url);
const mainRoutesUrl = new URL("../../src/routes/index.js", import.meta.url);
const providerUrl = new URL("../../src/lib/maritime-vessel-provider.js", import.meta.url);
const cvPageUrl = new URL("../../../pages/ecosystem/maritime-cv.html", import.meta.url);
const cvFormUrl = new URL("../../../js/maritime-cv-form.js", import.meta.url);
const cvControlsUrl = new URL("../../../js/maritime-cv-controls.js", import.meta.url);
const commerceUiUrl = new URL("../../../js/maritime-commerce.js", import.meta.url);
const smartPageUrl = new URL("../../../pages/ecosystem/maritime-smart-account.html", import.meta.url);
const smartUiUrl = new URL("../../../js/allona-maritime-smart-account.js", import.meta.url);
const cvCssUrl = new URL("../../../css/maritime-cv-form.css", import.meta.url);
const smartCssUrl = new URL("../../../css/allona-maritime-portal.css", import.meta.url);
const smartRouteUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);
const smartProfileUrl = new URL("../../src/lib/maritime-smart-profile.js", import.meta.url);
const deployUrl = new URL("../../../deploy/maritime/apply-maritime-migrations.sh", import.meta.url);
const schemaCheckUrl = new URL("../../../deploy/maritime/check-maritime-hiring-core.sh", import.meta.url);

test("hidden Maritime Premium starts disabled while free storage operations remain outside the gate", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /premium_surface_enabled boolean not null default false/);
  assert.match(migration, /premium_entitlements_enabled boolean not null default false/);
  assert.match(migration, /premium_price numeric\(12,2\) not null default 79\.00/);
  assert.match(migration, /maritime_cv_pdf_price numeric\(12,2\) not null default 7\.00/);
  assert.match(migration, /global_cv_pdf_price numeric\(12,2\) not null default 15\.00/);
  assert.match(migration, /on conflict \(singleton\) do update[\s\S]*premium_surface_enabled = false[\s\S]*premium_entitlements_enabled = false/);
  assert.match(migration, /launch_state = 'hidden'/);
  assert.match(migration, /'document_services', 3, false, '\{"label":"Document upload and storage","always_free":true\}'/);
  assert.match(migration, /'global_cv_create_update', 11, false, '\{"label":"Global CV creation and updates","always_free":true\}'/);
  for (const key of ["unlimited_applications", "smart_matching", "automatic_applications", "campaign_access", "reviews_and_ratings", "unlimited_pdf_generation", "priority_visibility"]) {
    assert.match(migration, new RegExp(`'${key}'`));
  }
  assert.match(migration, /insert into public\.maritime_premium_memberships \(user_id\)[\s\S]*from public\.profiles/);
  assert.match(migration, /after insert on public\.profiles/);
});

test("Maritime PDF purchases use isolated USD entitlements and trusted callback verification", async () => {
  const [migration, route, mainRoutes, deploy, schemaCheck] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(routeUrl, "utf8"),
    readFile(mainRoutesUrl, "utf8"),
    readFile(deployUrl, "utf8"),
    readFile(schemaCheckUrl, "utf8")
  ]);
  assert.match(migration, /product text not null check \(product in \('maritime_cv_pdf', 'global_cv_pdf'\)\)/);
  assert.match(migration, /case when v_payment\.product = 'maritime_cv_pdf'[\s\S]*maritime_cv_refresh_downloads_per_purchase/);
  assert.match(migration, /last_download_source_version is distinct from p_source_version/);
  assert.match(migration, /unique \(user_id, idempotency_key\)/);
  assert.match(migration, /grant execute on function public\.consume_maritime_pdf_download\(uuid, text, text, uuid\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.consume_maritime_pdf_download\([^\n]+\) to authenticated/);
  assert.match(route, /app\.post\("\/v1\/maritime\/pdf-download\/authorize"/);
  assert.match(route, /app\.post\("\/v1\/maritime\/pdf-checkout"/);
  assert.match(route, /currency: "USD"/);
  assert.match(mainRoutes, /providerConversationId === payment\.id/);
  assert.match(mainRoutes, /amountMatches && currencyMatches && conversationMatches/);
  assert.match(mainRoutes, /grant_maritime_pdf_entitlement/);
  assert.match(deploy, /20260916030000_create_maritime_premium_and_pdf_access\.sql/);
  assert.match(schemaCheck, /Hidden Maritime Premium or PDF entitlement boundary is unsafe/);
});

test("only paid PDF controls are visible and no Premium surface is rendered", async () => {
  const [cvPage, cvForm, cvControls, commerceUi, smartPage, smartUi, cvCss, smartCss] = await Promise.all([
    readFile(cvPageUrl, "utf8"),
    readFile(cvFormUrl, "utf8"),
    readFile(cvControlsUrl, "utf8"),
    readFile(commerceUiUrl, "utf8"),
    readFile(smartPageUrl, "utf8"),
    readFile(smartUiUrl, "utf8"),
    readFile(cvCssUrl, "utf8"),
    readFile(smartCssUrl, "utf8")
  ]);
  assert.match(cvPage, /PDF İndir · 7 USD/);
  assert.match(cvForm, /Download PDF · \$7/);
  assert.match(cvControls, /authorizeOrCheckout\("maritime_cv_pdf"\)/);
  assert.match(smartUi, /Download Global CV PDF · \$15/);
  assert.match(smartUi, /authorizeOrCheckout\("global_cv_pdf"\)/);
  assert.match(smartUi, /classList\.add\("maritime-print-authorized"\)/);
  assert.match(cvCss, /not\(\.maritime-print-authorized\)/);
  assert.match(smartCss, /not\(\.maritime-print-authorized\)/);
  assert.match(commerceUi, /UNTRUSTED_PAYMENT_URL/);
  assert.doesNotMatch(`${cvPage}\n${smartPage}`, /data-premium|premium-button|Premium'a Geç/i);
});

test("IMO lookup uses a server-only official adapter with an open fallback and sea references are required end to end", async () => {
  const [provider, route, cvForm, commerceUi, smartRoute, smartProfile, fallbackMigration, currentVesselMigration, deploy, schemaCheck] = await Promise.all([
    readFile(providerUrl, "utf8"),
    readFile(routeUrl, "utf8"),
    readFile(cvFormUrl, "utf8"),
    readFile(commerceUiUrl, "utf8"),
    readFile(smartRouteUrl, "utf8"),
    readFile(smartProfileUrl, "utf8"),
    readFile(vesselFallbackMigrationUrl, "utf8"),
    readFile(currentVesselMigrationUrl, "utf8"),
    readFile(deployUrl, "utf8"),
    readFile(schemaCheckUrl, "utf8")
  ]);
  assert.match(provider, /vesselmasterdata\/\$\{encodeURIComponent\(apiKey\)\}/);
  assert.match(provider, /application\/sparql-results\+json/);
  assert.match(provider, /wdt:P458/);
  assert.match(provider, /wdt:P1093/);
  assert.match(provider, /wdt:P4519/);
  assert.match(fallbackMigration, /provider in \('marinetraffic', 'wikidata'\)/);
  assert.match(currentVesselMigration, /'vesselfinder_public'/);
  assert.match(currentVesselMigration, /delete from public\.maritime_vessel_lookup_cache/);
  assert.match(deploy, /20260916040000_add_open_vessel_lookup_fallback\.sql/);
  assert.match(deploy, /20260916050000_add_current_public_vessel_provider\.sql/);
  assert.match(schemaCheck, /Maritime vessel lookup cache provider constraint is incomplete/);
  assert.match(provider, /endpoint\.searchParams\.set\("imo", imo\)/);
  assert.match(provider, /SUMMER_DWT/);
  assert.doesNotMatch(provider, /localStorage|sessionStorage|document\./);
  assert.match(route, /app\.get\("\/v1\/maritime\/vessels\/:imo"/);
  assert.match(route, /maritime_vessel_lookup_cache/);
  assert.match(route, /cached\?\.provider !== "wikidata"/);
  assert.match(route, /cacheWrite\.error\?\.code === "23514"/);
  assert.doesNotMatch(route, /requireCustomer\(request, "maritime\.vessel_lookup"\)/);
  assert.match(route, /actorId: ctx\?\.user\?\.id \|\| null/);
  assert.match(route, /rateLimit: \{ max: 10, timeWindow: "1 minute" \}/);
  assert.match(commerceUi, /return publicApi\(`\/v1\/maritime\/vessels\/\$\{encodeURIComponent/);
  assert.doesNotMatch(commerceUi, /return api\(`\/v1\/maritime\/vessels\/\$\{encodeURIComponent/);
  for (const key of ["referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone"]) {
    assert.match(cvForm, new RegExp(`data-cv-key="${key}"`));
    assert.match(smartRoute, new RegExp(key));
  }
  assert.match(cvForm, /function validImo\(value\)/);
  assert.match(cvForm, /new URLSearchParams\(window\.location\.search\)\.get\("imo"\)/);
  for (const handler of ["addSea", "removeSea", "updateSea", "lookupSeaVessel", "saveSeaExperience"]) {
    assert.match(cvForm, new RegExp(`window\\.${handler} = ${handler}`));
  }
  assert.match(smartRoute, /isValidImoNumber\(row\.imo\)/);
  assert.match(smartProfile, /reference_company_phone/);
  assert.match(smartProfile, /length_overall_m/);
});

test("IMO check digit and MarineTraffic normalization reject bad identifiers", async () => {
  process.env.SUPABASE_URL ||= "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
  const provider = await import("../../src/lib/maritime-vessel-provider.js");
  assert.equal(provider.isValidImoNumber("IMO 9360283"), true);
  assert.equal(provider.isValidImoNumber("9360284"), false);
  assert.equal(provider.isValidImoNumber("123"), false);
  const vessel = provider.normalizeMarineTrafficVessel({
    IMO: "9360283",
    NAME: "DONGJIN AUBE",
    MANAGER: "DONG JIN SHIPPING CO LTD",
    SUMMER_DWT: "15220",
    GROSS_TONNAGE: "12679",
    MMSI: "440389000",
    CALLSIGN: "D7OT",
    FLAG: "KR",
    BUILD: "2005",
    LENGTH_OVERALL: "147",
    VESSEL_TYPE: "CONTAINER SHIP"
  });
  assert.deepEqual({
    imo: vessel.imo,
    name: vessel.vessel_name,
    company: vessel.company_name,
    dwt: vessel.dwt,
    grt: vessel.grt,
    build: vessel.build_year
  }, {
    imo: "9360283",
    name: "DONGJIN AUBE",
    company: "DONG JIN SHIPPING CO LTD",
    dwt: 15220,
    grt: 12679,
    build: 2005
  });
  assert.equal(provider.normalizeMarineTrafficVessel({ IMO: "9360284" }), null);
  assert.equal(provider.normalizeMarineTrafficVessel({ IMO: "9360283" }).dwt, null);

  const openVessel = provider.normalizeWikidataVesselBindings([{
    ship: { value: "http://www.wikidata.org/entity/Q105765847" },
    imo: { value: "9360283" },
    shipNameEn: { value: "MSC AUBE F" },
    instanceLabel: { value: "container ship" },
    flagLabel: { value: "Panama" },
    gross: { value: "12679" },
    dwt: { value: "15220" },
    mmsi: { value: "352001323" },
    callSign: { value: "3E4052" },
    serviceEntry: { value: "2005-01-01T00:00:00Z" },
    length: { value: "147" },
    breadth: { value: "25" }
  }], "9360283");
  assert.deepEqual({
    name: openVessel.vessel_name,
    type: openVessel.vessel_type,
    flag: openVessel.flag,
    dwt: openVessel.dwt,
    grt: openVessel.grt,
    provider: openVessel.provider,
    license: openVessel.provider_license
  }, {
    name: "MSC AUBE F",
    type: "container ship",
    flag: "Panama",
    dwt: 15220,
    grt: 12679,
    provider: "wikidata",
    license: "CC0-1.0"
  });
  assert.equal(provider.normalizeWikidataVesselBindings([{
    ship: { value: "http://www.wikidata.org/entity/Q105765847" },
    imo: { value: "9360283" }
  }], "9360283").grt, null);

  const currentPublicVessel = provider.normalizeVesselFinderHtml(`
    <title>NUR K, General Cargo Ship - IMO 9389370</title>
    <table>
      <tr><td>IMO number</td><td>9389370</td></tr>
      <tr><td>Vessel Name</td><td>NUR K</td></tr>
      <tr><td>Ship Type</td><td>General Cargo Ship</td></tr>
      <tr><td>Flag</td><td>Comoros</td></tr>
      <tr><td>Year of Build</td><td>2006</td></tr>
      <tr><td>Length Overall <small>(m)</small></td><td>81.00</td></tr>
      <tr><td>Beam <small>(m)</small></td><td>13.60</td></tr>
      <tr><td>Gross Tonnage</td><td>1972</td></tr>
      <tr><td>Deadweight <small>(t)</small></td><td>3349</td></tr>
      <tr><td>IMO / MMSI</td><td>9389370 / 620800377</td></tr>
      <tr><td>Callsign</td><td>D6A4377</td></tr>
    </table>
  `, "9389370");
  assert.deepEqual({
    name: currentPublicVessel.vessel_name,
    type: currentPublicVessel.vessel_type,
    flag: currentPublicVessel.flag,
    dwt: currentPublicVessel.dwt,
    grt: currentPublicVessel.grt,
    mmsi: currentPublicVessel.mmsi,
    callSign: currentPublicVessel.call_sign,
    build: currentPublicVessel.build_year,
    provider: currentPublicVessel.provider
  }, {
    name: "NUR K",
    type: "General Cargo Ship",
    flag: "Comoros",
    dwt: 3349,
    grt: 1972,
    mmsi: "620800377",
    callSign: "D6A4377",
    build: 2006,
    provider: "vesselfinder_public"
  });
  assert.equal(provider.normalizeVesselFinderHtml(`
    <table><tr><td>IMO number</td><td>9389371</td></tr><tr><td>Vessel Name</td><td>WRONG</td></tr></table>
  `, "9389370"), null);
});
