import "server-only";
import { DbError, rest } from "./supabase.ts";
import type { IdeaSnapshot } from "./asset-status.ts";

// Cloud asset collector: claim a `collecting` job, ask the configured providers for candidates, validate them, and hand
// them to the database in ONE call (submit_collection) that also moves the job to review. All guarantees (atomic claim,
// lease, no state regression, no overwriting a finalize) live in the database; this file only drives it.
// Discovery itself (search, ranking, licensing) is deliberately not here: providers plug in through AssetProvider.

/** What a provider is given. The idea is the snapshot saved when the job was created. */
export type CollectInput = { jobId: string; ideaId: string; title: string; idea: IdeaSnapshot };

/** What a provider may return. Required: asset_type, source_url (http/https; it is also the dedupe key).
 *  Optional: name, source_name, preview_url, download_url, download_url_expires_at, metadata. */
export type CandidateInput = {
  asset_type: string; source_url: string; name?: string; source_name?: string;
  preview_url?: string; download_url?: string; download_url_expires_at?: string; metadata?: Record<string, unknown>;
};

/** `ok: false` = the provider could not do its job (retryable later). `ok: true` with no candidates is a valid "nothing found". */
export type ProviderResult = { ok: true; candidates: unknown[] } | { ok: false; error: string };
export interface AssetProvider { name: string; collect(input: CollectInput, signal: AbortSignal): Promise<ProviderResult> }

export const MAX_CANDIDATES = 50;
const URL_MAX = 2048, TEXT_MAX = 300, META_MAX = 8000;

const httpUrl = (v: unknown): v is string => {
  if (typeof v !== "string" || v.length > URL_MAX) return false;
  try { return ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; }
};
const optText = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, TEXT_MAX) : undefined);

/** Returns the clean candidate, or null when anything required is wrong. Unknown fields are dropped. */
export function parseCandidate(raw: unknown): CandidateInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const type = typeof r.asset_type === "string" ? r.asset_type.trim().toLowerCase() : "";
  if (!type || type.length > 32 || !httpUrl(r.source_url)) return null;
  for (const k of ["preview_url", "download_url"]) if (r[k] != null && !httpUrl(r[k])) return null;
  const exp = r.download_url_expires_at;
  if (exp != null && (typeof exp !== "string" || Number.isNaN(Date.parse(exp)))) return null;
  const meta = r.metadata;
  if (meta != null && (typeof meta !== "object" || Array.isArray(meta) || JSON.stringify(meta).length > META_MAX)) return null;
  const out: CandidateInput = { asset_type: type, source_url: r.source_url as string };
  const name = optText(r.name), source = optText(r.source_name);
  if (name) out.name = name;
  if (source) out.source_name = source;
  if (r.preview_url != null) out.preview_url = r.preview_url as string;
  if (r.download_url != null) out.download_url = r.download_url as string;
  if (exp != null) out.download_url_expires_at = new Date(exp as string).toISOString();
  if (meta != null) out.metadata = meta as Record<string, unknown>;
  return out;
}

/** Valid, de-duplicated by source_url, capped; plus how many were thrown away. */
export function validate(raw: unknown[]) {
  const seen = new Set<string>(), valid: CandidateInput[] = [];
  let rejected = 0;
  for (const x of raw) {
    const c = parseCandidate(x);
    if (!c || seen.has(c.source_url)) { rejected++; continue; }
    if (valid.length >= MAX_CANDIDATES) { rejected++; continue; }
    seen.add(c.source_url); valid.push(c);
  }
  return { valid, rejected };
}

/** Errors are stored and logged, so they never carry URLs (they can be signed) or run long. */
export const clean = (e: unknown) =>
  String(e instanceof Error ? e.message : e).replace(/https?:\/\/\S+/g, "[url]").replace(/\s+/g, " ").trim().slice(0, 200) || "unknown error";

type ClaimedJob = { id: string; idea_id: string; title: string; idea: IdeaSnapshot; collect_token: string; collect_attempts: number };
const rpc = <T>(fn: string, body: Record<string, unknown>) => rest<T>("POST", `rpc/${fn}`, {}, body);

export type RunSummary = { configured: boolean; claimed: number; collected: number; failed: number; stopped: number };
type Opts = { worker?: string; maxJobs?: number; budgetMs?: number; leaseSeconds?: number; log?: (line: Record<string, unknown>) => void };

/** One pass over the waiting jobs. Sequential on purpose (bounded time, bounded provider load); parallelism across
 *  invocations is safe because the claim is atomic. With no provider configured it claims nothing and says so. */
export async function runCollector(providers: AssetProvider[], o: Opts = {}): Promise<RunSummary> {
  const { worker = "vercel-collector", maxJobs = 3, budgetMs = 45_000, leaseSeconds = 120, log = (l) => console.log(JSON.stringify(l)) } = o;
  const sum: RunSummary = { configured: providers.length > 0, claimed: 0, collected: 0, failed: 0, stopped: 0 };
  if (!providers.length) { log({ event: "collector.no_provider" }); return sum; }
  const deadline = Date.now() + budgetMs;

  while (sum.claimed < maxJobs && Date.now() < deadline) {
    const job = (await rpc<ClaimedJob[]>("claim_collect_job", { p_worker: worker, p_lease_seconds: leaseSeconds }))?.[0];
    if (!job) break;
    sum.claimed++;
    const outcome = await collectOne(job, providers, deadline - Date.now());
    sum[outcome.kind === "ok" ? "collected" : outcome.kind === "stopped" ? "stopped" : "failed"]++;
    log({ event: "collector.job", job: job.id, attempt: job.collect_attempts, ...outcome });
  }
  return sum;
}

type Outcome = { kind: "ok"; candidates: number; rejected: number } | { kind: "failed"; error: string } | { kind: "stopped" };

async function collectOne(job: ClaimedJob, providers: AssetProvider[], budget: number): Promise<Outcome> {
  const signal = AbortSignal.timeout(Math.max(1000, Math.min(budget, 40_000)));
  const input: CollectInput = { jobId: job.id, ideaId: job.idea_id, title: job.title, idea: job.idea };
  try {
    const results = await Promise.allSettled(providers.map((p) => p.collect(input, signal)));
    const raw: unknown[] = [], errors: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") errors.push(`${providers[i].name}: ${clean(r.reason)}`);
      else if (!r.value.ok) errors.push(`${providers[i].name}: ${clean(r.value.error)}`);
      else if (Array.isArray(r.value.candidates)) raw.push(...r.value.candidates);
      else errors.push(`${providers[i].name}: candidates is not a list`);
    });
    const { valid, rejected } = validate(raw);
    if (!valid.length) {
      // nothing usable: a provider outage and a genuine "found nothing" are both retried later, never sent to review empty
      return await release(job, errors.length ? errors.join("; ") : rejected ? `all ${rejected} candidates were invalid` : "providers found no candidates");
    }
    await rpc("submit_collection", { p_job: job.id, p_token: job.collect_token, p_items: valid });
    return { kind: "ok", candidates: valid.length, rejected };
  } catch (e) {
    if (e instanceof DbError && e.rule?.includes("no longer held")) return { kind: "stopped" }; // the user moved on or our lease ran out: touch nothing
    return await release(job, clean(e));
  }
}

async function release(job: ClaimedJob, error: string): Promise<Outcome> {
  try { await rpc("fail_collect_job", { p_job: job.id, p_token: job.collect_token, p_error: error }); }
  catch (e) { if (e instanceof DbError && e.rule?.includes("no longer held")) return { kind: "stopped" }; /* else the lease expiry recovers it */ }
  return { kind: "failed", error: clean(error) };
}
