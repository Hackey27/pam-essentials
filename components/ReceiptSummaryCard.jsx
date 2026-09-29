"use client";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export function cashierFirstName(sale) {
  const name = String(sale.staffName || sale.staffEmail?.split("@")[0] || "Staff").trim();
  const first = name.split(/[\s._-]+/)[0] || "Staff";
  return first[0].toUpperCase() + first.slice(1);
}

export default function ReceiptSummaryCard({ sale, onOpen, onPrint }) {
  const date = sale.createdAt ? new Date(sale.createdAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }) : "—";
  return <div className="summary-card receipt-summary-card" role="button" tabIndex={0} aria-label={`Open receipt for ${sale.customerName || "Walk-in"}`} onClick={onOpen} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(); } }}>
    <strong>{sale.customerName || "Walk-in"}</strong><b>{money.format(sale.total || 0)}</b><span>{date}</span><span>Cashier: {cashierFirstName(sale)}</span><button type="button" className="button secondary" onClick={(event) => { event.stopPropagation(); onPrint(); }}>Print</button>
  </div>;
}
