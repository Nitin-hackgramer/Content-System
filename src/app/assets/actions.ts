"use server";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { ACCESS_COOKIE, accessToken, cookieOk, passcodeOk } from "@/lib/access";
import { createJob, finalizeJob, reopenJob, retryJob, setSelected } from "@/lib/assets";
import { friendly } from "@/lib/asset-status";
import { getIdeas } from "@/lib/data";
import { DbError } from "@/lib/supabase";

// Server Functions are public POST endpoints, so each one checks access itself before it touches the database.
// Reads stay open like the rest of the app; every change needs the studio passcode cookie (see lib/access.ts).

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string; locked?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEA_ID = /^[a-f0-9]{8,64}$/i;
const bad: ActionResult = { ok: false, error: "That request was not valid." };

async function gate(): Promise<ActionResult | null> {
  const key = process.env.STUDIO_KEY;
  if (!key) return { ok: false, error: "Changes are switched off until STUDIO_KEY is set on the server." };
  if (!cookieOk((await cookies()).get(ACCESS_COOKIE)?.value, key)) return { ok: false, locked: true, error: "Enter the studio passcode to make changes." };
  return null;
}

async function guarded(work: () => Promise<string | void>): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return denied;
  try {
    const id = await work();
    refresh();
    return { ok: true, ...(id ? { id } : {}) };
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

/** Approving an idea for assets: only ideas the pipeline actually saved can become jobs. Returns the job id to open. */
export async function startAssetJob(ideaId: unknown): Promise<ActionResult> {
  if (typeof ideaId !== "string" || !IDEA_ID.test(ideaId)) return bad;
  return guarded(async () => {
    const r = await getIdeas();
    const idea = r.ok ? r.data.ideas.find((i) => i.id === ideaId) : undefined;
    if (!idea) throw new DbError(404, "asset job idea not found");
    return (await createJob(idea)).id;
  });
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
