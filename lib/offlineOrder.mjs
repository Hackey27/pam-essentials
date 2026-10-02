import { fulfilmentCounts } from "./fulfilment.mjs";

export function applyPendingOrderActions(orders, actions) {
  return (orders || []).map((order) => {
    let current = order;
    for (const action of actions || []) {
      if (action.orderId !== order.orderId) continue;
      if (action.action === "confirm-fulfilment-line") {
        const counts = fulfilmentCounts(current);
        if (Number.isInteger(action.lineIndex) && action.lineIndex >= 0 && action.lineIndex < counts.length) {
          counts[action.lineIndex] = Math.min(Number(current.items[action.lineIndex].quantity), Math.max(0, Number(action.confirmedQuantity) || 0));
          current = { ...current, fulfilmentCounts: counts, localUnsynced: true };
        }
      } else if (action.status) current = { ...current, status: action.status, localUnsynced: true };
    }
    return current;
  });
}
