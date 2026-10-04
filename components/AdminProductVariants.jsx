"use client";

import { deepestCategory, variantKey } from "@/lib/adminVariants.mjs";

export default function AdminProductVariants({ value, update, products, categories, subcategories, subSubcategories }) {
  const titles = value.variantTitles || [];
  const rows = value.variantCombinations || [];
  const leaf = deepestCategory(value);
  const categoryOptions = subSubcategories.some((item) => item.subSubcategoryId === leaf)
    ? subSubcategories.filter((item) => item.subSubcategoryId === leaf)
    : subcategories.some((item) => item.subcategoryId === leaf)
      ? subcategories.filter((item) => item.subcategoryId === leaf)
      : categories.filter((item) => item.categoryId === leaf);
  const available = products.filter((item) => deepestCategory(item) === leaf && (!item.productGroupId || item.productGroupId === value.productGroupId));
  const chosen = new Set(rows.map((row) => row.productId));
  const setTitles = (next) => update("variantTitles", next);
  const setRows = (next) => update("variantCombinations", next);
  return <fieldset className="admin-variants"><legend>Variants</legend>
    <label className="admin-variant-toggle"><input type="checkbox" disabled={value.create} checked={value.variantEnabled === true} onChange={(event) => {
      update("variantEnabled", event.target.checked);
      if (event.target.checked && !titles.length) { setTitles([{ title: "Colour", values: [] }]); setRows([{ productId: value.id, options: {} }]); }
    }} /> This product has variants</label>
    {value.create ? <p>Save the product first, then return to assign variant titles and saved products.</p> : !value.variantEnabled ? <p className="muted">Customers buy this product as a single item.</p> : <>
      <p className="muted">Each combination links to a saved product. Its SKU, GHS price, stock and product card image remain its own.</p>
      <h3>Variant titles and values</h3>
      {titles.map((item, index) => <div className="admin-variant-title" key={index}>
        <label>Title<input required value={item.title || ""} placeholder="Colour or Size" onChange={(event) => setTitles(titles.map((entry, position) => position === index ? { ...entry, title: event.target.value } : entry))} /></label>
        <label>Values, separated by commas<input required value={(item.values || []).join(", ")} placeholder="Black, White, Lemon Green" onChange={(event) => setTitles(titles.map((entry, position) => position === index ? { ...entry, values: event.target.value.split(",").map((part) => part.trim()) } : entry))} /></label>
        <button type="button" disabled={titles.length === 1} onClick={() => setTitles(titles.filter((_, position) => position !== index))}>Remove title</button>
      </div>)}
      <button type="button" onClick={() => setTitles([...titles, { title: "", values: [] }])}>Add title</button>
      <h3>Combinations</h3>
      {rows.map((row, index) => <div className="admin-variant-combination" key={index}>
        <label>Final category<select value={leaf} disabled>{categoryOptions.map((item) => <option key={leaf} value={leaf}>{item.name}</option>)}</select></label>
        <label>Saved product<select required value={row.productId || ""} onChange={(event) => setRows(rows.map((entry, position) => position === index ? { ...entry, productId: event.target.value } : entry))}>
          <option value="">Choose product</option>{available.filter((item) => item.id === row.productId || !chosen.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku || item.id}</option>)}
        </select></label>
        {titles.map((item, titleIndex) => { const key = variantKey(item.title); return <label key={`${titleIndex}-${key}`}>{item.title || "Variant value"}<select required value={row.options?.[key] || ""} onChange={(event) => setRows(rows.map((entry, position) => position === index ? { ...entry, options: { ...entry.options, [key]: event.target.value } } : entry))}><option value="">Choose value</option>{(item.values || []).filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; })}
        <button type="button" disabled={row.productId === value.id} onClick={() => setRows(rows.filter((_, position) => position !== index))}>Remove combination</button>
      </div>)}
      <button type="button" onClick={() => setRows([...rows, { productId: "", options: {} }])}>Add Combination</button>
    </>}
  </fieldset>;
}
