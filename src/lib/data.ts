import "server-only";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { rest, configured } from "./supabase";
import { STATE_PREFIX, stateRow, mergeState, type StateRow } from "./state";
import type { Idea, Result, RunLog, StateMap, TopicObs, IdeaStatus } from "./types";

const IDEAS_KEY = "discovery_ideas"; // written by the pipeline (agent/discovery/saved.py)
const LEGACY_STATE_KEY = "studio_idea_state"; // the old single-row blob: read only, so earlier saves survive the move to one row per idea

const wrap = async <T>(fn: () => Promise<T>): Promise<Result<T>> => {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Unknown error" }; }
};

async function kv<T>(key: string): Promise<T | null> {
  const rows = await rest<{ value: T }[]>("GET", "discovery_kv", { select: "value", key: `eq.${key}`, limit: "1" });
  return rows[0]?.value ?? null;
}

// When Supabase cannot answer, read the pipeline's own local fallback copy (same shape), read-only.
// IDEAS_FALLBACK_FILE overrides the location (used for offline testing).
async function localIdeas() {
  const f = process.env.IDEAS_FALLBACK_FILE || (discoveryDir() && path.join(discoveryDir()!, "data", "discovery", "saved_ideas.json"));
  if (!f) return null;
  try { return JSON.parse(await readFile(f, "utf8")) as { ideas: Idea[]; at: string }; } catch { return null; }
}

export const getIdeas = () => wrap(async () => {
  let v: { ideas: Idea[]; at: string } | null, source: "supabase" | "local" = "supabase";
  try { v = await kv<{ ideas: Idea[]; at: string }>(IDEAS_KEY); } catch (e) { v = await localIdeas(); source = "local"; if (!v) throw e; }
  return { ideas: v?.ideas ?? [], at: v?.at ?? null, source };
});

// Idea state lives in Supabase (discovery_kv). If that is unreachable it falls back to a local file so the
// buttons keep working on one machine. ponytail: the two stores do not sync; whichever answers wins.
const LOCAL_STATE = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "studio_state.json");
const readLocalState = async (): Promise<StateMap> => { try { return JSON.parse(await readFile(LOCAL_STATE, "utf8")); } catch { return {}; } };

// One row per idea (see state.ts), so a save never reads-then-rewrites the others.
const readState = async (): Promise<StateMap> => {
  const [legacy, rows] = await Promise.all([
    kv<StateMap>(LEGACY_STATE_KEY),
    rest<StateRow[]>("GET", "discovery_kv", { select: "key,value", key: `like.${STATE_PREFIX}*`, limit: "5000" }),
  ]);
  return mergeState(legacy ?? {}, rows);
};
const upsert = (rows: ReturnType<typeof stateRow>[]) => rest("POST", "discovery_kv", { on_conflict: "key" }, rows, "resolution=merge-duplicates");

export const getState = () => wrap(async () => {
  try { return await readState(); } catch { return readLocalState(); }
});

export async function setIdeaStatus(id: string, status: IdeaStatus | null) {
  try {
    await upsert([stateRow(id, status)]);
    return { state: await readState(), where: "supabase" as const };
  } catch {
    const cur = await readLocalState();
    if (status) cur[id] = status; else delete cur[id];
    await mkdir(path.dirname(LOCAL_STATE), { recursive: true });
    await writeFile(LOCAL_STATE + ".tmp", JSON.stringify(cur));
    await rename(LOCAL_STATE + ".tmp", LOCAL_STATE);
    return { state: cur, where: "local" as const };
  }
}

/** Push saves made while the database was unreachable, one row each. Throws if it is still unreachable, so nothing is dropped.
 *  ponytail: local wins per id and removals made offline are not tracked; a merge log if two devices write. */
export async function syncLocalState() {
  const local = await readLocalState();
  const ids = Object.keys(local);
  if (!ids.length) return { synced: 0 };
  await upsert(ids.map((id) => stateRow(id, local[id])));
  await rm(LOCAL_STATE, { force: true });
  return { synced: ids.length };
}

export const getObs = (days = 30) => wrap(async () => {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  return rest<TopicObs[]>("GET", "discovery_topic_obs", { select: "*", obs_date: `gte.${since}`, order: "obs_date.asc", limit: "5000" });
});

// ---- run logs: read-only look at the pipeline's data/discovery/*.json (local only) ----
export const discoveryDir = () => (process.env.DISCOVERY_DIR ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DISCOVERY_DIR) : null);

export async function getRuns(): Promise<Result<RunLog[]>> {
  const dir = discoveryDir();
  if (!dir) return { ok: false, error: "DISCOVERY_DIR not set" };
  return wrap(async () => {
    const d = path.join(dir, "data", "discovery");
    const files = (await readdir(d)).filter((f) => /^\d{4}-\d\d-\d\d_\d+\.json$/.test(f)).sort().reverse().slice(0, 30);
    const logs = await Promise.all(files.map(async (f) => {
      try { return JSON.parse(await readFile(path.join(d, f), "utf8")) as RunLog; } catch { return null; }
    }));
    return logs.filter((l): l is RunLog => !!l);
  });
}

export const hasBackend = configured;
