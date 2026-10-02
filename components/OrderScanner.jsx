"use client";

import { useEffect, useRef, useState } from "react";

export default function OrderScanner({ onCode, initialCamera = false }) {
  const [code, setCode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(initialCamera);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    let active = true;
    import("@zxing/browser").then(({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader().decodeFromConstraints(
      { audio: false, video: { facingMode: "environment" } }, videoRef.current,
      (result, _error, controls) => { if (result && active) { onCodeRef.current(result.getText()); controls.stop(); setCameraOpen(false); } },
    )).then((controls) => { if (active) controlsRef.current = controls; else controls.stop(); }).catch((cause) => { if (active) { setError(cause?.name === "NotAllowedError" ? "Camera permission was denied." : "Camera scanning is unavailable. Type or scan the item code instead."); setCameraOpen(false); } });
    return () => { active = false; controlsRef.current?.stop(); controlsRef.current = null; };
  }, [cameraOpen]);
  return <div className="order-scanner"><form onSubmit={(event) => { event.preventDefault(); onCode(code); setCode(""); }}><label>Scan or enter item code<input aria-label="Item barcode, QR code or SKU" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} /></label><button type="submit" className="button secondary" disabled={!code.trim()}>Confirm scan</button><button type="button" className="button secondary" onClick={() => { setError(""); setCameraOpen(true); }}>Use camera</button></form>{error && <p className="notice error-notice" role="alert">{error}</p>}{cameraOpen && <div className="modal-backdrop" onMouseDown={() => setCameraOpen(false)}><div className="modal pos-camera-modal" role="dialog" aria-modal="true" aria-label="Scan order item" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><h2>Scan order item</h2><button type="button" className="icon-button" onClick={() => setCameraOpen(false)} aria-label="Close camera">×</button></div><video ref={videoRef} muted playsInline autoPlay /><p>Point the camera at the product barcode or QR code.</p></div></div>}</div>;
}
