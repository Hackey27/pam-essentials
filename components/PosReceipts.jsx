"use client";

import { useEffect, useState } from "react";
import PosSaleCorrection from "@/components/PosSaleCorrection";
import ReceiptPanel from "@/components/ReceiptPanel";
import { formatPosDateTime } from "@/lib/posTime.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const paymentLabel = (value) => ({ cash: "Cash", "mobile-money": "Mobile Money", momo: "Mobile Money", card: "Card", "bank-transfer": "Bank transfer", "marketplace-settlement": "Marketplace settlement" })[value] || String(value || "—").replaceAll("-", " ");

export default function PosReceipts({ user, onNewSale, role, shift, request, deviceId, onCorrected }) {
  const [correction, setCorrection] = useState(null);
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
  return <main className="pos-simple-view pos-receipts"><div className="pos-dashboard-heading"><div><h1>Recent Receipts</h1><p>Open, print, download or share a saved sale.</p></div><button className="button secondary" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button></div><div className="pos-filter-row"><label>Search receipt, customer or order<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Receipt number, name or reference" /></label><span>{filtered.length} receipts</span></div>{error && <p className="notice error-notice" role="alert">{error}</p>}{loading ? <div className="pos-loading">Loading receipts…</div> : filtered.length ? <><div className="data-table-wrap" role="region" aria-label="Receipt list" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th scope="col">Receipt number</th><th scope="col">Date &amp; time · Ghana</th><th scope="col">Customer / order reference</th><th scope="col">Payment</th><th scope="col">Cashier</th><th scope="col" className="num">Amount</th><th scope="col">Actions</th></tr></thead>
        <tbody>{filtered.slice((page - 1) * 12, page * 12).map((sale) => <tr key={sale.id || sale.receiptId}>
          <td><button type="button" className="table-action" onClick={() => { setPrintOnly(false); setSelected(sale); }} aria-label={`Open receipt ${sale.receiptId}`}>{sale.receiptId || "Open receipt"}</button>{sale.saleType === "reversal" && <span>Sale correction</span>}{sale.reversalId && <span>Reversed</span>}</td>
          <td>{formatPosDateTime(sale.createdAt)}</td>
          <td>{sale.customerName || "Walk-in"}{sale.orderReference && <div>{sale.orderReference}</div>}</td>
          <td>{paymentLabel(sale.paymentMethod)}</td>
          <td>{sale.staffName || sale.staffEmail || "Staff"}</td>
          <td className="num">{money.format(sale.total || 0)}</td>
          <td><button type="button" className="table-action" aria-label={`Print receipt ${sale.receiptId}`} onClick={() => { setPrintOnly(true); setSelected(sale); }}>Print</button></td>
        </tr>)}</tbody>
      </table>
    </div>{pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</> : <div className="empty-state"><h2>No receipts recorded yet</h2><p>Saved sales will appear here.</p></div>}{selected && <ReceiptPanel onCorrect={["owner","admin"].includes(role) && selected.saleType !== "reversal" && !selected.reversalId ? () => { setCorrection(selected); setSelected(null); } : null} sale={selected} autoPrint={printOnly} onClose={() => { setSelected(null); setPrintOnly(false); }} onNewSale={() => { setSelected(null); onNewSale(); }} />}{correction && <PosSaleCorrection sale={correction} shift={shift} request={request} deviceId={deviceId} onClose={() => setCorrection(null)} onSaved={saved => { setCorrection(null); setSelected(saved); setPrintOnly(false); setRefreshKey(k => k + 1); onCorrected?.(); }} />}</main>;
}
