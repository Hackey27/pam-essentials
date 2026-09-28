"use client";

import { useEffect, useState } from "react";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const today = () => new Date().toISOString().slice(0, 10);
const categories = ["Stock & supplies", "Utilities", "Transport", "Rent", "Repairs & maintenance", "Staff", "Operating expense", "Other"];

export default function PosExpenses({ user, shift }) {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ expenseDate: today(), category: "Operating expense", otherCategory: "", description: "", amount: "", paymentMethod: "cash" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function request(url, options = {}) {
    const token = await user.getIdToken();
    const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Expense request failed.");
    return data;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await request(`/api/pos/expenses?shiftId=${encodeURIComponent(shift.shiftId)}`);
      setExpenses(data.expenses || []);
      setError("");
    } catch (err) { setError(err.message || "Expenses could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (user && shift?.shiftId) load(); }, [user, shift?.shiftId]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await request("/api/pos/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shiftId: shift.shiftId, expenseDate: form.expenseDate, category: form.category === "Other" ? form.otherCategory.trim() : form.category, description: form.description.trim(), amount: Number(form.amount), paymentMethod: form.paymentMethod }) });
      setForm((current) => ({ ...current, description: "", amount: "" }));
      setNotice("Expense recorded for this shift.");
      await load();
    } catch (err) { setError(err.message || "Expense could not be saved."); }
    finally { setSaving(false); }
  }

  return <main className="pos-simple-view pos-expenses"><div className="pos-title"><div><p className="eyebrow">Shift {shift.shiftId}</p><h1>Expenses</h1><p>Record operating costs without leaving the POS.</p></div></div>
    {error && <p className="notice error-notice" role="alert">{error}</p>}{notice && <p className="notice success-notice" role="status">{notice}</p>}
    <div className="pos-expense-layout"><form className="panel pos-expense-form" onSubmit={save}><h2>Add expense</h2><label>Expense date<input type="date" required max={today()} value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></label><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>{form.category === "Other" && <label>Category name<input required maxLength={100} value={form.otherCategory} onChange={(event) => setForm({ ...form, otherCategory: event.target.value })} /></label>}<label>Description<textarea required rows={3} maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What was this expense for?" /></label><div className="pos-expense-pair"><label>Amount (GH₵)<input required type="number" min="0.01" max="1000000000" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Payment method<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="cash">Cash</option><option value="mobile-money">Mobile Money</option><option value="card">Card</option><option value="bank-transfer">Bank transfer</option></select></label></div><p>Entered by: <b>{user?.email || "Staff"}</b></p><button className="button primary" disabled={saving}>{saving ? "Saving expense…" : "Record expense"}</button></form>
      <section className="panel pos-expense-list"><div className="panel-title"><h2>This shift</h2><b>{money.format(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))}</b></div>{loading ? <p>Loading expenses…</p> : expenses.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Category / description</th><th>Payment</th><th>Entered by</th><th>Amount</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.expenseId || expense.id}><td>{expense.expenseDate || expense.createdAt?.slice(0, 10)}</td><td><b>{expense.category}</b><span>{expense.description}</span></td><td>{expense.paymentMethod?.replaceAll("-", " ")}</td><td>{expense.staffEmail}</td><td className="num">{money.format(expense.amount || 0)}</td></tr>)}</tbody></table></div> : <p>No expenses recorded for this shift.</p>}</section></div>
  </main>;
}

