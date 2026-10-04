export function activeAnnouncements(items = [], now = new Date()) {
  const stamp = now.getTime();
  const dateStamp = (value, fallback) => !value ? fallback : (typeof value.toDate === "function" ? value.toDate() : new Date(value)).getTime();
  return items.filter((item) => {
    if (item.active === false || item.archived === true || !item.title?.trim() || !item.body?.trim()) return false;
    const start = dateStamp(item.startDate, -Infinity);
    const end = dateStamp(item.endDate, Infinity);
    return !Number.isNaN(start) && !Number.isNaN(end) && start <= stamp && stamp <= end;
  }).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.title).localeCompare(String(b.title))).map(({ announcementId, title, body, style, actionLabel, actionUrl }) => ({ announcementId, title, body, style: style === "crawler" ? "crawler" : "static", actionLabel: actionLabel || "", actionUrl: actionUrl || "" }));
}

export function validAnnouncementLink(value) {
  if (!value) return true;
  if (typeof value !== "string") return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
