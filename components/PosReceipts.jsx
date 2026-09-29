"use client";

import { useEffect, useState } from "react";
import ReceiptPanel from "@/components/ReceiptPanel";
import ReceiptSummaryCard from "@/components/ReceiptSummaryCard";

export default function PosReceipts({ user, onNewSale }) {
  const [receipts, setReceipts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [printOnly, setPrintOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/pos/receipts", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Receipts could not be loaded.");
        if (!cancelled) setReceipts(result.receipts || []);
      } catch (err) { if (!cancelled) setError(err.message || "Receipts could not be loaded."); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [user, refreshKey]);
  const filtered = receipts.filter((sale) => `${sale.receiptId} ${sale.customerName} ${sale.customerPhone} ${sale.orderReference}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  return <main className="pos-simple-view pos-receipts"><div className="pos-dashboard-heading"><div><h1>Recent Receipts</h1><p>Open, print, download or share a saved sale.</p></div><button className="button secondary" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button></div><div className="pos-filter-row"><label>Search receipt, customer or order<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Receipt number, name or reference" /></label><span>{filtered.length} receipts</span></div>{error && <p className="notice error-notice" role="alert">{error}</p>}{loading ? <div className="pos-loading">Loading receipts…</div> : filtered.length ? <><div className="summary-grid">{filtered.slice((page - 1) * 12, page * 12).map((sale) => <ReceiptSummaryCard key={sale.id || sale.receiptId} sale={sale} onOpen={() => { setPrintOnly(false); setSelected(sale); }} onPrint={() => { setPrintOnly(true); setSelected(sale); }} />)}</div>{pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</> : <div className="empty-state"><h2>No receipts recorded yet</h2><p>Saved sales will appear here.</p></div>}{selected && <ReceiptPanel sale={selected} autoPrint={printOnly} onClose={() => { setSelected(null); setPrintOnly(false); }} onNewSale={() => { setSelected(null); onNewSale(); }} />}</main>;
}

