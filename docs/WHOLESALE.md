# Wholesale setup and operation

Wholesale is additive: original product IDs, SKUs, retail selling prices, image paths and base-unit inventory are retained. Existing products have no wholesale availability until an owner/admin configures and enables it.

## Owner decisions
- Public wholesale prices; customer accounts remain optional.
- Individual pieces or complete packs/boxes per SKU; MOQ applies to each exact SKU/variant, never mixed colours/sizes.
- Admin-enabled products only. Existing payment/delivery setup, no overall order minimum.
- Retail discounts, promotions and PAM Deals do not stack on wholesale prices.
- Retail reserve is editable per SKU/variant in individual pieces. Retail may use it; wholesale sales cannot.

## Configure in Admin
Products → edit product → Pricing → Wholesale selling price.
Choose Individual piece, Pack or Box. For packs/boxes enter pieces per selling unit. Enter GHS per selected selling unit, minimum and increment in that selling unit (quantity = minimum + a multiple of increment). Stock remains individual pieces. Retail reserve (default0) is always individual pieces; it is never a count of packs. Wholesale available pieces = max(0, stock - retail reserve). A50-piece pack with50reserved: stock150permits2packs,100permits1pack,50isOutofstockforwholesale. Retail can sell the reserved pieces. APIcheckout and atomic POSsale recheck this limit; offline conflicts remain queued, and reconciliation cannot bypass the current reserve. Adjusting the reserve in Admin is audited and never edits stock.
Example: price100 per50-piece pack, minimum1pack; ordering2packs records100 pieces and charges200. Optional tier prices are also per pack/box.
Optional tiers have increasing quantity thresholds, above MOQ, and non-increasing prices.
Enable Available in Wholesale when ready. A disabled price can be prepared in advance.
Variants each have their own settings, quantity qualification and image. Saving one does not overwrite siblings.
All changes are included in the existing immutable Admin Audit.

## Import/update the same catalogue
The current upload accepts UTF-8 CSV. Excel can Save As CSV UTF-8; an XLSX supplied in chat can be converted and reviewed before import. No workbook supplied yet.
Existing PRICE is the retail selling price.
Optional wholesale columns:
WHOLESALE_ENABLED, WHOLESALE_PRICE, WHOLESALE_MIN_QTY, WHOLESALE_INCREMENT, WHOLESALE_TIERS, WHOLESALE_SELLING_UNIT, WHOLESALE_PACK_SIZE, WHOLESALE_RETAIL_RESERVE.
Use unchanged SKU. Example fictional row:
SKU,PRICE,WHOLESALE_ENABLED,WHOLESALE_PRICE,WHOLESALE_MIN_QTY,WHOLESALE_INCREMENT,WHOLESALE_TIERS,WHOLESALE_SELLING_UNIT,WHOLESALE_PACK_SIZE,WHOLESALE_RETAIL_RESERVE
DEMO-PEN,4.50,TRUE,35.00,1,1,5:33.00;10:32.00,pack,12,12
Blank cells preserve saved wholesale values. FALSE disables wholesale; NONE explicitly clears tiers.
Preview must be reviewed before Apply; stale previews and failed validation save nothing.
Stock, costs, barcodes, images and variant links retain their existing import protections.
Current catalogue export and blank template include the new columns.

## Shopping and orders
/wholesale has keyword search, categories, exact variant options, quantity breaks, a separate wholesale basket and the shared responsive checkout.
Retail basket is never silently repriced. Wholesale basket is stored separately on the customer's device.
Missing/disabled wholesale pricing, MOQ/increment errors and insufficient stock prevent checkout.
Server ignores client prices and recomputes from current product records, verifies expected total, and retains an order snapshot.
Website orders remain order requests under the current stock allocation process; they do not reserve/decrement stock merely by being created.
Order/API quantities remain base pieces, with immutable wholesaleSnapshot sellingUnit, unitsPerPack, sellingQuantity and sellingUnitPrice. Displays show packs and pieces; exact pack cents determine totals, never the rounded per-piece equivalent. A 35-GHS pack of12 charges70 for2packs, not70.08. Server requires expected pack size/type and rejects stale packaging. Only complete packs are available:125pieces supports2packs of50,25pieces remain available for retail. Per-line maximum remains999individualpieces; larger requests use a bulk quote.
Processed till sales atomically deduct exact individual units from shared inventory. Wholesale is a purchaseType, independent of website/WhatsApp/walk-in/phone salesChannel.
A product may have a valid wholesale price while its retail selling price is absent; it is exposed only through the separate wholesale catalogue and does not become a priced retail listing.
Bulk quote requests open WhatsApp for discussion, without committing stock, accepting payment or promising availability.

## POS, offline and receipts
Start/hold/clear the basket before changing Retail/Wholesale pricing. Cashiers select the configured mode but cannot edit wholesale prices.
Website/WhatsApp orders retain their pricing type when opened at the till.
Held/recovered baskets preserve type and revalidate current prices/stock.
Offline receipts capture type, actual wholesale unit prices and totals. Conflicting sync requires existing owner/admin reconciliation; no duplicate stock deduction.
The accepted receipt layout is retained, with a Pricing: Wholesale line only for wholesale transactions.
Old receipts/orders without purchaseType are retail.

## Reporting and cost history
Admin → Insights → Analytics → Retail & Wholesale:
Retail, Wholesale, Combined net revenue (excluding recorded tax), COGS, gross profit, gross margin, markup, pieces, packs, boxes, receipts and corrections.
Combined gross margin = combined gross profit / combined net revenue, not average of margins.
Costs use recorded sale snapshots; current product costs never rewrite history.
Missing/unconfirmed costs or tax values suppress incomplete profit/margin figures.
A reversal without stock restoration does not reverse its COGS.
Operating expenses are not allocated to each mode. Standalone invoices remain in Accounting; the trade report covers recorded POS sales and corrections, avoiding double-counting orders.
CSV downloads and the complete retained-sales API are owner/admin only; cashier/supervisor/customer access is rejected. POS dashboard shows split profit only to owner/admin.
Full retained query explicitly refuses over 50,000 records rather than returning a partial financial total.
Existing Price & Cost History remains available; wholesale configuration changes are preserved in Admin Audit.

## Pre-release verification
Use synthetic product and sale fixtures only. No live price configuration, stock edits, orders, ledger changes or test sales during screenshot review.
Run npm test and production build; remove temporary QA route and restore AGENTS before packaging.
Never include private PROJECT_STATE, backups, demo routes, logs or screenshots in the public commit.
