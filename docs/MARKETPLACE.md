# Marketplace management

Marketplace is an Owner/Admin section inside the existing Admin Portal. It does not automatically publish external listings. No seller commission rates, fees, budgets, products or approved prices are configured by deploying the code. Existing records keep their IDs, SKUs, prices, images and history.

## Setup

1. Enter Jiji monthly promotion budget and expected selling-unit sales (or orders plus expected units per order), or choose a fixed/percentage adjustment. These are forecasts, not expenses. A wholesale box counts as one selling unit in the forecast.
2. Enter Jumia commission rates and fee components, optionally by marketplace category. Specify per-selling-unit, per-order or percentage basis, whether tax is included, and effective dates. Per-order estimates use the expected units per order.
3. Select exact retail/wholesale listings manually. Review suggested prices, then approve the actual listing price. Recalculation does not overwrite approval. Changed pricing inputs require renewed approval before fulfilment. Export approved listing data for manual external updates.
4. Website and Physical Store continue to use master prices by default. Optional channel settings apply consistently through catalogue and server checkout. Retail promotions do not stack on marketplace sales. Payment method, sales channel and retail/wholesale pricing remain separate.

Jumia recommendation = (desired retained amount + fixed fees + advertising allowance) / (1 - total applicable percentage deductions). The default retained target is the standard selling price, after all entered marketplace fees and before acquisition cost. Commission is one percentage component. The screen shows both after-commission and after-all-fees amounts; rounding is upward. Approved overrides can retain less than the target and should be reviewed. Estimated contribution is not actual profit. All currency is GHS.

## Orders and stock

Record a manual order with channel, seller account and unique external reference. References are deduplicated within that identity. Owner/Admin confirms it online, reserving exact SKU stock for an editable 24 hours (1–720 hours). Confirmation and extension check free stock, status, exact pack units and wholesale retail-stock reserves.

Availability is physical quantity less unexpired holds. Sales, inventory reductions, business-use issues, accounting stock reductions and pack conversions respect those holds. Expired holds stop affecting availability without needing a scheduled cleanup. A new/extended hold can fail if another buyer has since used the stock. Ordinary held till baskets do not reserve stock.

Open a confirmed marketplace order from POS Orders. Saving each sale deducts physical stock and reduces its hold atomically, capturing prices, standard-price baseline, fees estimate, exact variants, stock units and landed-cost snapshot. Duplicate sale IDs do not deduct twice. Remaining quantities can be fulfilled or cancelled separately. Whole wholesale selling units are required; initial MOQ applies to the original order. Marketplace fulfilment requires an online reservation check; existing walk-in offline handling is retained.

The initial fulfilment model is dispatch from PAM stock. Off-site marketplace warehouse inventory must not be entered as freely available shop stock without a separate reviewed location workflow.

## Expenses and settlement

Campaign budgets/coverage are separate from actual expense records. Multiple payments can be recorded per month, with payment references and campaign/product links. Actual charge dates feed financial reports; full campaign budgets are not repeated in every coverage month. Allocation for analysis never creates a second expense or changes landed cost.

Jumia sales use marketplace settlements receivable (1110), with no till cash collection. A balanced payout records bank movement, actual commission/processing expenses (6500) and clears the receivable, without new revenue. Each deduction has one linked expense; Accounting posts it once via the settlement source. Partial payouts, signed platform refunds, fee credits, reversals and bank references are supported. No guessed statement format is required: start with the manual reconciliation form.

Owner/Admin can record negotiated Jiji prices within configured limits, with a reason. Cashiers cannot set negotiated prices or see profitability reports. Receipts retain the approved layout and show agreed selling prices, exact variants and pack information without internal marketplace adjustment/cost fields.

## Reports and controls

Analytics > Channels & Marketplaces provides date/channel/product/category/campaign filters, Retail/Wholesale/Combined figures, gross profit, actual channel costs, contribution, cost recovery, campaign attribution and CSV export. Unknown costs/taxes/actual Jumia fees are not assumed zero. Cost recovery compares the saved net standard-price baseline with realised net sales and actual expenses for the same channel/period; it is internal analysis, not additional revenue. Zero expense denominators show N/A. Unattributed campaigns and unallocated shared costs remain explicit. Full retained datasets are used, with an explicit 50,000-record reporting ceiling.

Actual records and source journals are idempotent and audited. Closed accounting periods reject new marketplace financial postings. New collections are accessible only through role-checked server APIs; existing Firestore default-deny protection applies.
