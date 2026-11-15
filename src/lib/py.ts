import "server-only";

// Talks to the pipeline service (content discovery's main.py) over HTTP. Nothing is spawned from here, so the app can
// live anywhere that can reach PIPELINE_URL. The secret stays on the server and is sent as X-Trigger-Secret.
export type Status = { state: "idle" | "running" | "done" | "failed" | "unavailable"; startedAt?: number; endedAt?: number; error?: string };
export type JobRecord = { kind: string; startedAt: number; endedAt: number; ok: boolean; error?: string };
type Kind = "discover" | "brief";

const cfg = () => {
  const url = process.env.PIPELINE_URL, key = process.env.TRIGGER_SECRET;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
};
export const pipelineConfigured = () => cfg() !== null;

const WHY: Record<number, string> = { 403: "The pipeline rejected the secret (TRIGGER_SECRET must match and be 32+ characters).", 404: "That idea is not saved in the pipeline.", 400: "Bad request." };

async function call(path: string, body?: unknown): Promise<{ code: number; data: unknown }> {
  const c = cfg();
  if (!c) return { code: 0, data: null };
  try {
    const res = await fetch(`${c.url}${path}`, {
      method: body === undefined ? "GET" : "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "X-Trigger-Secret": c.key, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { code: res.status, data: await res.json().catch(() => null) };
  } catch { return { code: 0, data: null }; }
}

const unavailable = (code: number): Status => ({ state: "unavailable", error: code === 0 ? (cfg() ? "The pipeline service is not reachable." : "PIPELINE_URL or TRIGGER_SECRET is not set.") : (WHY[code] ?? `Pipeline error ${code}.`) });
const ok = (code: number) => code >= 200 && code < 300;

export async function status(kind: Kind): Promise<Status> {
  const r = await call(`/jobs/${kind}`);
  return ok(r.code) ? (r.data as Status) : unavailable(r.code);
}

export async function start(kind: Kind, body?: unknown): Promise<Status> {
  const r = await call(`/${kind}`, body ?? {});
  return ok(r.code) ? (r.data as Status) : unavailable(r.code);
}

export async function jobLog(): Promise<JobRecord[]> {
  const r = await call("/jobs");
  return ok(r.code) && Array.isArray(r.data) ? (r.data as JobRecord[]) : [];
}
