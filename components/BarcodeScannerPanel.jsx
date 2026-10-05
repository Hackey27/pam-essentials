"use client";

import { createPortal } from "react-dom";

export default function BarcodeScannerPanel({ title, onClose, videoRef, children, actions }) {
  return createPortal(<div className="modal-backdrop scanner-workspace-backdrop"><section className="modal scanner-workspace" role="dialog" aria-modal="true" aria-label={title}>
    <header className="drawer-title"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close scanner">×</button></header>
    <div className="scanner-workspace-scroll"><video ref={videoRef} muted playsInline autoPlay /><p className="muted">Point at a barcode or QR code. Move the code away briefly before scanning it again.</p>{children}</div>
    <footer className="scanner-workspace-actions">{actions}</footer>
  </section></div>, document.body);
}
