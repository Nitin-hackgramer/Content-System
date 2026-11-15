import "server-only";

// Thin REST client over the discovery pipeline's own Supabase tables. Key never leaves the server.
const base = () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url: `${url.replace(/\/$/, "")}/rest/v1`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

export const configured = () => base() !== null;

export async function rest<T>(method: "GET" | "POST", table: string, params: Record<string, string> = {}, body?: unknown, prefer?: string): Promise<T> {
  const b = base();
  if (!b) throw new Error("Supabase is not configured");
  const res = await fetch(`${b.url}/${table}?${new URLSearchParams(params)}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { ...b.headers, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`); // never echo the body: it can name keys or tables
  return (res.status === 204 || method === "POST" ? null : await res.json()) as T;
}
