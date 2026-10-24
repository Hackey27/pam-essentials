# Source catalogue replacement and order discounts

## Catalogue replacement
Owner/Admin: Products → Import catalogue → Source catalogue replacement. Upload a UTF-8 CSV and preview before applying. Ordinary metadata imports remain available separately.

Source prices and costs are per individual piece. Stock is also individual pieces. The importer converts Pack rows to complete retail packs, retains loose remainders as inventory-only components, and displays wholesale unit price, MOQ and minimum order value. Blank wholesale prices disable wholesale. Unpriced resale products stay hidden. Retail activation/archive is independent of wholesale eligibility.

Explicit SKU mappings preserve the original internal identity for renames and the first split replacement; other split records get new identities. Review merged stock totals and source corrections. Reassigned product images are cleared only where indicated in preview; download the re-upload list after import. Existing category ordering and IDs are preserved. Active reservations and affected enabled packing recipes must be resolved first.

Only explicitly listed omitted SKUs can be removed. Linked sales, orders, stock movements, accounting and other checked dependencies block removal. Applying requires confirmations and a reason, uses a fresh preview, creates private recovery/audit records, and is idempotent. Inventory valuation changes are journalled once when Accounting is active. Do not upload private source files or migration snapshots to the public repository.

## Order discounts
Owner/Admin: Order Discounts. Create separate retail/wholesale spend thresholds and choose sales channels and dates. New rules start disabled; a justification is required. Order discounts do not stack with existing discounts.

Staff allowances start disabled. Set both a percentage ceiling and a GH₵ ceiling for each authorised staff member. Manual discounts require a reason and an online till. Amounts above either ceiling require an Admin approval, bound to the exact basket, price, channel and reason, expiring after 15 minutes and consumed once when the sale saves. A changed basket requires a new approval.

The checkout server rechecks prices, limits and approval. Discounts and their allocation are saved with the transaction, flow into receipts and financial records, and are audited. Cashiers do not receive product costs or profit information.
