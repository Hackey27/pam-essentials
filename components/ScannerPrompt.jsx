"use client";

import { useId } from "react";
import { createPortal } from "react-dom";

export default function ScannerPrompt({ title = "Barcode notice", message, onOk, children }) {
  const id = useId();
  return createPortal(<div className="modal-backdrop scanner-prompt-backdrop"><section className="modal scanner-prompt" role="alertdialog" aria-modal="true" aria-labelledby={id} aria-describedby={`${id}-message`}>
    <h2 id={id}>{title}</h2><p id={`${id}-message`}>{message}</p><div className="scanner-prompt-actions">{children || <button type="button" autoFocus className="button primary" onClick={onOk}>Ok</button>}</div>
  </section></div>, document.body);
}
