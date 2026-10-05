"use client";

import { useEffect, useRef, useState } from "react";
import { barcodeEntries, normalizeBarcode, parseBarcodes } from "@/lib/barcodes.mjs";
import useBarcodeCamera from "@/components/useBarcodeCamera";
import { useAuth } from "@/components/AuthProvider";
import { adminScanConflict } from "@/lib/scannerWorkflow.mjs";
import BarcodeScannerPanel from "@/components/BarcodeScannerPanel";
import ScannerPrompt from "@/components/ScannerPrompt";

export default function AdminProductBarcodes({ value, update, products = [] }) {
  const { user } = useAuth();
  const [scanError, setScanError] = useState("");
  const [checking, setChecking] = useState(false);
  const [scanBatch, setScanBatch] = useState([]);
  const checkingRef = useRef(false);
  const promptRef = useRef(false);
  const sessionRef = useRef(0);
  const liveRef = useRef(true);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => { liveRef.current = true; return () => { liveRef.current = false; }; }, []);
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

  const multiple = value.multipleBarcodes === true || active.length > 1;
  function showScanError(text) { promptRef.current = true; setScanError(text); }
  async function addCode(raw, fromCamera = false) {
    if (checkingRef.current || promptRef.current) return;
    const code = String(raw || "").trim();
    if (!code) return;
    if (code.includes(",") || /[\r\n]/.test(code) || code.length > 100) { showScanError("Scan one barcode or QR code at a time, up to 100 characters."); return; }
    const conflict = adminScanConflict(value, products, code, [...parseBarcodes(value.barcodeAdditions), ...scanBatch]);
    if (conflict) { showScanError(conflict); return; }
    if (entries.length + parseBarcodes(value.barcodeAdditions).length + scanBatch.length >= 100) { showScanError("A product can have at most 100 barcode records."); return; }
    const session = sessionRef.current;
    const productId = value.id;
    checkingRef.current = true;
    setChecking(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/barcodes/check", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const owner = await response.json();
      if (!liveRef.current || session !== sessionRef.current || valueRef.current.id !== productId) return;
      if (!response.ok) throw new Error(owner.error || "Could not check barcode ownership. Try scanning again.");
      if (owner.assigned) { showScanError(!value.create && owner.productId === value.id ? "Already scanned for this product." : `This barcode is already assigned to ${owner.name || owner.sku || owner.productId}.`); return; }
      if (fromCamera && multiple) {
        setScanBatch((current) => [...current, code]);
        setMessage(`${code} recorded. Scan the next code or choose Add bar codes.`);
      } else {
        update("barcodeAdditions", (current) => [String(current || "").trim().replace(/,+$/, ""), code].filter(Boolean).join(", "));
        setMessage(`${code} added to the pending barcode list. Save the product to assign it.`);
        if (fromCamera) closeScanner();
      }
      setScanInput("");
      if (!fromCamera) scannerInput.current?.focus();
    } catch (error) { if (liveRef.current && session === sessionRef.current) showScanError(error.message || "Barcode ownership could not be checked. Try again."); }
    finally { checkingRef.current = false; if (liveRef.current) setChecking(false); }
  }
  const { cameraOpen, videoRef, openCamera, closeCamera } = useBarcodeCamera((code) => addCode(code, true), setMessage, { continuous: true, keepOpenOnError: true, paused: checking || Boolean(scanError), isPaused: () => checkingRef.current || promptRef.current });
  function closeScanner() { sessionRef.current++; closeCamera(); }
  function openScanner() { sessionRef.current++; setMessage(""); setMode("camera"); openCamera(); }
  function addBatch() {
    update("barcodeAdditions", (current) => [...parseBarcodes(current), ...scanBatch].filter((code, index, all) => all.findIndex((item) => normalizeBarcode(item) === normalizeBarcode(code)) === index).join(", "));
    setMessage(`${scanBatch.length} codes added to the pending list. Save the product to assign them.`);
    setScanBatch([]);
    closeScanner();
  }
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
    <div className="segmented admin-barcode-tabs" role="group" aria-label="Barcode entry method"><button type="button" className={mode === "scanner" ? "active" : ""} onClick={() => { closeScanner(); setMode("scanner"); setScannerFocus((current) => current + 1); setMessage("Scanner ready. Scan with a connected USB or Bluetooth reader, then press Enter if needed."); }}>Use Scanner</button><button type="button" className={mode === "camera" ? "active" : ""} onClick={openScanner}>Use Camera</button></div>
    {mode === "scanner" ? <div className="admin-barcode-scan"><label>Scanner input<input ref={scannerInput} value={scanInput} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Scan code, then press Enter" onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); addCode(event.currentTarget.value); } }} /></label><button type="button" className="button secondary" disabled={checking || !scanInput.trim()} onClick={() => addCode(scanInput)}>Add barcode</button></div> : <p className="muted">Use Camera to collect barcode or QR codes, or Use Scanner for a connected reader.</p>}
    {message && <p className="admin-image-message" role="status">{message}</p>}
    {cameraOpen && <BarcodeScannerPanel title="Scan product barcodes" videoRef={videoRef} onClose={closeScanner} actions={<><button type="button" className="button secondary" onClick={closeScanner}>Close scanner</button><button type="button" className="button primary" disabled={checking || !scanBatch.length} onClick={addBatch}>Add bar codes{scanBatch.length ? ` (${scanBatch.length})` : ""}</button></>}>
      <p className="notice" role="status">{checking ? "Checking barcode assignment…" : message || (multiple ? "Scanned codes will appear below. Choose Add bar codes when finished." : "Scan a code to add it to this product.")}</p>
      <div className="scanner-code-entry"><label>Scanner or manual code<input value={scanInput} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Scan with a connected reader or type a code" onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCode(event.currentTarget.value, true); } }} /></label><button type="button" className="button secondary" disabled={checking || !scanInput.trim()} onClick={() => addCode(scanInput, true)}>Record code</button></div>
      <h3>Scanned codes ({scanBatch.length})</h3><div className="admin-barcode-list">{scanBatch.length ? scanBatch.map((code) => <div key={code}><code>{code}</code><button type="button" onClick={() => setScanBatch((current) => current.filter((item) => item !== code))}>Remove pending code</button></div>) : <p className="muted">No new codes scanned yet.</p>}</div>
    </BarcodeScannerPanel>}
    {scanError && <ScannerPrompt message={scanError} onOk={() => { promptRef.current = false; setScanError(""); setScanInput(""); if (!cameraOpen) scannerInput.current?.focus(); }} />}

  </div>;
}
