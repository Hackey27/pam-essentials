"use client";

import { useEffect, useState } from "react";
import { exportCatalogueCsv, maxImportBytes, maxImportRows } from "@/lib/catalogueImport.mjs";

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const valueLabel = (value) => value == null || value === "" ? "Not set" : Array.isArray(value) ? value.join("; ") : String(value);
export default function AdminCatalogueImport({ products, authorizedFetch, onImported, onClose }) {
  const [file, setFile] = useState(null), [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null), [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [rowErrors, setRowErrors] = useState([]), [notice, setNotice] = useState("");
  const [source, setSource] = useState(null);
  useEffect(() => { let active = true; authorizedFetch("/api/admin/seed").then((response) => response.json()).then((data) => { if (active) setSource(data.source); }).catch(() => {}); return () => { active = false; }; }, []);
  async function choose(next) {
    setFile(null); setCsv(""); setPreview(null); setError(""); setRowErrors([]); setNotice("");
    if (!next) return;
    if (!/\.csv$/i.test(next.name) || next.size > maxImportBytes) { setError("Choose a UTF-8 CSV file no larger than 2 MB."); return; }
    try { const content = new TextDecoder("utf-8", { fatal: true }).decode(await next.arrayBuffer()); setCsv(content); setFile(next); } catch { setError("This file could not be read as UTF-8. In Excel, save it as CSV UTF-8."); }
  }
  async function submit(mode) {
    if (busy || !file || !csv) return;
    setBusy(true); setError(""); setRowErrors([]); setNotice("");
    if (mode === "preview") setPreview(null);
    try {
      const response = await authorizedFetch("/api/admin/catalogue-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, csv, fileName: file.name, ...(mode === "apply" ? { previewHash: preview.previewHash, requestId } : {}) }) });
      const data = await response.json();
      if (!response.ok) { setRowErrors(data.errors || []); if (response.status === 409) setPreview(null); throw new Error(data.error || "Import could not be completed."); }
      if (mode === "preview") { setPreview(data); setRequestId(crypto.randomUUID()); }
      else { setPreview(null); setNotice(`${data.created} products added; ${data.updated} updated; ${data.unchanged} unchanged. Images and stock preserved.`); await onImported(); }
    } catch (err) { setError(err.message || "Import could not be completed."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="modal catalogue-import-dialog" role="dialog" aria-modal="true" aria-label="Import and update catalogue"><div className="drawer-title"><h2>Import / update catalogue</h2><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close catalogue import">×</button></div>
    <p>Use a UTF-8 CSV file, up to {maxImportRows} product rows and 2 MB. Match products by their unchanged SKU. Blank cells keep current values, except a blank PRICE clears the price when CONTACT_FOR_PRICE is enabled in Admin or set to TRUE in this file. Different SKUs create new records with zero stock.</p>
    <div className="catalogue-import-actions"><button type="button" className="button secondary" onClick={() => download("pam-catalogue-template.csv", exportCatalogueCsv())}>Download blank template</button><button type="button" className="button secondary" onClick={() => download("pam-current-catalogue.csv", exportCatalogueCsv(products))}>Export current catalogue</button></div>
    <details><summary>File columns and existing catalogue</summary><p><b>SKU</b> is required. Existing records can update <b>NAME, PRICE (GHS), CATEGORY, SUBCATEGORY, SUB_SUBCATEGORY, DESCRIPTION, KEYWORDS, PRODUCT_TYPE, CONTACT_FOR_PRICE</b>. Categories accept existing names or IDs. New records need NAME, CATEGORY and either PRICE or CONTACT_FOR_PRICE=TRUE. A missing PRICE column keeps an existing price; a blank PRICE cell clears it only for products enabled for pricing inquiries. CONTACT_FOR_PRICE accepts TRUE/FALSE; blank cells retain the saved checkbox. Set new category levels in Categories first. Separate keywords with semicolons. PRODUCT_TYPE overrides the subcategory-based browsing group; blank cells retain the saved type. Products without an override use their subcategory, or category if none.</p><p>Images, stock, barcodes, costs, variants, collections, archived status and category sort orders are preserved. Manage those through their existing Admin sections.</p>{source && <p>The existing “Import bundled catalogue” button reapplies {source.products} bundled product definitions with {source.categories} categories, {source.subcategories} subcategories and {source.subSubcategories} sub-subcategories, derived from Data.xlsx. It does not upload a file. Existing prices, stock, images and Admin hierarchy settings are kept.</p>}</details>
    <label>Catalogue CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => choose(event.target.files?.[0])} /></label><button type="button" className="button primary" disabled={busy || !file} onClick={() => submit("preview")}>{busy ? "Processing…" : "Preview file"}</button>
    {error && <p className="notice error-notice" role="alert">{error}</p>}{rowErrors.length > 0 && <ul className="import-row-errors">{rowErrors.map((item, index) => <li key={index}>Row {item.row} · {item.sku || "No SKU"}: {item.message}</li>)}</ul>}{notice && <p className="notice success-notice" role="status">{notice}</p>}
    {preview && <><p><b>{preview.summary.created} new · {preview.summary.updated} updated · {preview.summary.unchanged} unchanged</b></p><div className="data-table-wrap import-preview"><table className="data-table"><thead><tr><th>Row / SKU</th><th>Product</th><th>Status</th><th>Changes</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.sku}><td>{row.row}<span>{row.sku}</span></td><td>{row.name}</td><td>{row.status}</td><td>{row.changes.length ? row.changes.map((change) => <div key={change.field}><b>{change.field}</b>: {valueLabel(change.before)} → {valueLabel(change.after)}</div>) : "No changes"}</td></tr>)}</tbody></table></div><button type="button" className="button primary" disabled={busy || !(preview.summary.created + preview.summary.updated)} onClick={() => submit("apply")}>{busy ? "Applying…" : `Apply ${preview.summary.created + preview.summary.updated} reviewed changes`}</button></>}
  </section></div>;
}
