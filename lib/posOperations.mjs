import { purchaseProduct, wholesaleQuantityIssue } from "./wholesale.mjs";
export const posRoles = ["owner", "admin", "supervisor", "cashier"];
export const managerRoles = ["owner", "admin"];
export function cashCents(value, { negative = false } = {}) {
  if (value === "" || value == null || !["number","string"].includes(typeof value) || (typeof value === "string" && !value.trim())) throw new Error("Enter an amount in GHS.");
  const amount = Number(value);
  if (!Number.isFinite(amount) || (!negative && amount < 0) || Math.abs(amount) > 1e9 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001) throw new Error("Use a valid GHS amount with at most two decimal places.");
  return Math.round(amount * 100);
}
export function cashPosition(shift, expenses = []) {
  const expenseCents = shift.cashLedgerVersion === 1 ? Math.round(Number(shift.cashExpenses || 0) * 100) : expenses.filter(e => e.paymentMethod === "cash" && e.fromTill !== false).reduce((n,e) => n + Math.round(Number(e.amount || 0) * 100), 0);
  const opening = Math.round(Number(shift.openingCash || 0) * 100), sales = Math.round(Number(shift.paymentMix?.cash || 0) * 100), movements = Math.round(Number(shift.cashMovementNet || 0) * 100);
  const corrections = Math.round(Number(shift.cashCorrectionNet || 0) * 100);
  const change = Math.round(Number(shift.cashChangePaid || 0) * 100);
  return { openingRecorded: shift.openingCash != null, openingCash: opening / 100, cashSales: sales / 100, cashExpenses: expenseCents / 100, cashMovementNet: movements / 100, cashCorrectionNet: corrections / 100, cashChangePaid: change / 100, expectedCash: (opening + sales + movements + corrections - expenseCents - change) / 100 };
}
export function correctionCashImpact(sale, resolution, currentShiftId) {
  if (!["not-collected","cash-refund","external-refund"].includes(resolution)) throw new Error("Choose how the payment was resolved.");
  const total = cashCents(sale.total) / 100, cash = (sale.paymentMethod || "cash") === "cash";
  // A reversal reduces net sales. Offset that accounting entry when no cash
  // actually leaves this drawer, then apply any missing payment to its source.
  let currentDelta = (cash ? total : 0) - (resolution === "cash-refund" ? total : 0);
  let sourceDelta = cash && resolution === "not-collected" ? -total : 0;
  if (!cash && resolution === "not-collected") sourceDelta += cashCents(sale.cashChangePaid || 0) / 100;
  if (sale.shiftId === currentShiftId) { currentDelta += sourceDelta; sourceDelta = 0; }
  return { currentDelta, sourceDelta };
}
export function restoreBasket(draft, products) {
  const map = new Map(products.map(p => [p.id, p])), cart = [], issues = [];
  for (const line of draft.items || []) {
    const product = map.get(line.id), quantity = Number(line.quantity);
    if (!product || (draft.purchaseType !== "wholesale" && Number(product.price) <= 0) || !Number.isInteger(quantity) || quantity < 1 || Number(product.stock) < 1) { issues.push(`${line.name || line.id} is unavailable.`); continue; }
    const allowed = Math.min(quantity, Math.floor(Number(product.stock)), 999);
    if (allowed !== quantity) issues.push(`${product.name}: quantity adjusted to ${allowed}.`);
    if (Number(line.price) !== Number(product.price)) issues.push(`${product.name}: price updated.`);
    if (draft.purchaseType === "wholesale") { const issue = wholesaleQuantityIssue(product, allowed); if(issue)issues.push(`${product.name}: ${issue}`); }
    cart.push({ ...purchaseProduct(product,draft.purchaseType || "retail",allowed,false), quantity: allowed });
  }
  return { cart, issues };
}
export function basketDraft({ cart, shift, staffId, purchaseMode = "retail", orderChannel, orderReference, customerName, customerPhone, attemptId = "", name = "" }) {
  return { version: 1, purchaseType: purchaseMode, draftId: crypto.randomUUID(), staffId, shiftId: shift?.shiftId || "", savedAt: new Date().toISOString(), name: String(name).trim().slice(0,100), items: cart.map(({ id, name, quantity, price, wholesaleSnapshot }) => ({ id, name, quantity, price, ...(wholesaleSnapshot?{wholesaleSnapshot}:{}) })), orderChannel, orderReference, customerName, customerPhone, attemptId };
}
export function validateDraft(draft, uid) {
  return Boolean(draft?.version === 1 && draft.staffId === uid && Array.isArray(draft.items) && draft.items.length <= 500 && draft.items.length > 0 && draft.items.every(l => typeof l.id === "string" && l.id.length <= 200 && Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 999));
}
export function capturedPricing(receipt, items) {
  if (!receipt || !Array.isArray(receipt.items) || receipt.items.length !== items.length) throw new Error("A complete captured offline receipt is required.");
  const lines = items.map(({ id, quantity }) => {
    const matches = receipt.items.filter(l => (l.productId || l.id) === id);
    if (matches.length !== 1 || Number(matches[0].quantity) !== quantity) throw new Error("Captured receipt items do not match the offline sale.");
    const l = matches[0], total = cashCents(l.lineTotal), pack=l.wholesaleSnapshot;
    if(receipt.purchaseType==="wholesale"&&pack&&pack.unitsPerPack>1){
      const size=Number(pack.unitsPerPack),packCents=cashCents(pack.sellingUnitPrice);
      if(!["pack","box"].includes(pack.sellingUnit)||!Number.isInteger(size)||size<2||size>999||quantity%size||Number(pack.sellingQuantity)!==quantity/size||packCents<=0||Math.abs(Number(l.unitPrice)-packCents/100/size)>1e-8||total!==packCents*(quantity/size))throw new Error("Captured pack quantities or prices are invalid.");
      return {id,unitPrice:packCents/100/size,lineTotal:total/100,subtotalCents:total,wholesaleSnapshot:pack,rule:null,dealIds:[]};
    }
    const unit=cashCents(l.unitPrice);
    if (unit <= 0 || total > unit * quantity) throw new Error("Captured prices or discounts are invalid.");
    return { id, unitPrice: unit / 100, subtotalCents:unit*quantity, lineTotal: total / 100, rule: null, dealIds: [] };
  });
  const subtotal = lines.reduce((n,l) => n + l.subtotalCents,0), total = lines.reduce((n,l) => n+Math.round(l.lineTotal*100),0);
  if (cashCents(receipt.subtotal) !== subtotal || cashCents(receipt.total) !== total || cashCents(receipt.discount) !== subtotal-total) throw new Error("Captured receipt totals do not balance.");
  return { subtotal: subtotal/100, total: total/100, discount: (subtotal-total)/100, lines };
}
