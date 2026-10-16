# Price & Cost History

Open **Admin → Insights → Analytics → Price & Cost History**. Owner/admin only. Existing Analytics charts and wishlists remain under Overview & wishlists.

Choose a product or exact SKU. The report reads the complete retained sales and audit collections, rather than the operational dashboard’s latest 500 entries. It fails explicitly if any source exceeds 50,000 records, instead of returning a partial comparison.

## Preserve starting values

Before trading, use **Preserve current baseline → Preview values → Confirm preservation**. This saves immutable private reference records. It does not change products, prices, images, SKUs, stock or accounting balances. Existing preserved values cannot be overwritten. Larger catalogues show remaining records to preserve after the first batch.

Baselines are timestamped when captured; they are not represented as the original purchase price. Earlier retained creation/edit/import audits are shown as the earliest available evidence. Unknown historical costs remain unknown.

Product edits, bulk price changes and CSV imports retain before/after financial values in the existing audit records. Product pricing includes an optional change reason. Supplier receipts, cost allocations, returns and other Accounting operations that update the product’s recorded unit cost also retain their price/cost changes in their atomic accounting audit. No mutable price history is added to public product documents.

## Understand percentages

- Gross profit = net sales revenue − recorded cost of goods sold.
- Gross margin % = gross profit ÷ net sales revenue × 100.
- Markup % = gross profit ÷ cost × 100.
- Cost percentage = cost ÷ net selling price × 100.
- A selling price of GH₵100 and cost GH₵60 gives GH₵40 gross profit, **40% margin** and **66.67% markup**, before discounts and any relevant tax allocation.
- Moving from 20% to 25% margin is **5 percentage points**. It is not a 5% relative increase.

Current indicative list-price figures allocate any currently applicable inclusive tax before calculating the spread. Historical list-price spread figures in the change register are explicitly before discounts and historical tax allocation. Actual before/after performance uses the original receipt’s discounted line totals, allocated tax and cost snapshots; it never recalculates old sales using today’s prices or tax policy.

Recorded cost is landed cost only when the complete landed unit amount was entered. Freight/duty or other costs are not invented or allocated automatically. Operating expenses are not allocated to individual SKUs in this report; net profit remains in Accounting and the operational reports.

## Compare performance

Choose a retained price/cost change and a maximum window of 7, 14, 30, 60 or 90 days. The report uses equal observed durations on each side, shortened when a change is recent. Exact change time belongs to After. No future sales are assumed. Custom date ranges must be ordered and non-overlapping. Different lengths are identified, with revenue and units per day available.

Metrics include net revenue, units sold/returned/net units, receipts and corrections, discounts, cost of goods sold, gross profit, gross margin, markup, average net selling price, gross profit per net unit and daily rates. Margin differences are shown in percentage points. Growth from a zero/non-positive denominator is unavailable.

Corrections retain originals. If a correction restores stock, its stock cost offsets the original. If stock is not restored, the original inventory cost remains consumed. Unconfirmed/legacy zero costs, missing tax allocations, invalid lines and missing dates are identified; incomplete margins are withheld. The scope is POS receipts/corrections across their recorded channels. Standalone Accounting invoices remain in Accounting.

CSV download includes current figures, earliest available values, exact comparison bounds, metrics and the complete selected SKU history. Text is escaped to prevent Excel formula execution. Empty values indicate unavailable figures, not zero. Comparisons are descriptive: promotions, demand and seasonality can affect outcomes too.
