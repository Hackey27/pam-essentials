export function documentVersion(snapshot) {
  const time = snapshot?.updateTime;
  if (typeof time === "number") return String(time);
  if (time && Number.isFinite(time.seconds) && Number.isFinite(time.nanoseconds)) return `${time.seconds}.${time.nanoseconds}`;
  return time?.toDate?.()?.toISOString?.() || "";
}
