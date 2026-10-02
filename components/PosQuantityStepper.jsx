"use client";

import { useEffect, useState } from "react";

export default function PosQuantityStepper({ item, onChange }) {
  const [draft, setDraft] = useState(String(item.quantity));
  useEffect(() => setDraft(String(item.quantity)), [item.quantity]);
  const commit = () => {
    const parsed = Math.floor(Number(draft));
    if (Number.isFinite(parsed) && parsed >= 1) {
      const next = Math.max(1, Math.min(Number(item.stock), parsed));
      onChange(item.id, next);
      setDraft(String(next));
    }
    else setDraft(String(item.quantity));
  };
  return <div className="stepper pos-quantity-stepper"><button type="button" aria-label={`Remove one ${item.name}`} onClick={() => onChange(item.id, Math.max(1, item.quantity - 1))} disabled={item.quantity <= 1}>−</button><input type="number" min="1" max={item.stock} step="1" inputMode="numeric" aria-label={`Quantity for ${item.name}`} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><button type="button" aria-label={`Add one ${item.name}`} onClick={() => onChange(item.id, Math.min(item.stock, item.quantity + 1))} disabled={item.quantity >= item.stock}>+</button></div>;
}
