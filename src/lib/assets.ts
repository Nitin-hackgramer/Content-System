import "server-only";
import { DbError, rest } from "./supabase.ts";
import { JOB_COLUMNS, ideaSnapshot, type AssetJob, type Candidate, type Selection } from "./asset-status.ts";
import type { Idea } from "./types.ts";

// Asset Studio reads and writes, over the same server-only REST client as the rest of the app (secret key never leaves
// the server). Every rule (transitions, locked selections, finalize checks) lives in the database; this file only calls it.

const UNIQUE = "23505";

/** The database is reachable but missing an Asset Studio migration (table, column or function not there yet). */
export const needsMigration = (e: unknown) =>
  e instanceof DbError && (e.status === 404 || ["42703", "42P01", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(e.code ?? ""));
const one = <T>(rows: T[] | null) => rows?.[0] ?? null;

export const listJobs = () =>
  rest<AssetJob[]>("GET", "asset_jobs", { select: JOB_COLUMNS, order: "updated_at.desc", limit: "200" });

export const openJobForIdea = async (ideaId: string) =>
  one(await rest<AssetJob[]>("GET", "asset_jobs", { select: JOB_COLUMNS, idea_id: `eq.${ideaId}`, status: "neq.completed", limit: "1" }));

export async function getProject(id: string) {
  const [jobs, candidates, selections] = await Promise.all([
    rest<AssetJob[]>("GET", "asset_jobs", { select: JOB_COLUMNS, id: `eq.${id}`, limit: "1" }),
    rest<Candidate[]>("GET", "asset_candidates", { select: "*", job_id: `eq.${id}`, order: "created_at.asc", limit: "1000" }),
    rest<Selection[]>("GET", "asset_selections", { select: "*", job_id: `eq.${id}`, order: "selected_at.asc", limit: "1000" }),
  ]);
  const job = one(jobs);
  return job && { job, candidates, selections };
}

/** One open job per idea (a unique index in the database): reuse it, and if two taps race, the loser reads the winner's. */
export async function createJob(idea: Idea): Promise<AssetJob> {
  const open = await openJobForIdea(idea.id);
  if (open) return open;
  try {
    const rows = await rest<AssetJob[]>("POST", "asset_jobs", { select: JOB_COLUMNS },
      { idea_id: idea.id, title: idea.title.trim() || "Untitled idea", idea: ideaSnapshot(idea) }, "return=representation");
    return rows[0];
  } catch (e) {
    const again = e instanceof DbError && e.code === UNIQUE ? await openJobForIdea(idea.id) : null;
    if (again) return again;
    throw e;
  }
}

/** Keep or remove one candidate. Keeping twice is not an error. (PostgREST answers 409 for both a duplicate and a
 *  candidate from another job, so the SQLSTATE decides.) */
export async function setSelected(jobId: string, candidateId: string, keep: boolean) {
  if (!keep) return rest("DELETE", "asset_selections", { job_id: `eq.${jobId}`, candidate_id: `eq.${candidateId}` });
  try { await rest("POST", "asset_selections", {}, { job_id: jobId, candidate_id: candidateId }); }
  catch (e) { if (!(e instanceof DbError && e.code === UNIQUE)) throw e; }
}

const rpc = (fn: "finalize_asset_job" | "reopen_asset_job" | "retry_asset_job", jobId: string) =>
  rest<AssetJob>("POST", `rpc/${fn}`, {}, { p_job: jobId });
export const finalizeJob = (id: string) => rpc("finalize_asset_job", id);
export const reopenJob = (id: string) => rpc("reopen_asset_job", id);
export const retryJob = (id: string) => rpc("retry_asset_job", id);
