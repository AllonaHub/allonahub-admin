import test from "node:test";
import assert from "node:assert/strict";
import { addMoney, calculateIncludedTax, calculateInvoiceLine, decimalToInteger, integerToDecimal, sumInvoiceLines } from "../../src/modules/e-invoicing/money.js";

test("decimal helpers never use floating point", () => {
  assert.equal(decimalToInteger("0.10"), 10n);
  assert.equal(integerToDecimal(101n), "1.01");
  assert.equal(addMoney("0.10", "0.20"), "0.30");
});

test("invoice line uses deterministic half-up rounding", () => {
  const line = calculateInvoiceLine({ quantity: "3", unitPrice: "19.9999", discountAmount: "0.00", taxRate: "20" });
  assert.deepEqual(line, {
    gross: "60.00",
    discount: "0.00",
    taxable: "60.00",
    tax: "12.00",
    total: "72.00"
  });
  assert.deepEqual(sumInvoiceLines([line, line]), {
    subtotal: "120.00",
    discountTotal: "0.00",
    taxTotal: "24.00",
    grandTotal: "144.00"
  });
});

test("precision loss is rejected", () => {
  assert.throws(() => decimalToInteger("1.009", 2), /hassasiyeti/);
  assert.throws(() => decimalToInteger(1.005, 2), /JS Number/);
});

test("tax included shipping amount is derived from gross and rate", () => {
  assert.equal(calculateIncludedTax({ grossAmount: "118.00", taxRate: "18" }), "18.00");
  assert.equal(calculateIncludedTax({ grossAmount: "0.00", taxRate: "20" }), "0.00");
});
