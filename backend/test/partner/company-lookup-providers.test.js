import test from "node:test";
import assert from "node:assert/strict";

import {
  mukellefInfoLookupUrl,
  normalizeMukellefInfoPayload,
  normalizeNilveraCompanyPayload,
  turkeyCompanyLookupIsConfigured,
  turkeyCompanyLookupProvider
} from "../../src/lib/company-lookup-providers.js";

test("Turkish company lookup auto-detects and validates supported providers", () => {
  assert.equal(turkeyCompanyLookupProvider({
    turkeyProvider: "generic",
    turkeyApiUrl: "https://api.mukellef.info/v2/query.php"
  }), "mukellef_info");
  assert.equal(turkeyCompanyLookupIsConfigured({
    turkeyProvider: "mukellef_info",
    turkeyApiToken: "test-api-key"
  }), true);
  assert.equal(turkeyCompanyLookupIsConfigured({
    turkeyProvider: "mukellef_info",
    turkeyApiToken: ""
  }), false);
  assert.equal(turkeyCompanyLookupProvider({
    turkeyProvider: "generic",
    turkeyApiUrl: "https://api.nilvera.com"
  }), "nilvera");
  assert.equal(turkeyCompanyLookupIsConfigured({
    turkeyProvider: "nilvera",
    turkeyApiUrl: "https://api.nilvera.com",
    turkeyApiToken: "test-bearer-token"
  }), true);
});

test("mukellef.info payload maps into the partner company shape", () => {
  assert.equal(
    mukellefInfoLookupUrl({}, "1000000000"),
    "https://api.mukellef.info/v2/query.php?TaxNumber=1000000000"
  );

  const company = normalizeMukellefInfoPayload({
    isError: false,
    data: {
      taxNumber: "1000000000",
      taxOfficeName: "KADIKOY VERGI DAIRESI",
      companyType: "7",
      isActive: true,
      title: "TEST PARTNER ANONIM SIRKETI",
      addressInfo: {
        neighborhood: "CAFERAGA MAH.",
        street: "MODA CAD.",
        buildingNo: "1",
        districtName: "KADIKOY",
        cityName: "ISTANBUL"
      }
    }
  }, { country: "Turkiye", tax_number: "1000000000" });

  assert.equal(company.legal_name, "TEST PARTNER ANONIM SIRKETI");
  assert.equal(company.tax_office, "KADIKOY VERGI DAIRESI");
  assert.equal(company.company_type, "7");
  assert.equal(company.city, "ISTANBUL");
  assert.match(company.address, /MODA CAD/);
  assert.equal(company.tax_number, "1000000000");
});

test("Nilvera payload keeps known e-invoice fields without inventing missing office data", () => {
  const company = normalizeNilveraCompanyPayload([{
    TaxNumber: "1000000000",
    Title: "TEST PARTNER ANONIM SIRKETI",
    Name: "TEST PARTNER",
    Type: "Private",
    DocumentType: "EInvoice"
  }], { country: "Turkiye", tax_number: "1000000000" });

  assert.equal(company.legal_name, "TEST PARTNER ANONIM SIRKETI");
  assert.equal(company.display_name, "TEST PARTNER");
  assert.equal(company.company_type, "Private");
  assert.equal(company.tax_office, "");
  assert.equal(company.address, "");
});
