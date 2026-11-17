import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { DbError, rest } from "./supabase.ts";
import { clean } from "./collector.ts";

// The laptop downloader's only door into the database. It holds DOWNLOAD_AGENT_SECRET, never the Supabase key; this file
// turns six fixed operations into the existing download RPCs. No other table, column or function is reachable from here,
// and every write after the claim needs the claim token the database issued (checked by asset_job_held in SQL).
//   claim     -> claim_asset_job + reserve_asset_folder, returns the job and its kept assets
//   heartbeat -> heartbeat_asset_job        record -> record_asset_download
//   complete  -> complete_asset_job         fail   -> fail_asset_job
// Rotate: set a new DOWNLOAD_AGENT_SECRET in Vercel and the laptop's .env. Revoke: delete it in Vercel (closed when unset).

export const MIN_SECRET = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT = /^[\w.-]{1,64}$/;
// what the downloader may store as a file location: inside its own Video folder, one level of the known subfolders
const LOCAL_PATH = /^Video \d{2,4}\/assets\/(images|videos|screenshots)\/[^/\\:*?"<>|]{1,120}$/;
const STATUSES = ["pending", "downloading", "done", "failed"];
const LEASE = 900;

export type Reply = { status: number; body: unknown };
const no = (status: number, error: string): Reply => ({ status, body: { error } });

const digest = (s: string) => createHash("sha256").update(s).digest();
export function authorized(header: string | null, key = process.env.DOWNLOAD_AGENT_SECRET) {
  if (!key || key.length < MIN_SECRET || !header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice(7)), digest(key));
}

const rpc = <T>(fn: string, body: Record<string, unknown>) => rest<T>("POST", `rpc/${fn}`, {}, body);
const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

type Job = { id: string; title: string; idea: unknown; revision: number; claim_token: string; attempt_count: number; max_attempts: number; folder_number: number | null; idea_id: string };
type Sel = { id: string; download_status: string; local_path: string | null; attempts: number;
  candidate: { asset_type: string; name: string | null; source_name: string | null; source_url: string | null; download_url: string | null } | null };

async function claim(b: Record<string, unknown>): Promise<Reply> {
  if (typeof b.agent !== "string" || !AGENT.test(b.agent)) return no(400, "bad agent name");
  const min = b.min_folder ?? 1;
  if (!Number.isInteger(min) || (min as number) < 1 || (min as number) > 9999) return no(400, "bad min_folder");
  const job = (await rpc<Job[]>("claim_asset_job", { p_agent: b.agent, p_lease_seconds: LEASE }))?.[0];
  if (!job) return { status: 200, body: { job: null } };
  const folder = await rpc<number>("reserve_asset_folder", { p_job: job.id, p_token: job.claim_token, p_min: min });
  const sels = await rest<Sel[]>("GET", "asset_selections", {
    select: "id,download_status,local_path,attempts,candidate:asset_candidates(asset_type,name,source_name,source_url,download_url)",
    job_id: `eq.${job.id}`, order: "selected_at.asc", limit: "1000" });
  return { status: 200, body: {
    job: { id: job.id, idea_id: job.idea_id, title: job.title, idea: job.idea, revision: job.revision, claim_token: job.claim_token,
      attempt: job.attempt_count, max_attempts: job.max_attempts, folder_number: folder, lease_seconds: LEASE },
    assets: sels.map((s) => ({ selection_id: s.id, download_status: s.download_status, local_path: s.local_path, attempts: s.attempts, ...s.candidate })),
  } };
}

/** Everything after the claim names the job and presents its token; the database refuses a stale or foreign token. */
async function held(op: string, b: Record<string, unknown>): Promise<Reply> {
  if (!uuid(b.job) || !uuid(b.token)) return no(400, "bad job or token");
  const base = { p_job: b.job, p_token: b.token };
  const err = typeof b.error === "string" ? clean(b.error) : null;
  switch (op) {
    case "heartbeat": {
      const p = b.progress ?? null;
      if (p !== null && (typeof p !== "number" || p < 0 || p > 100)) return no(400, "bad progress");
      await rpc("heartbeat_asset_job", { ...base, p_progress: p, p_lease_seconds: LEASE });
      return { status: 200, body: { ok: true, lease_seconds: LEASE } };
    }
    case "record": {
      if (!uuid(b.selection) || typeof b.status !== "string" || !STATUSES.includes(b.status)) return no(400, "bad selection or status");
      const path = b.local_path ?? null;
      if (path !== null && (typeof path !== "string" || !LOCAL_PATH.test(path) || path.includes(".."))) return no(400, "bad local_path");
      if (b.status === "done" && path === null) return no(400, "done needs local_path");
      await rpc("record_asset_download", { ...base, p_selection: b.selection, p_status: b.status, p_local_path: path, p_error: err });
      return { status: 200, body: { ok: true } };
    }
    case "complete": {
      const j = await rpc<{ status: string; folder_number: number }>("complete_asset_job", { ...base, p_folder_number: null });
      return { status: 200, body: { ok: true, status: j.status, folder_number: j.folder_number } };
    }
    case "fail": {
      const j = await rpc<{ status: string; attempt_count: number; max_attempts: number }>("fail_asset_job", { ...base, p_error: err ?? "download failed" });
      return { status: 200, body: { ok: true, status: j.status } };
    }
  }
  return no(400, "unknown operation");
}

export async function handle(authHeader: string | null, body: unknown): Promise<Reply> {
  if (!authorized(authHeader)) return no(401, "unauthorized");
  if (!body || typeof body !== "object" || Array.isArray(body)) return no(400, "bad request");
  const b = body as Record<string, unknown>;
  try {
    if (b.op === "claim") return await claim(b);
    if (["heartbeat", "record", "complete", "fail"].includes(String(b.op))) return await held(String(b.op), b);
    return no(400, "unknown operation");
  } catch (e) {
    // database guard messages (claim lost, assets not finished...) are safe and actionable; anything else stays opaque
    if (e instanceof DbError && e.rule) return no(409, e.rule);
    return no(502, "database unavailable");
  }
}
