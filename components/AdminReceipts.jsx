"use client";

import { useState } from "react";
import ReceiptPanel from "@/components/ReceiptPanel";
import ReceiptSummaryCard from "@/components/ReceiptSummaryCard";
import { receiptSnapshot } from "@/lib/receiptData.mjs";

export default function AdminReceipts({ sales = [] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [printOnly, setPrintOnly] = useState(false);
  const [page, setPage] = useState(1);
  const receipts = sales.map(receiptSnapshot).filter((sale) => `${sale.receiptId} ${sale.customerName} ${sale.customerPhone} ${sale.orderReference}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(receipts.length / 15));
  return <><div className="table-tools"><input placeholder="Search receipt, customer or order reference" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><span>{receipts.length} transactions</span></div>{receipts.length ? <><div className="summary-grid">{receipts.slice((page - 1) * 15, page * 15).map((sale) => <ReceiptSummaryCard key={sale.id || sale.receiptId} sale={sale} onOpen={() => { setPrintOnly(false); setSelected(sale); }} onPrint={() => { setPrintOnly(true); setSelected(sale); }} />)}</div>{pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</> : <div className="empty-state"><h2>No receipts recorded yet</h2><p>Saved sales will appear here.</p></div>}{selected && <ReceiptPanel sale={selected} autoPrint={printOnly} onClose={() => { setSelected(null); setPrintOnly(false); }} />}</>;
}

