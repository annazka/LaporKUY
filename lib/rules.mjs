export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function isOverdue(report, now = new Date()) {
  return (
    !!report.target_date &&
    report.target_date < jakartaDate(now) &&
    !["completed", "rejected", "awaiting_confirmation"].includes(report.status)
  );
}
export function missingDailyUpdate(report, now = new Date()) {
  const day = jakartaDate(now);
  return (
    !!report.start_date &&
    report.start_date <= day &&
    !["completed", "rejected", "awaiting_confirmation", "submitted"].includes(
      report.status,
    ) &&
    (!report.last_update_at ||
      jakartaDate(new Date(report.last_update_at)) !== day)
  );
}
export function validCoordinates(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -6.5 &&
    lat <= -6.05 &&
    lng >= 106.65 &&
    lng <= 107.0
  );
}
export function safeNext(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s\x00-\x1f\x7f]/.test(value)
  )
    return "/dashboard";
  try {
    const url = new URL(value, "https://laporkuy.online");
    if (
      url.origin !== "https://laporkuy.online" ||
      !/^\/(?:dashboard(?:\/reports)?|reports(?:\/(?:new|[a-f0-9-]+))?|rewards|profile(?:\/vouchers)?|operator|map)$/.test(
        url.pathname,
      )
    )
      return "/dashboard";
    return url.pathname + url.search;
  } catch {
    return "/dashboard";
  }
}
export function tokenNeedsRefresh(token, now = Date.now()) {
  if (!token) return true;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    return !Number.isFinite(payload.exp) || payload.exp * 1000 <= now + 60000;
  } catch {
    return true;
  }
}
