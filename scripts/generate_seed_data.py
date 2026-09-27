"""Generate public-safe catalogue metadata from a private 18-column workbook.

Usage: python scripts/generate_seed_data.py path/to/Data.xlsx
The checked-in legacy product seed is preserved. No prices, costs, or stock are emitted.
"""

import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]


def clean(value):
    return str(value).strip() if value is not None else ""


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "Data.xlsx"
sheet = load_workbook(source, data_only=True, read_only=True)["Sheet1"]
rows = sheet.iter_rows(values_only=True)
headers = [clean(value).upper() for value in next(rows)]
required = {"PRODUCT SKU", "ITEMS", "CATEGORY", "SUBCATEGORY", "SUB-SUBCATEGORY", "PRODUCT_ID"}
if not required.issubset(headers):
    raise SystemExit("An 18-column catalogue workbook must be supplied as the first argument.")

metadata = []
categories = {}
subcategories = {}
sub_subcategories = {}

for values in rows:
    row = dict(zip(headers, values))
    sku = clean(row.get("PRODUCT SKU"))
    name = clean(row.get("ITEMS"))
    category = clean(row.get("CATEGORY"))
    if not sku or not name or not category:
        continue
    category_id = slug(category)
    subcategory = clean(row.get("SUBCATEGORY"))
    subcategory_id = f"{category_id}--{slug(subcategory)}" if subcategory else ""
    sub_subcategory = clean(row.get("SUB-SUBCATEGORY"))
    sub_subcategory_id = f"{subcategory_id}--{slug(sub_subcategory)}" if subcategory_id and sub_subcategory else ""
    if category_id not in categories:
        categories[category_id] = {"categoryId": category_id, "name": category, "sortOrder": len(categories) + 1}
    if subcategory_id and subcategory_id not in subcategories:
        sibling_count = sum(item["categoryId"] == category_id for item in subcategories.values())
        subcategories[subcategory_id] = {"subcategoryId": subcategory_id, "categoryId": category_id, "name": subcategory, "sortOrder": sibling_count + 1}
    if sub_subcategory_id and sub_subcategory_id not in sub_subcategories:
        sibling_count = sum(item["subcategoryId"] == subcategory_id for item in sub_subcategories.values())
        sub_subcategories[sub_subcategory_id] = {"subSubcategoryId": sub_subcategory_id, "subcategoryId": subcategory_id, "categoryId": category_id, "name": sub_subcategory, "sortOrder": sibling_count + 1}
    keywords = [part.strip() for part in re.split(r"[#,;\n]+", clean(row.get("KEY WORDS/TAGS"))) if part.strip()]
    metadata.append({
        "id": sku, "name": name, "description": clean(row.get("PRODUCT DESCRIPTION")),
        "category": category, "categoryId": category_id,
        "subcategory": subcategory, "subcategoryId": subcategory_id,
        "subSubcategory": sub_subcategory, "subSubcategoryId": sub_subcategory_id,
        "productGroupId": clean(row.get("PRODUCT_ID")),
        "colour": clean(row.get("COLOUR")), "size": clean(row.get("SIZE")),
        "colorVariantSizeProductId": clean(row.get("COLOR-VARINAT_SIZE_PRODUCT_ID")),
        "sizeVariantColorProductId": clean(row.get("SIZE-VARIANT_COLOR_PRODUCT_ID")),
        "keywords": keywords,
    })

data_dir = ROOT / "data"
data_dir.mkdir(exist_ok=True)
for filename, value in (
    ("product_metadata.json", metadata),
    ("category_hierarchy.json", {
        "categories": list(categories.values()),
        "subcategories": list(subcategories.values()),
        "subSubcategories": list(sub_subcategories.values()),
    }),
):
    (data_dir / filename).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {len(metadata)} product metadata records, {len(categories)} categories, {len(subcategories)} subcategories, {len(sub_subcategories)} sub-subcategories")

