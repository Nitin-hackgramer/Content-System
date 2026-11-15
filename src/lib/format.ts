export function timeAgo(iso?: string | null, now = Date.now()): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const m = Math.round((now - t) / 60000);
  const n = (v: number, u: string) => `${v} ${u}${v === 1 ? "" : "s"} ago`;
  if (m < 1) return "Just now";
  if (m < 60) return n(m, "minute");
  if (m < 1440) return n(Math.round(m / 60), "hour");
  const d = Math.round(m / 1440);
  return d < 14 ? n(d, "day") : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** True only for results under ~20h old: the one place that decides whether anything may be called "today's". */
export const isFresh = (iso?: string | null, now = Date.now()) => !!iso && now - Date.parse(iso) < 20 * 36e5;

export const dateLabel = (iso?: string | null) =>
  iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "unknown";

export const host = (url?: string | null) => {
  try { return url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
};

export const safeHref = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : undefined);

export const TREND_LABEL: Record<string, string> = { new: "New", rising: "Rising", popular: "Popular", insufficient_data: "Not enough data" };

export function claimLabel(s?: string) {
  return s === "first_party" ? "First-party" : s === "corroborated" ? "Corroborated" : s === "unverified" ? "Unverified" : "Unrated";
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
