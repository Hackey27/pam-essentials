"use client";

import { useState } from "react";
import ReceiptPanel from "@/components/ReceiptPanel";
import { receiptSnapshot } from "@/lib/receiptData.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function AdminReceipts({ sales = [] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const receipts = sales.map(receiptSnapshot).filter((sale) => `${sale.receiptId} ${sale.customerName} ${sale.customerPhone} ${sale.orderReference}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(receipts.length / 15));
  return <><div className="table-tools"><input placeholder="Search receipt, customer or order reference" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><span>{receipts.length} transactions</span></div>{receipts.length ? <><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Receipt</th><th>Date / time</th><th>Customer / reference</th><th>Products</th><th>Amount</th><th>Payment</th><th>Cashier</th><th>Action</th></tr></thead><tbody>{receipts.slice((page - 1) * 15, page * 15).map((sale) => <tr key={sale.id || sale.receiptId}><td>{sale.receiptId}</td><td>{sale.createdAt ? new Date(sale.createdAt).toLocaleString("en-GH") : "—"}</td><td>{sale.customerName || sale.orderReference || "Walk-in"}</td><td>{sale.items.reduce((count, item) => count + item.quantity, 0)}</td><td>{money.format(sale.total)}</td><td>{sale.paymentMethod.replaceAll("-", " ")}</td><td>{sale.staffEmail}</td><td><button className="table-action" onClick={() => setSelected(sale)}>Open / Print</button></td></tr>)}</tbody></table></div>{pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</> : <div className="empty-state"><h2>No receipts recorded yet</h2><p>Saved sales will appear here.</p></div>}{selected && <ReceiptPanel sale={selected} onClose={() => setSelected(null)} />}</>;
}

