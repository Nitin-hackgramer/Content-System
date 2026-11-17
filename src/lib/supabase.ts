import "server-only";

// Thin REST client over the discovery pipeline's own Supabase tables. Key never leaves the server.
const base = () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url: `${url.replace(/\/$/, "")}/rest/v1`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

export const configured = () => base() !== null;

/** `rule` is set only for messages our own database guards raise on purpose (SQLSTATE P0001); every other error stays opaque. */
export class DbError extends Error {
  status: number; rule: string | null; code: string | null;
  constructor(status: number, rule: string | null = null, code: string | null = null) {
    super(rule ?? `Supabase ${status}`); this.status = status; this.rule = rule; this.code = code;
  }
}

export async function rest<T>(method: "GET" | "POST" | "DELETE", table: string, params: Record<string, string> = {}, body?: unknown, prefer?: string): Promise<T> {
  const b = base();
  if (!b) throw new Error("Supabase is not configured");
  const res = await fetch(`${b.url}/${table}?${new URLSearchParams(params)}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { ...b.headers, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) { // never echo the body: it can name keys or tables
    const e = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    throw new DbError(res.status, e?.code === "P0001" ? e.message ?? null : null, e?.code ?? null);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
