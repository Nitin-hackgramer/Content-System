import "server-only";
import { cache } from "react";
import { getIdeas, getRuns, getState, getObs, hasBackend } from "./data";
import { pipelineConfigured } from "./py";
import type { Idea, RunLog, StateMap } from "./types";

/** Everything most pages need, with each failure kept separate so one broken source never blanks a page.
 *  cache(): layout and page both call it per request, the work runs once. */
export const loadCore = cache(async () => {
  const [i, s, r] = await Promise.all([getIdeas(), getState(), getRuns()]);
  const ideas: Idea[] = i.ok ? i.data.ideas : [];
  const states: StateMap = s.ok ? s.data : {};
  const runs: RunLog[] = r.ok ? r.data : [];
  const latestRunId = ideas[0]?.run_id ?? null;
  const latestIdeas = latestRunId ? ideas.filter((x) => x.run_id === latestRunId).sort((a, b) => a.rank - b.rank) : [];
  return {
    ideas, states, runs, latestIdeas, latestRunId, latestRun: runs[0] ?? null,
    error: i.ok ? null : i.error, source: i.ok ? i.data.source : null, dbError: i.ok ? i.data.dbError : i.error, runsAvailable: r.ok, canRun: pipelineConfigured(), connected: hasBackend(),
  };
});

export { getObs };
