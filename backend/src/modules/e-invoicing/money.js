import { EInvoicingError } from "./errors.js";

function pow10(scale) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 12) {
    throw new EInvoicingError("Decimal scale geçersiz.", { code: "INVALID_DECIMAL_SCALE" });
  }
  return 10n ** BigInt(scale);
}

export function decimalToInteger(value, scale = 2) {
  let input;
  if (typeof value === "number") {
    throw new EInvoicingError("Para ve miktar değeri JS Number olamaz; veritabanından decimal string olarak alınmalıdır.", {
      code: "UNSAFE_DECIMAL_NUMBER",
      details: { scale }
    });
  } else {
    input = String(value ?? "").trim();
  }
  const match = input.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new EInvoicingError("Tutar decimal string olmalıdır.", {
      code: "INVALID_DECIMAL",
      details: { value: input.slice(0, 80), scale }
    });
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] || "";
  const excess = fraction.slice(scale);
  if (excess && /[1-9]/.test(excess)) {
    throw new EInvoicingError("Tutar izin verilen hassasiyeti aşıyor.", {
      code: "DECIMAL_PRECISION_EXCEEDED",
      details: { scale }
    });
  }
  const normalizedFraction = fraction.slice(0, scale).padEnd(scale, "0");
  return sign * (BigInt(match[2]) * pow10(scale) + BigInt(normalizedFraction || "0"));
}

export function integerToDecimal(value, scale = 2) {
  const integer = typeof value === "bigint" ? value : BigInt(value);
  const sign = integer < 0n ? "-" : "";
  const absolute = integer < 0n ? -integer : integer;
  const divisor = pow10(scale);
  const whole = absolute / divisor;
  const fraction = String(absolute % divisor).padStart(scale, "0");
  return scale ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function roundDivide(numerator, denominator) {
  if (denominator <= 0n) {
    throw new EInvoicingError("Decimal bölen sıfırdan büyük olmalıdır.", { code: "INVALID_DIVISOR" });
  }
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return sign * rounded;
}

export function addMoney(...values) {
  return integerToDecimal(values.reduce((total, value) => total + decimalToInteger(value, 2), 0n), 2);
}

export function calculateIncludedTax({ grossAmount, taxRate }) {
  const grossMinor = decimalToInteger(grossAmount, 2);
  const rateUnits = decimalToInteger(taxRate, 4);
  if (grossMinor < 0n || rateUnits < 0n) {
    throw new EInvoicingError("Vergi dahil tutar ve oran negatif olamaz.", { code: "NEGATIVE_INCLUDED_TAX_INPUT" });
  }
  if (grossMinor === 0n || rateUnits === 0n) return "0.00";
  const oneHundredPercentUnits = 100n * 10_000n;
  return integerToDecimal(roundDivide(grossMinor * rateUnits, oneHundredPercentUnits + rateUnits), 2);
}

export function subtractMoney(minuend, subtrahend) {
  return integerToDecimal(decimalToInteger(minuend, 2) - decimalToInteger(subtrahend, 2), 2);
}

export function calculateInvoiceLine({ quantity, unitPrice, discountAmount = "0.00", taxRate = "0.0000" }) {
  const quantityUnits = decimalToInteger(quantity, 4);
  const unitPriceUnits = decimalToInteger(unitPrice, 4);
  const discountMinor = decimalToInteger(discountAmount, 2);
  const taxRateUnits = decimalToInteger(taxRate, 4);
  if (quantityUnits <= 0n || unitPriceUnits < 0n || discountMinor < 0n || taxRateUnits < 0n) {
    throw new EInvoicingError("Fatura satırı negatif değer içeremez.", { code: "NEGATIVE_INVOICE_LINE" });
  }

  const grossMinor = roundDivide(quantityUnits * unitPriceUnits, 1_000_000n);
  const taxableMinor = grossMinor - discountMinor;
  if (taxableMinor < 0n) {
    throw new EInvoicingError("İndirim satır brüt tutarını aşamaz.", { code: "DISCOUNT_EXCEEDS_LINE" });
  }
  const taxMinor = roundDivide(taxableMinor * taxRateUnits, 1_000_000n);
  return Object.freeze({
    gross: integerToDecimal(grossMinor, 2),
    discount: integerToDecimal(discountMinor, 2),
    taxable: integerToDecimal(taxableMinor, 2),
    tax: integerToDecimal(taxMinor, 2),
    total: integerToDecimal(taxableMinor + taxMinor, 2)
  });
}

export function sumInvoiceLines(lines) {
  return lines.reduce((totals, line) => ({
    subtotal: addMoney(totals.subtotal, line.gross),
    discountTotal: addMoney(totals.discountTotal, line.discount),
    taxTotal: addMoney(totals.taxTotal, line.tax),
    grandTotal: addMoney(totals.grandTotal, line.total)
  }), {
    subtotal: "0.00",
    discountTotal: "0.00",
    taxTotal: "0.00",
    grandTotal: "0.00"
  });
}
