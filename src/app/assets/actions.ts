"use server";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { after } from "next/server";
import { ACCESS_COOKIE, accessToken, cookieOk, passcodeOk } from "@/lib/access";
import { createJob, finalizeJob, reopenJob, retryJob, setSelected } from "@/lib/assets";
import { friendly } from "@/lib/asset-status";
import { getIdeas } from "@/lib/data";
import { claimCollection, finishCollection, type CollectState } from "@/lib/collector";
import { providers } from "@/lib/providers";
import { DbError } from "@/lib/supabase";

// Server Functions are public POST endpoints, so each one checks access itself before it touches the database.
// Reads stay open like the rest of the app; every change needs the studio passcode cookie (see lib/access.ts).

export type ActionResult = { ok: true; id?: string; collection?: CollectState } | { ok: false; error: string; locked?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEA_ID = /^[a-f0-9]{8,64}$/i;
const bad: ActionResult = { ok: false, error: "That request was not valid." };

async function gate(): Promise<ActionResult | null> {
  const key = process.env.STUDIO_KEY;
  if (!key) return { ok: false, error: "Changes are switched off until STUDIO_KEY is set on the server." };
  if (!cookieOk((await cookies()).get(ACCESS_COOKIE)?.value, key)) return { ok: false, locked: true, error: "Enter the studio passcode to make changes." };
  return null;
}

async function guarded(work: () => Promise<string | void>, collection?: () => CollectState | undefined): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return denied;
  try {
    const id = await work();
    refresh();
    const c = collection?.();
    return { ok: true, ...(id ? { id } : {}), ...(c ? { collection: c } : {}) };
  } catch (e) {
    return { ok: false, error: e instanceof DbError ? friendly(e.rule) : "Could not reach the database. Nothing was changed." };
  }
}

export async function unlock(passcode: unknown): Promise<ActionResult> {
  const key = process.env.STUDIO_KEY;
  if (!key) return { ok: false, error: "Changes are switched off until STUDIO_KEY is set on the server." };
  if (typeof passcode !== "string" || !passcodeOk(passcode, key)) {
    await new Promise((r) => setTimeout(r, 600)); // ponytail: slows guessing; a real limiter comes with real sign-in
    return { ok: false, error: "That passcode is not right." };
  }
  (await cookies()).set(ACCESS_COOKIE, accessToken(key), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 90,
  });
  return { ok: true };
}

/** One tap = one collection of THIS job. The claim is atomic and happens here, so the UI hears the truth (started, no
 *  provider, already running...). The slow part runs in after(): Vercel keeps the function alive for it (up to the page's
 *  maxDuration), so the browser can close. If the function is killed anyway, the lease expires and the next tap recovers it. */
async function triggerCollection(jobId: string): Promise<CollectState> {
  try {
    const r = await claimCollection(jobId, providers);
    if (r.state === "started") { after(() => finishCollection(r.job, providers).then(() => undefined, () => undefined)); }
    return r.state;
  } catch { return "unavailable"; } // e.g. the collector migration is not applied; the project itself is still fine
}

/** Approving an idea for assets: only ideas the pipeline actually saved can become jobs. Returns the job id to open. */
export async function startAssetJob(ideaId: unknown): Promise<ActionResult> {
  if (typeof ideaId !== "string" || !IDEA_ID.test(ideaId)) return bad;
  let state: CollectState | undefined;
  return guarded(async () => {
    const r = await getIdeas();
    const idea = r.ok ? r.data.ideas.find((i) => i.id === ideaId) : undefined;
    if (!idea) throw new DbError(404, "asset job idea not found");
    const job = await createJob(idea);
    if (job.status === "collecting") state = await triggerCollection(job.id);
    return job.id;
  }, () => state);
}

/** Collect (again) for one project: the retry path. Same claim, same limits; nothing runs on a timer. */
export async function collectAssets(jobId: unknown): Promise<ActionResult> {
  if (typeof jobId !== "string" || !UUID.test(jobId)) return bad;
  let state: CollectState | undefined;
  return guarded(async () => { state = await triggerCollection(jobId); }, () => state);
}

export async function keepAsset(jobId: unknown, candidateId: unknown, keep: unknown): Promise<ActionResult> {
  if (typeof jobId !== "string" || !UUID.test(jobId) || typeof candidateId !== "string" || !UUID.test(candidateId) || typeof keep !== "boolean") return bad;
  return guarded(() => setSelected(jobId, candidateId, keep).then(() => undefined));
}

const jobAction = (fn: (id: string) => Promise<unknown>) => async (jobId: unknown): Promise<ActionResult> =>
  typeof jobId === "string" && UUID.test(jobId) ? guarded(() => fn(jobId).then(() => undefined)) : bad;

export const finalizeAssetJob = async (jobId: unknown) => jobAction(finalizeJob)(jobId);
export const reopenAssetJob = async (jobId: unknown) => jobAction(reopenJob)(jobId);
export const retryAssetJob = async (jobId: unknown) => jobAction(retryJob)(jobId);
