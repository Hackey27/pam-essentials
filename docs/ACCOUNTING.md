# PAM Accounting

Open **Admin → Insights → Accounting**. Access is limited to owner/admin. Cashiers and supervisors retain their existing permissions.

## Start accounting

1. Review cash, bank, Mobile Money, inventory, equipment, debts and owner funds with your accountant.
2. Choose **Set up opening balances**. Setup starts today, using balances at the time of activation. Earlier activity belongs in those opening balances.
3. Enter balanced asset/liability/equity lines. A new business with no balances can use a zero opening.
4. Choose moving weighted-average costing for receipts, or explicitly managed recorded costs.
5. Preview, resolve warnings and confirm. Current stock is snapshotted without changing quantities, SKUs or images.
6. Allocate missing SKU costs in Inventory and register any existing business-use equipment included in opening balances.

New POS receipts, expenses and cash movements post source-linked journals atomically after activation. Opening drawer counts do not create income. Late records in a closed period wait for reviewed current-period posting. Orders and pricing inquiries create no revenue by themselves.

## Purchases and sales

- **Supplier bill:** record the supplier, due date and items. Retail stock can be received now or linked to an existing stock receipt. Linking preserves quantities; retries cannot receive stock twice.
- **Customer invoice:** use for credit sales or services. Product invoices retain the exact SKU/variant and reduce stock. Do not process that same sale again at the till.
- **Payment:** record money actually received/paid against the document. Cash, bank, Mobile Money and card clearing are separate accounts.
- **Credit/refund:** originals remain intact. Product credits require a physical return and whole units. Supplier returns use carrying value, with a separately recorded cost difference. Dispose a returned business asset before crediting its supplier bill.
- **Expenses:** normal till/Admin expenses post once. Outside-till payments need funding classification.
- **Cash transfers, owner funding/drawings, loans, packaging consumption and assessed taxes:** use journal templates/lines. Owner drawings reduce equity.

These actions record bookkeeping. They do not send money through a bank or payment provider.

## Assets and period close

Business-use equipment belongs in Assets; equipment for resale belongs in retail inventory. Packaging for sale remains stock; internal packaging can be recorded as supplies and expensed when consumed.

The asset schedule uses straight-line depreciation and a full month from the in-service month. Review useful lives and residual values with your accountant. Post depreciation through a completed month-end. Disposal retains asset history.

Match cash/bank/Mobile Money statement movements in Reconciliation. Unmatched book differences remain visible. Only the owner can close/reopen periods, with an audit reason. Resolve source, inventory and asset register issues before close.

## Tax controls

VAT is initially off. Enabling it requires confirmed registration, registration details and an effective date. Rates/levies are editable. Future changes retain earlier policies; posted receipts retain their tax snapshots.

Catalogue selling prices stay unchanged and tax-inclusive. Accounting documents can use inclusive/exclusive prices. Mark exempt/zero-rated products in Products. Income-tax estimates are separate from VAT and require confirmation of the applicable scheme. Actual assessed tax liabilities/payments are posted through journals.

GRA E-VAT certification/integration and submission of returns are separate.

## Reports and controls

Select a period and download Excel, PDF or CSV. Statements include source/review status and supporting records. Reports cover the posted accounting dataset, rather than the operational dashboard's latest-500 slice. Accounting includes invoices, assets and adjustments; existing Analytics primarily covers till sales and operating expenses.

All entries balance in integer pesewas. Posted amounts are immutable. Corrections, tax changes and source postings are audited. Preview leases reject changed data; failed submissions retain the form and duplicate requests return the saved result.

Current export guardrails: 50,000 records per underlying collection; larger datasets fail explicitly rather than returning a partial report. PDF is limited to 5,000 pages; choose Excel/CSV or a narrower report for long ledgers.
