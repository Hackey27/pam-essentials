import {validateStockUnit,stockUnit} from "./stockUnits.mjs";
import { parseInventoryCategory, inventoryCategoryLabel } from './businessUse.mjs';
import { validateWholesale } from "./wholesale.mjs";
export const importColumns = ["RETAIL_ENABLED", "RETAIL_SELLING_UNIT", "RETAIL_CONTENTS", "INVENTORY_ROLE", "SKU", "NAME", "PRICE", "CATEGORY", "SUBCATEGORY", "SUB_SUBCATEGORY", "DESCRIPTION", "KEYWORDS", "PRODUCT_TYPE", "CONTACT_FOR_PRICE", "WHOLESALE_ENABLED", "WHOLESALE_PRICE", "WHOLESALE_MIN_QTY", "WHOLESALE_INCREMENT", "WHOLESALE_TIERS", "WHOLESALE_SELLING_UNIT", "WHOLESALE_PACK_SIZE", "WHOLESALE_RETAIL_RESERVE", "INVENTORY_CATEGORY"];
export const maxImportRows = 400;
export const maxImportBytes = 2 * 1024 * 1024;
const aliases = { RETAILENABLED:"retailEnabled",RETAILSELLINGUNIT:"retailSellingUnit",RETAILCONTENTS:"retailContents",INVENTORYROLE:"inventoryRole", INVENTORYCATEGORY:"inventoryCategory", INVENTORYCLASSIFICATION:"inventoryCategory", WHOLESALERETAILRESERVE:"wholesaleRetailReserve", WHOLESALESELLINGUNIT:"wholesaleSellingUnit", WHOLESALEPACKSIZE:"wholesalePackSize", WHOLESALEUNITSPERPACK:"wholesalePackSize", WHOLESALEENABLED:"wholesaleEnabled", WHOLESALEPRICE:"wholesalePrice", WHOLESALEUNITPRICE:"wholesalePrice", WHOLESALEMINQTY:"wholesaleMinQty", WHOLESALEMINIMUMQUANTITY:"wholesaleMinQty", WHOLESALEINCREMENT:"wholesaleIncrement", WHOLESALETIERS:"wholesaleTiers", CONTACTFORPRICE: "contactForPrice", PRODUCTTYPE: "productType", SKU: "sku", PRODUCTSKU: "sku", NAME: "name", ITEMS: "name", PRODUCTNAME: "name", PRICE: "price", SELLINGPRICE: "price", CATEGORY: "category", CATEGORYID: "category", SUBCATEGORY: "subcategory", SUBCATEGORYID: "subcategory", SUBSUBCATEGORY: "subSubcategory", SUBSUBCATEGORYID: "subSubcategory", DESCRIPTION: "description", PRODUCTDESCRIPTION: "description", KEYWORDS: "keywords", KEYWORDSTAGS: "keywords", TAGS: "keywords" };

export function parseCatalogueCsv(source) {
  const csv = String(source || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", quoted = false, closed = false;
  const endCell = () => { row.push(cell); cell = ""; closed = false; };
  const endRow = () => { endCell(); if (row.some((value) => value.trim())) rows.push(row); row = []; };
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (quoted) {
      if (char === '"') { if (csv[index + 1] === '"') { cell += '"'; index++; } else { quoted = false; closed = true; } }
      else cell += char;
    } else if (char === ',' ) endCell();
    else if (char === "\n" || char === "\r") { if (char === "\r" && csv[index + 1] === "\n") index++; endRow(); }
    else if (char === '"') { if (cell || closed) throw new Error("A CSV quote is misplaced. Use the supplied template."); quoted = true; }
    else { if (closed) throw new Error("Unexpected text after a quoted CSV cell."); cell += char; }
    if (rows.length > maxImportRows + 1) throw new Error(`Use at most ${maxImportRows} product rows per file.`);
  }
  if (quoted) throw new Error("A quoted CSV cell is not closed.");
  if (cell || row.length || closed) endRow();
  if (rows.length < 2) throw new Error("Add at least one product row below the CSV headings.");
  if (rows.length - 1 > maxImportRows) throw new Error(`Use at most ${maxImportRows} product rows per file.`);
  const headers = rows.shift().map((value) => {
    const key = aliases[value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")];
    if (!key) throw new Error(`Unsupported column: ${value}. Use the supplied template; stock, images and variants are managed in their Admin tabs.`);
    return key;
  });
  if (new Set(headers).size !== headers.length) throw new Error("CSV headings must not repeat the same field.");
  if (!headers.includes("sku")) throw new Error("A SKU column is required.");
  return rows.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Row ${index + 2} has ${cells.length} cells; expected ${headers.length}.`);
    return { row: index + 2, ...Object.fromEntries(headers.map((key, column) => {
      const value = cells[column].trim();
      // Reverse the explicit text escape used by our Excel-safe export.
      return [key, value.startsWith("'") && /^[=+@'-]/.test(value.slice(1)) ? value.slice(1) : value];
    })) };
  });
}
const normalizedWholesale=value=>{try{return validateWholesale(value)}catch{return value}};
const same = (a, b) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
const idOf = (node, kind) => node?.[`${kind}Id`] || node?.id || "";
function resolveNode(value, nodes, kind) {
  const exact = nodes.find((node) => idOf(node, kind) === value);
  if (exact) return exact;
  const named = nodes.filter((node) => String(node.name).trim().toLowerCase() === value.toLowerCase());
  if (named.length !== 1) throw new Error(`Choose an existing ${kind} name or ID within its parent. Create new categories in Admin first.`);
  return named[0];
}
export function planCatalogueImport(csv, records, hierarchy) {
  const rows = parseCatalogueCsv(csv);
  const bySku = new Map();
  for (const record of records) {
    const sku = String(record.data.sku || record.data.id || decodeURIComponent(record.docId)).trim();
    bySku.set(sku, [...(bySku.get(sku) || []), record]);
  }
  const seen = new Set(), entries = [], errors = [];
  for (const row of rows) {
    try {
      const sku = row.sku;
      if (!sku || sku.length > 80 || /[\x00-\x1f\x7f]/.test(sku) || /^[=+@]/.test(sku)) throw new Error("SKU must be plain text, non-empty, and at most 80 characters.");
      if (seen.has(sku)) throw new Error("That SKU is repeated in this file.");
      seen.add(sku);
      const matches = bySku.get(sku) || [];
      if (matches.length > 1) throw new Error("More than one saved product has this SKU. Correct the duplicate SKU in Admin before importing.");
      const record = matches[0], before = record?.data || null;
      const id = before?.id || (record ? decodeURIComponent(record.docId) : sku);
      if (!record && records.some((item) => item.docId === encodeURIComponent(sku))) throw new Error("This SKU conflicts with an existing product ID. Keep the existing SKU or use a different new SKU.");
      const patch = {};
      if(row.retailEnabled){if(!/^(true|false|yes|no|1|0)$/i.test(row.retailEnabled))throw new Error("RETAIL_ENABLED must be TRUE or FALSE.");patch.retailEnabled=/^(true|yes|1)$/i.test(row.retailEnabled);}
      if(row.retailSellingUnit||row.retailContents||row.inventoryRole){const current=stockUnit(before),next=validateStockUnit({...current,...(row.retailSellingUnit?{unit:row.retailSellingUnit.toLowerCase()}:{}),...(row.retailContents?{contents:Number(row.retailContents)}:{}),...(row.inventoryRole?{role:row.inventoryRole.toLowerCase()}:{} )});if(before&&Number(before.stock)>0&&JSON.stringify(next)!==JSON.stringify(current))throw new Error("Review existing stock/cost units in the product editor before changing pack units. CSV does not convert stock.");patch.retailUnit=next;}
      if (row.name) { if (row.name.length > 160 || /^[=+@]/.test(row.name)) throw new Error("Name must be plain text and at most 160 characters."); patch.name = row.name; }
      if (!before && !patch.name) throw new Error("New products need NAME, PRICE and CATEGORY.");
      if (row.contactForPrice) {
        const choice = row.contactForPrice.toLowerCase();
        if (!["true", "false", "yes", "no", "1", "0"].includes(choice)) throw new Error("CONTACT_FOR_PRICE must be TRUE or FALSE (or YES/NO).");
        patch.contactForPrice = ["true", "yes", "1"].includes(choice);
      }
      if (["wholesaleEnabled","wholesalePrice","wholesaleMinQty","wholesaleIncrement","wholesaleTiers","wholesaleSellingUnit","wholesalePackSize","wholesaleRetailReserve"].some(key=>row[key]!==undefined&&row[key]!=="")) {
        const config={enabled:false,unitPrice:null,minQty:1,increment:1,tiers:[],...before?.wholesale};
        if(row.wholesaleEnabled){const flag=row.wholesaleEnabled.toLowerCase();if(!["true","false","yes","no","1","0"].includes(flag))throw new Error("WHOLESALE_ENABLED must be TRUE or FALSE.");config.enabled=["true","yes","1"].includes(flag);}
        for(const [column,key] of [["wholesalePrice","unitPrice"],["wholesaleMinQty","minQty"],["wholesaleIncrement","increment"]])if(row[column])config[key]=row[column];
        if(row.wholesaleTiers)config.tiers=row.wholesaleTiers==="NONE"?[]:row.wholesaleTiers.split(";").map(value=>{const parts=value.trim().split(":");if(parts.length!==2)throw new Error("WHOLESALE_TIERS uses quantity:price;quantity:price, or NONE to clear.");return {minQty:parts[0],unitPrice:parts[1]};});
        if(row.wholesaleSellingUnit){config.sellingUnit=row.wholesaleSellingUnit.toLowerCase();if(config.sellingUnit==="unit"&&!row.wholesalePackSize)config.unitsPerPack=1;}
        if(row.wholesalePackSize)config.unitsPerPack=Number(row.wholesalePackSize);
        if(row.wholesaleRetailReserve!==undefined&&row.wholesaleRetailReserve!=="")config.retailReserve=Number(row.wholesaleRetailReserve);
        patch.wholesale=validateWholesale(config);
      }
      const quoteEnabled = patch.contactForPrice ?? before?.contactForPrice ?? false;
      if (quoteEnabled && row.price !== undefined && row.price === "") { patch.price = null; patch.sellable = false; }
      if (row.price) {
        if (!/^\d+(?:\.\d{1,2})?$/.test(row.price) || Number(row.price) > 10000000) throw new Error("PRICE must be a non-negative GHS amount with at most two decimals (e.g. 45.00).");
        patch.price = Number(row.price);
        patch.sellable = before?.active !== false && !before?.archived && patch.price > 0;
      }
      if (!before && patch.price === undefined) {
        if (quoteEnabled) { patch.price = null; patch.sellable = false; }
        else throw new Error("New products need NAME, PRICE and CATEGORY, or CONTACT_FOR_PRICE=TRUE instead of PRICE.");
      }
      if(row.inventoryCategory)patch.inventoryCategory=parseInventoryCategory(row.inventoryCategory);
      if (row.productType) {
        if (row.productType.length > 80 || /[\x00-\x1f\x7f]/.test(row.productType) || /^[=+@]/.test(row.productType)) throw new Error("PRODUCT_TYPE must be plain text and at most 80 characters.");
        patch.productType = row.productType;
      }
      if (row.description) { if (row.description.length > 3000) throw new Error("Description must be at most 3000 characters."); patch.description = row.description; }
      if (row.keywords) {
        const keywords = [...new Set(row.keywords.split(/[#,;\n]+/).map((value) => value.trim()).filter(Boolean))];
        if (keywords.length > 40 || keywords.some((value) => value.length > 80)) throw new Error("Use at most 40 keywords, each at most 80 characters.");
        patch.keywords = keywords;
      }
      if (!before || row.category || row.subcategory || row.subSubcategory) {
        if (!row.category && !before?.categoryId) throw new Error("New products need NAME, PRICE and CATEGORY.");
        const category = resolveNode(row.category || before.categoryId, hierarchy.categories, "category"), categoryId = idOf(category, "category");
        const categoryChanged = categoryId !== before?.categoryId;
        let subcategoryId = categoryChanged ? "" : before?.subcategoryId || "";
        if (row.subcategory) subcategoryId = idOf(resolveNode(row.subcategory, hierarchy.subcategories.filter((node) => node.categoryId === categoryId), "subcategory"), "subcategory");
        const subcategory = hierarchy.subcategories.find((node) => idOf(node, "subcategory") === subcategoryId && node.categoryId === categoryId);
        if (subcategoryId && !subcategory) throw new Error("The saved subcategory does not belong to this category. Choose a valid subcategory.");
        let subSubcategoryId = categoryChanged || subcategoryId !== before?.subcategoryId ? "" : before?.subSubcategoryId || "";
        if (row.subSubcategory) {
          if (!subcategoryId) throw new Error("Choose SUBCATEGORY before SUB_SUBCATEGORY.");
          subSubcategoryId = idOf(resolveNode(row.subSubcategory, hierarchy.subSubcategories.filter((node) => node.categoryId === categoryId && node.subcategoryId === subcategoryId), "subSubcategory"), "subSubcategory");
        }
        const leaf = hierarchy.subSubcategories.find((node) => idOf(node, "subSubcategory") === subSubcategoryId && node.subcategoryId === subcategoryId && node.categoryId === categoryId);
        if (subSubcategoryId && !leaf) throw new Error("The saved sub-subcategory does not belong to this subcategory. Choose a valid sub-subcategory.");
        Object.assign(patch, { categoryId, category: category.name, subcategoryId, subcategory: subcategory?.name || "", subSubcategoryId, subSubcategory: leaf?.name || "" });
      }
      if (before?.productGroupId && ["categoryId", "subcategoryId", "subSubcategoryId"].some((key) => patch[key] !== undefined && patch[key] !== (before[key] || ""))) throw new Error("This SKU has linked variants. Change its category hierarchy in the product editor so its combinations stay consistent.");
      if (before) for (const key of Object.keys(patch)) if (same(key==="wholesale"&&before[key]?normalizedWholesale(before[key]):key==="retailUnit"?stockUnit(before):key==="retailEnabled"?before.retailEnabled!==false:before[key], patch[key])) delete patch[key];
      const status = !before ? "new" : Object.keys(patch).length ? "update" : "unchanged";
      entries.push({ row: row.row, sku, id, record, before, patch, status });
    } catch (error) { errors.push({ row: row.row, sku: row.sku || "", message: error.message }); }
  }
  return { entries, errors, summary: { total: rows.length, created: entries.filter((entry) => entry.status === "new").length, updated: entries.filter((entry) => entry.status === "update").length, unchanged: entries.filter((entry) => entry.status === "unchanged").length } };
}
export function importPreview(plan) {
  return plan.entries.map(({ row, sku, id, before, patch, status }) => ({ row, sku, id, name: patch.name || before?.name || "", status, changes: Object.entries(patch).filter(([key]) => key !== "sellable").map(([field, after]) => ({ field, before: before?.[field] ?? null, after })) }));
}
const csvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+@'-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function exportCatalogueCsv(products = []) {
  return "\uFEFF" + [importColumns, ...products.map((product) => [product.retailEnabled===false?"FALSE":"TRUE",stockUnit(product).unit,stockUnit(product).contents,stockUnit(product).role,product.sku || product.id, product.name, product.price ?? "", product.categoryId || product.category, product.subcategoryId || "", product.subSubcategoryId || "", product.description || "", Array.isArray(product.keywords) ? product.keywords.join("; ") : product.keywords || "", product.productType || "", product.contactForPrice === true ? "TRUE" : "", product.wholesale?.enabled===true?"TRUE":product.wholesale?"FALSE":"", product.wholesale?.unitPrice??"", product.wholesale?.minQty??"", product.wholesale?.increment??"", product.wholesale?.tiers?.length?product.wholesale.tiers.map(t=>`${t.minQty}:${t.unitPrice}`).join(";"):product.wholesale?"NONE":"", product.wholesale?.sellingUnit??(product.wholesale?"unit":""), product.wholesale?.unitsPerPack??(product.wholesale?1:""), product.wholesale?.retailReserve??(product.wholesale?0:""), product.inventoryCategory?inventoryCategoryLabel(product):"" ])].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
