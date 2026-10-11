export function customerContact(user, profile = {}) {
  return {
    uid: user.uid,
    name: profile.name || user.displayName || "",
    email: user.email || "",
    phone: profile.phone || user.phoneNumber || "",
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    createdAt: user.metadata?.creationTime || null,
    lastSignInAt: user.metadata?.lastSignInTime || null,
    marketingEmail: profile.marketingEmail === true,
    marketingPhone: profile.marketingPhone === true,
    preferencesUpdatedAt: profile.preferencesUpdatedAt?.toDate?.()?.toISOString?.() || profile.preferencesUpdatedAt || null,
    wishlistCount: new Set(Array.isArray(profile.wishlist) ? profile.wishlist : []).size,
  };
}

export function wishlistSummary(accounts, staffIds = new Set()) {
  const counts = new Map();
  let customers = 0;
  for (const account of accounts) {
    if (staffIds.has(account.id)) continue;
    const ids = [...new Set((Array.isArray(account.wishlist) ? account.wishlist : []).filter((id) => typeof id === "string" && id))];
    if (ids.length) customers++;
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return { customers, savedItems: [...counts.values()].reduce((sum, count) => sum + count, 0), products: [...counts].map(([productId, count]) => ({ productId, count })).sort((a, b) => b.count - a.count || a.productId.localeCompare(b.productId)) };
}

const csvCell = (value) => {
  const text = String(value ?? "");
  // Keep spreadsheet formulas inert and phone numbers as text.
  return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
};
export function customerCsv(customers) {
  const columns = ["Name", "Email", "Phone", "Email promotions opted in", "Phone promotions opted in", "Email verified", "Account status", "Joined", "Last sign-in", "Wishlist items"];
  return "\uFEFF" + [columns, ...customers.map((c) => [c.name, c.email, c.phone ? "'" + c.phone : "", c.marketingEmail ? "Yes" : "No", c.marketingPhone ? "Yes" : "No", c.emailVerified ? "Yes" : "No", c.disabled ? "Disabled" : "Active", c.createdAt, c.lastSignInAt, c.wishlistCount])].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
