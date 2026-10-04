"use client";

import { useEffect, useRef, useState } from "react";
import { barcodeEntries, normalizeBarcode, parseBarcodes } from "@/lib/barcodes.mjs";

export default function AdminProductBarcodes({ value, update }) {
  const [mode, setMode] = useState("scanner");
  const [scanInput, setScanInput] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [message, setMessage] = useState("");
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const updateRef = useRef(update);
  const addCodeRef = useRef(null);
  updateRef.current = update;
  const entries = barcodeEntries(value);
  const archive = new Set((value.archiveBarcodes || []).map(normalizeBarcode));
  const active = entries.filter((entry) => !entry.archived && !archive.has(normalizeBarcode(entry.code)));
  const archived = entries.filter((entry) => entry.archived || archive.has(normalizeBarcode(entry.code)));

  function addCode(raw) {
    const code = String(raw || "").trim();
    if (!code) return;
    if (code.includes(",") || code.length > 100) { setMessage("Scan one barcode at a time; use commas in Barcode(s) for manual entry."); return; }
    if (entries.some((entry) => normalizeBarcode(entry.code) === normalizeBarcode(code)) || parseBarcodes(value.barcodeAdditions).some((entry) => normalizeBarcode(entry) === normalizeBarcode(code))) { setMessage("This barcode is already listed for this product."); return; }
    update("barcodeAdditions", (current) => [String(current || "").trim().replace(/,+$/, ""), code].filter(Boolean).join(", "));
    setScanInput("");
    setMessage(`${code} added to the pending barcode list. Save the product to assign it.`);
  }
  addCodeRef.current = addCode;

  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    let active = true;
    import("@zxing/browser").then(({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader().decodeFromConstraints(
      { audio: false, video: { facingMode: "environment" } }, videoRef.current,
      (result, _error, controls) => { if (result && active) { controls.stop(); addCodeRef.current(result.getText()); setCameraOpen(false); } },
    )).then((controls) => { if (active) controlsRef.current = controls; else controls.stop(); }).catch((error) => { if (active) { setMessage(error?.name === "NotAllowedError" ? "Camera permission was denied. Use a scanner or type the code." : "Camera scanning is unavailable on this device."); setCameraOpen(false); } });
    return () => { active = false; controlsRef.current?.stop(); controlsRef.current = null; };
  }, [cameraOpen]);

  return <div className="admin-barcodes">
    <label className="admin-sku-field">SKU<input value={value.sku || ""} onChange={(event) => update("sku", event.target.value)} /></label>
    <label className="admin-barcode-field">Barcode(s)<textarea rows="2" placeholder="Enter new barcodes separated by commas" value={value.barcodeAdditions || ""} onChange={(event) => update("barcodeAdditions", event.target.value)} /></label>
    {active.length > 0 && <p className="muted">Current Barcode(s): {active.map((entry) => entry.code).join(", ")}</p>}
    <label className="admin-barcode-toggle"><input type="checkbox" checked={value.multipleBarcodes === true || active.length > 1} disabled={active.length > 1} onChange={(event) => update("multipleBarcodes", event.target.checked)} /> Multiple barcodes for this product</label>
    <p className="muted">Barcodes are assigned to this SKU. Existing codes can be archived, not deleted. Archived codes stay in the record and no longer scan at the till.</p>
    {active.length > 0 && <div className="admin-barcode-list" aria-label="Active barcodes">{active.map((entry) => <div key={entry.code}><code>{entry.code}</code><button type="button" onClick={() => update("archiveBarcodes", (current) => [...(current || []), entry.code])}>Archive</button></div>)}</div>}
    {archived.length > 0 && <details><summary>{archived.length} archived barcode{archived.length === 1 ? "" : "s"}</summary><div className="admin-barcode-list">{archived.map((entry) => <div key={entry.code}><code>{entry.code}</code><span>Archived</span></div>)}</div></details>}
    <div className="segmented admin-barcode-tabs" role="group" aria-label="Barcode entry method"><button type="button" className={mode === "scanner" ? "active" : ""} onClick={() => setMode("scanner")}>Use Scanner</button><button type="button" className={mode === "camera" ? "active" : ""} onClick={() => setMode("camera")}>Use Camera</button></div>
    {mode === "scanner" ? <div className="admin-barcode-scan"><label>Scanner input<input value={scanInput} autoComplete="off" placeholder="Scan code, then press Enter" onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCode(scanInput); } }} /></label><button type="button" className="button secondary" disabled={!scanInput.trim()} onClick={() => addCode(scanInput)}>Add barcode</button></div> : <div className="admin-barcode-camera"><p>Use a phone camera to capture one barcode.</p><button type="button" className="button secondary" onClick={() => { setMessage(""); setCameraOpen(true); }}>Open camera</button></div>}
    {message && <p className="admin-image-message" role="status">{message}</p>}
    {cameraOpen && <div className="modal-backdrop" onMouseDown={() => setCameraOpen(false)}><div className="modal pos-camera-modal" role="dialog" aria-modal="true" aria-label="Scan product barcode" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><h2>Use Camera</h2><button type="button" className="icon-button" onClick={() => setCameraOpen(false)} aria-label="Close camera">×</button></div><video ref={videoRef} muted playsInline autoPlay /><p>Point the camera at the product barcode.</p></div></div>}
  </div>;
}
