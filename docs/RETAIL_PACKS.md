# Retail stock units and packing

Existing products default to individual stock units. Deploying this feature never multiplies stock or converts old records. Separate finished-pack SKUs retain separate barcodes, vendor costs, images and prices; use existing product Variants to link the selling formats.

## Product setup

- Retail selling/stock unit: Individual (contents 1) or Finished pack (contents 2–1,000,000).
- Item role: Sellable or inventory/component only. Components stay in Inventory and are hidden from both retail and wholesale.
- Retail availability is independent of Wholesale enabled and inventory classification (Resale / Fixed asset / Consumables).
- PRICE is per retail stock unit, whether one item or one complete finished pack. WHOLESALE_PRICE is per configured wholesale selling unit. No third selling-price column is required.
- Wholesale conversion, retail reserve and business-use limits count RETAIL STOCK UNITS. A box of 10 finished packs of 20 contains 200 individual pieces. Conversion 1 with MOQ 5 sells five of the same retail pack at its wholesale rate.

Changing existing unit metadata with positive stock requires an explicit Admin confirmation that quantities AND costs already count the chosen complete unit, plus a reason. Active reservations must first be released. This confirmation does not perform a physical conversion. New pack SKUs should normally begin at zero and receive stock through packing or reviewed inventory receipts.

## CSV UTF-8 additions

Download the current template from Products > Import/update catalogue. New supported columns:

| Column | Values / meaning |
| --- | --- |
| RETAIL_ENABLED | TRUE / FALSE; blank preserves |
| RETAIL_SELLING_UNIT | individual / pack |
| RETAIL_CONTENTS | Whole individual contents per retail stock unit |
| INVENTORY_ROLE | sellable / component |

Existing WHOLESALE_* and INVENTORY_CATEGORY columns remain supported. Unchanged SKU matches preserve image/barcode/history links. Blank cells retain existing values, subject to the existing explicit quote-price clearing rule. CSV cannot reinterpret a stocked product's unit: first review the mapping in the product editor. Stock, landed costs, recipes and variant combinations are controlled through their existing/specialised Admin workflows rather than unreviewed catalogue edits.

## Pack / Unpack

Admin > Packing lets Owner/Admin define a finished-pack SKU and components (including packaging SKUs), quantity per pack and whether each component is recovered when unpacking. Circular recipes and duplicate components are rejected. Preview shows exact stock and value changes; a changed stock/cost/recipe invalidates it.

Packing 15 packs of 20 consumes 300 loose items and applicable packaging once. Selling those finished packs then deducts only finished-pack stock. Finished stock receives recorded component/packaging costs; this does not create an immediate duplicate expense. Unpacking allocates the finished stock value to recovered components using their recorded cost weights; discarded packaging is an expense. Reversals retain originals and require enough unreserved output stock and value.

For fractional average-cost results, complete Accounting opening setup and select weighted-average costing first. Non-weighted conversions are blocked when rounding would lose stock value. Reconcile any mismatch between physical quantity and the accounting inventory book before conversion. Real recipes, contents, stock/cost unit mappings and prices require owner review before activation.
