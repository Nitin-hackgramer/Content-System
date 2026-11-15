import type { IdeaStatus, StateMap } from "./types";

// Idea state is one discovery_kv row per idea (key studio_state:<id>), so a save is a single upsert and two writers
// can never overwrite each other's ideas. A cleared idea keeps its row with s: null. Pure: tested without a server.
export const STATE_PREFIX = "studio_state:";
export type StateRow = { key: string; value: { s: IdeaStatus | null } };

export const stateRow = (id: string, s: IdeaStatus | null) => ({ key: STATE_PREFIX + id, value: { s } as StateRow["value"], at: new Date().toISOString() });

/** legacy: the old single-row blob (studio_idea_state), read once so no earlier save is lost. Rows are applied on top. */
export function mergeState(legacy: StateMap, rows: StateRow[]): StateMap {
  const out = { ...legacy };
  for (const r of rows) {
    if (!r.key.startsWith(STATE_PREFIX)) continue;
    const id = r.key.slice(STATE_PREFIX.length);
    if (r.value?.s) out[id] = r.value.s; else delete out[id];
  }
  return out;
}
