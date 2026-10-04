"use client";

import { useEffect, useRef, useState } from "react";
import { barcodeEntries, normalizeBarcode, parseBarcodes } from "@/lib/barcodes.mjs";
import useBarcodeCamera from "@/components/useBarcodeCamera";

export default function AdminProductBarcodes({ value, update }) {
  const [mode, setMode] = useState("scanner");
  const [scanInput, setScanInput] = useState("");
  const [scannerFocus, setScannerFocus] = useState(0);
  const [message, setMessage] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const scannerInput = useRef(null);
  const entries = barcodeEntries(value);
  const deletions = value.deleteBarcodes || [];
  const removed = new Set(deletions.map((entry) => normalizeBarcode(entry.code)));
  const archive = new Set((value.archiveBarcodes || []).map(normalizeBarcode));
  const active = entries.filter((entry) => !removed.has(normalizeBarcode(entry.code)) && !entry.archived && !archive.has(normalizeBarcode(entry.code)));
  const archived = entries.filter((entry) => !removed.has(normalizeBarcode(entry.code)) && (entry.archived || archive.has(normalizeBarcode(entry.code))));

  function addCode(raw) {
    const code = String(raw || "").trim();
    if (!code) return;
    if (code.includes(",") || /[\r\n]/.test(code) || code.length > 100) { setMessage("Scan one barcode at a time; use commas in Barcode(s) for manual entry."); return; }
    if (entries.some((entry) => normalizeBarcode(entry.code) === normalizeBarcode(code)) || parseBarcodes(value.barcodeAdditions).some((entry) => normalizeBarcode(entry) === normalizeBarcode(code))) { setMessage("This barcode is already listed for this product."); return; }
    update("barcodeAdditions", (current) => [String(current || "").trim().replace(/,+$/, ""), code].filter(Boolean).join(", "));
    setScanInput("");
    setMessage(`${code} added to the pending barcode list. Save the product to assign it.`);
    scannerInput.current?.focus();
  }
  const { cameraOpen, videoRef, openCamera, closeCamera } = useBarcodeCamera(addCode, setMessage);
  useEffect(() => { if (scannerFocus) scannerInput.current?.focus(); }, [scannerFocus]);

  function markForDeletion() {
    const reason = deleteReason.trim();
    if (!reason) return;
    update("archiveBarcodes", (current) => (current || []).filter((code) => normalizeBarcode(code) !== normalizeBarcode(deleteCode)));
    update("deleteBarcodes", (current) => [...(current || []), { code: deleteCode, reason }]);
    setMessage(`${deleteCode} will be unlinked when you save. The reason will be recorded in Audit.`);
    setDeleteCode("");
    setDeleteReason("");
  }
  const deleteButton = (code) => <button type="button" onClick={() => { setDeleteCode(code); setDeleteReason(""); }}>Delete</button>;

  return <div className="admin-barcodes">
    <label className="admin-sku-field">SKU<input value={value.sku || ""} onChange={(event) => update("sku", event.target.value)} /></label>
    <label className="admin-barcode-field">Barcode(s)<textarea rows="2" placeholder="Enter new barcodes separated by commas" value={value.barcodeAdditions || ""} onChange={(event) => update("barcodeAdditions", event.target.value)} /></label>
    {active.length > 0 && <p className="muted">Current Barcode(s): {active.map((entry) => entry.code).join(", ")}</p>}
    <label className="admin-barcode-toggle"><input type="checkbox" checked={value.multipleBarcodes === true || active.length > 1} disabled={active.length > 1} onChange={(event) => update("multipleBarcodes", event.target.checked)} /> Multiple barcodes for this product</label>
    <p className="muted">Barcodes are assigned to this SKU. Archive keeps a code reserved and disables scanning. Delete unlinks it from the SKU and requires an audited reason. Changes take effect when you save.</p>
    {active.length > 0 && <div className="admin-barcode-list" aria-label="Active barcodes">{active.map((entry) => <div key={entry.code}><code>{entry.code}</code><span className="admin-barcode-actions"><button type="button" onClick={() => update("archiveBarcodes", (current) => [...(current || []), entry.code])}>Archive</button>{deleteButton(entry.code)}</span></div>)}</div>}
    {archived.length > 0 && <details><summary>{archived.length} archived barcode{archived.length === 1 ? "" : "s"}</summary><div className="admin-barcode-list">{archived.map((entry) => <div key={entry.code}><code>{entry.code}</code><span className="admin-barcode-actions"><span>Archived</span>{deleteButton(entry.code)}</span></div>)}</div></details>}
    {deleteCode && <section className="admin-barcode-delete" aria-label="Delete barcode confirmation">
      <strong>Delete barcode {deleteCode}?</strong><p>This will unlink the code from this SKU when you save the product. Previous sales remain unchanged.</p>
      <label>Reason for deletion<textarea autoFocus maxLength={1000} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Explain why this barcode should be removed" /></label>
      <div className="admin-barcode-actions"><button type="button" className="button secondary" onClick={() => setDeleteCode("")}>Cancel</button><button type="button" className="button primary" disabled={!deleteReason.trim()} onClick={markForDeletion}>Delete on save</button></div>
    </section>}
    {deletions.length > 0 && <div className="admin-barcode-list" aria-label="Pending barcode deletions">{deletions.map((entry) => <div key={entry.code}><span><code>{entry.code}</code><small>Pending deletion: {entry.reason}</small></span><button type="button" onClick={() => update("deleteBarcodes", (current) => current.filter((item) => normalizeBarcode(item.code) !== normalizeBarcode(entry.code)))}>Undo</button></div>)}</div>}
    <div className="segmented admin-barcode-tabs" role="group" aria-label="Barcode entry method"><button type="button" className={mode === "scanner" ? "active" : ""} onClick={() => { closeCamera(); setMode("scanner"); setScannerFocus((current) => current + 1); setMessage("Scanner ready. Scan with a connected USB or Bluetooth reader, then press Enter if needed."); }}>Use Scanner</button><button type="button" className={mode === "camera" ? "active" : ""} onClick={() => { setMode("camera"); setMessage(""); openCamera(); }}>Use Camera</button></div>
    {mode === "scanner" ? <div className="admin-barcode-scan"><label>Scanner input<input ref={scannerInput} value={scanInput} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Scan code, then press Enter" onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); addCode(event.currentTarget.value); } }} /></label><button type="button" className="button secondary" disabled={!scanInput.trim()} onClick={() => addCode(scanInput)}>Add barcode</button></div> : <p className="muted">Tap Use Camera to scan another barcode, or Use Scanner for a connected reader.</p>}
    {message && <p className="admin-image-message" role="status">{message}</p>}
    {cameraOpen && <div className="modal-backdrop pos-camera-backdrop" onMouseDown={closeCamera}><div className="modal pos-camera-modal" role="dialog" aria-modal="true" aria-label="Scan product barcode" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><h2>Use Camera</h2><button type="button" className="icon-button" onClick={closeCamera} aria-label="Close camera">×</button></div><video ref={videoRef} muted playsInline autoPlay /><p>Point the camera at the product barcode.</p><button type="button" className="button secondary" onClick={closeCamera}>Cancel</button></div></div>}
  </div>;
}
