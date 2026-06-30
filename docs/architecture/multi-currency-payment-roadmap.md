# AllonaHub Multi-Currency Payment Roadmap

## Current State

- Product and order base amounts are stored and charged in TRY.
- Frontend can display converted prices for discovery and comparison.
- Checkout now separates the displayed currency from the settlement currency.
- `/v1/currency/rates` proxies exchange rates through the backend and caches them.

## Target State

AllonaHub should support true multi-currency checkout where a customer can see, confirm, pay, refund, and reconcile an order in a supported currency without losing the TRY base ledger.

## Required Payment Contract

Each order/payment intent should persist:

- `base_currency`: canonical catalog currency, initially `TRY`.
- `base_subtotal`, `base_shipping`, `base_discount`, `base_total`.
- `display_currency`: customer-selected currency.
- `display_subtotal`, `display_shipping`, `display_discount`, `display_total`.
- `settlement_currency`: provider charge currency.
- `settlement_total`.
- `fx_rate`, `fx_provider`, `fx_rate_at`, `fx_expires_at`.
- `rounding_delta`.
- `provider`, `provider_payment_id`, `provider_status`.

## Provider Decision Points

- Confirm which currencies each provider supports in production.
- Keep TRY as fallback for unsupported currencies.
- For iyzico, verify whether non-TRY checkout is contractually and technically enabled for the merchant account.
- Add provider-level currency allowlists before enabling live foreign-currency capture.

## Backend Flow

1. Client requests a quote: `POST /v1/payments/quote`.
2. Backend calculates base totals from trusted product/order data.
3. Backend loads cached FX rates from `/v1/currency/rates`.
4. Backend returns a signed quote with display and settlement amounts.
5. Client confirms checkout with the quote id.
6. Backend revalidates quote freshness and creates the provider checkout session.
7. Callback reconciles provider currency, amount, status, and quote id.

## Safety Rules

- Never trust frontend-converted totals for capture.
- Store the exact FX snapshot used for the payment.
- Expire quotes quickly, ideally 10-15 minutes.
- Reprice if cart contents, address, coupon, HP discount, or selected currency changes.
- Show users whether the payment is charged in selected currency or TRY.
- Refund in the original captured currency where provider supports it.

## Rollout Phases

1. Display-only conversion with clear TRY settlement disclosure. Done.
2. Backend FX proxy and cache. Done.
3. Payment quote endpoint and DB columns.
4. Provider capability matrix and admin currency allowlist.
5. True multi-currency checkout for a small allowlist such as USD, EUR, AZN.
6. Refund, accounting, invoice, and partner payout reconciliation.
7. Country/currency analytics and risk monitoring.

## Open Items

- Decide supported live payment currencies by provider.
- Add Supabase migrations for quote and payment currency fields.
- Add admin controls for enabled currencies and rate margin policy.
- Add tests for rounding, stale quotes, unsupported currencies, refunds, and callbacks.
