import "server-only";
import { DbError, rest } from "./supabase.ts";
import type { IdeaSnapshot } from "./asset-status.ts";

// Cloud asset collector, event-driven: one user action collects ONE job. claimCollection() takes the job atomically
// (fast, called inside the Server Action so the UI gets an honest status); finishCollection() asks the providers,
// validates, and hands the candidates to the database in ONE call (submit_collection) that also moves the job to review.
// All guarantees (atomic claim, lease, no state regression, no overwriting a finalize) live in the database.
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
const WORKER = "vercel-action";
const LEASE_SECONDS = 120;

/** What tapping Collect did. Only `started` means work is running; everything else is said to the user as it is. */
export type Start =
  | { state: "started"; job: ClaimedJob }
  | { state: "no_provider" | "running" | "moved_on" | "not_found" | "waiting" };
export type CollectState = Start["state"] | "unavailable";

type JobState = { status: string; collect_attempts: number; collect_max_attempts: number; collect_token: string | null; collect_lease_expires_at: string | null };

/** Atomically claim exactly this job. With no provider it does not even touch the database, so no attempt is burned and
 *  nothing is faked. An exhausted job is claimed again only because the user asked again (an explicit retry). */
export async function claimCollection(jobId: string, providers: AssetProvider[]): Promise<Start> {
  if (!providers.length) return { state: "no_provider" };
  const claim = async () => (await rpc<ClaimedJob[]>("claim_collect_job", { p_job: jobId, p_worker: WORKER, p_lease_seconds: LEASE_SECONDS }))?.[0];
  let job = await claim();
  if (job) return { state: "started", job };

  const [s] = await rest<JobState[]>("GET", "asset_jobs", {
    select: "status,collect_attempts,collect_max_attempts,collect_token,collect_lease_expires_at", id: `eq.${jobId}`, limit: "1" });
  if (!s) return { state: "not_found" };
  if (s.status !== "collecting") return { state: "moved_on" };
  if (s.collect_attempts >= s.collect_max_attempts) {
    try { await rpc("retry_collect_job", { p_job: jobId }); }
    catch (e) { if (e instanceof DbError && e.rule?.includes("already running")) return { state: "running" }; throw e; }
    job = await claim();
    return job ? { state: "started", job } : { state: "running" };
  }
  const live = s.collect_lease_expires_at !== null && Date.parse(s.collect_lease_expires_at) > Date.now();
  return { state: live && !s.collect_token ? "waiting" : "running" }; // waiting = backing off after a failure
}

type Outcome = { kind: "ok"; candidates: number; rejected: number } | { kind: "failed"; error: string } | { kind: "stopped" };
type Opts = { budgetMs?: number; log?: (line: Record<string, unknown>) => void };

/** Runs a claimed job to its end: candidates and review, a recorded failure, or a quiet stop if the user moved it on. */
export async function finishCollection(job: ClaimedJob, providers: AssetProvider[], { budgetMs = 40_000, log = (l) => console.log(JSON.stringify(l)) }: Opts = {}): Promise<Outcome> {
  const outcome = await collectOne(job, providers, budgetMs);
  log({ event: "collector.job", job: job.id, attempt: job.collect_attempts, ...outcome });
  return outcome;
}

async function collectOne(job: ClaimedJob, providers: AssetProvider[], budget: number): Promise<Outcome> {
  const signal = AbortSignal.timeout(Math.max(1000, budget));
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
      // nothing usable: a provider outage and a genuine "found nothing" are both recorded, never sent to review empty
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
  catch (e) { if (e instanceof DbError && e.rule?.includes("no longer held")) return { kind: "stopped" }; /* else the lease expiry frees the job */ }
  return { kind: "failed", error: clean(error) };
}
