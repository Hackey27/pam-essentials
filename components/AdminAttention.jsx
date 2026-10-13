"use client";
import { waitingLabel } from "@/lib/adminWorkspace.mjs";
export default function AdminAttention({ attention, loading, error, onRefresh, onNavigate }) {
  return <section className="panel admin-attention"><div className="panel-title"><div><p className="eyebrow">Current queue · all dates</p><h2>Attention inbox</h2><p>Orders and customer requests needing a next step.</p></div><button className="button secondary" type="button" disabled={loading} onClick={onRefresh}>{loading ? "Refreshing…" : "Refresh inbox"}</button></div>
    {error && <p role="alert" className="notice error-notice">{error}</p>}
    {!attention?.updatedAt && loading && <p role="status">Loading current queues…</p>}
    <div className="attention-queue-grid">{attention?.queues?.map((queue) => <article className="attention-queue" key={queue.section}>
      <button type="button" className="attention-queue-link" onClick={() => onNavigate(queue.section)}><span>{queue.title}</span><strong>{queue.count}</strong><small>{queue.count ? `Oldest waiting: ${waitingLabel(queue.oldestAt)}` : "Nothing waiting"}</small><b>Open {queue.section.toLowerCase()} →</b></button>
      {queue.records.map((record) => <button className="attention-item" type="button" key={record.id} onClick={() => onNavigate(queue.section, record)}><span><b>{record.reference || record.orderId || record.productName}</b><small>{record.customer || record.name || record.publicName || record.productName}</small></span><span>{waitingLabel(record.waitingSince)}<small>Open →</small></span></button>)}
    </article>)}</div>
    {attention?.updatedAt && <p className="workspace-caption">Updated {new Date(attention.updatedAt).toLocaleString("en-GH", { timeZone: "Africa/Accra" })}. Reviews wait from their latest submission; other items wait from receipt.</p>}
  </section>;
}
