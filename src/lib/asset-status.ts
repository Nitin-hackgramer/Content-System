// Asset Studio rules the UI needs, mirrored from the database migration (assets collection & organization/supabase).
// The database enforces them; this only decides what to show. Pure: tested without a server.
import type { Idea } from "./types";

export type AssetStatus = "collecting" | "review" | "finalized" | "pending_download" | "downloading" | "completed" | "failed" | "retry";

export type AssetJob = {
  id: string; idea_id: string; title: string; idea: IdeaSnapshot; status: AssetStatus; revision: number;
  selected_asset_count: number; download_progress: number | string; error_message: string | null;
  claimed_by: string | null; claimed_at: string | null; lease_expires_at: string | null;
  attempt_count: number; max_attempts: number; folder_number: number | null;
  created_at: string; updated_at: string; finalized_at: string | null; completed_at: string | null;
};
export type Candidate = {
  id: string; job_id: string; asset_type: string; name: string | null; source_name: string | null; source_url: string | null;
  preview_url: string | null; download_url: string | null; download_url_expires_at: string | null; metadata: Record<string, unknown>; created_at: string;
};
export type Selection = {
  id: string; job_id: string; candidate_id: string; selected_at: string;
  download_status: "pending" | "downloading" | "done" | "failed"; attempts: number; last_error: string | null; local_path: string | null; downloaded_at: string | null;
};
export type IdeaSnapshot = Partial<Pick<Idea, "format" | "hook" | "summary" | "url" | "score" | "saved_at">> & { trend?: string };

// Never includes claim_token: that is the laptop agent's proof of ownership and stays out of every page.
export const JOB_COLUMNS = "id,idea_id,title,idea,status,revision,selected_asset_count,download_progress,error_message,claimed_by,claimed_at,lease_expires_at,attempt_count,max_attempts,folder_number,created_at,updated_at,finalized_at,completed_at";

export const ideaSnapshot = (i: Idea): IdeaSnapshot =>
  ({ format: i.format, hook: i.hook, summary: i.summary, url: i.url, score: i.score, saved_at: i.saved_at, trend: i.trend?.class });

type Tone = "neutral" | "accent" | "error" | "warn" | "ok" | "info";
export const STATUS: Record<AssetStatus, { label: string; tone: Tone; step: number }> = {
  collecting: { label: "Collecting", tone: "neutral", step: 0 },
  review: { label: "Ready to review", tone: "accent", step: 1 },
  finalized: { label: "Finalized", tone: "info", step: 2 },
  pending_download: { label: "Waiting for laptop", tone: "info", step: 2 },
  retry: { label: "Retrying", tone: "warn", step: 2 },
  downloading: { label: "Downloading", tone: "info", step: 3 },
  completed: { label: "Done", tone: "ok", step: 4 },
  failed: { label: "Failed", tone: "error", step: 3 },
};
export const STEPS = ["Collect", "Review", "Queued", "Download", "Done"];

export const canSelect = (s: AssetStatus) => s === "collecting" || s === "review";
export const canReopen = (s: AssetStatus) => s === "finalized" || s === "pending_download" || s === "retry" || s === "failed";
export const canRetry = (j: Pick<AssetJob, "status" | "finalized_at">) => j.status === "failed" && !!j.finalized_at;
/** Pages keep themselves current while something outside the browser (collector, laptop) is expected to move the job. */
export const isLive = (s: AssetStatus) => s === "collecting" || s === "finalized" || s === "pending_download" || s === "retry" || s === "downloading";
/** The database refuses to finalize a selected asset with no link at all; the card says so before you try. */
export const downloadable = (c: Pick<Candidate, "download_url" | "source_url">) => !!(c.download_url || c.source_url);
export const canFinalize = (s: AssetStatus, selected: Pick<Candidate, "download_url" | "source_url">[]) =>
  canSelect(s) && selected.length > 0 && selected.every(downloadable);

export type Group = "progress" | "queue" | "history";
export const groupOf = (s: AssetStatus): Group =>
  canSelect(s) ? "progress" : s === "completed" || s === "failed" ? "history" : "queue";

export const progress = (j: Pick<AssetJob, "download_progress">) => Math.max(0, Math.min(100, Number(j.download_progress) || 0));

/** Database rule messages (raised by the migration's guards) in words for people. Anything unknown stays generic. */
/** What tapping Collect did, in words. null = nothing to say (work simply started). */
export function collectionNote(state: string | undefined): string | null {
  switch (state) {
    case "started": return "Collecting started. You can leave this page.";
    case "no_provider": return "Asset collection isn't connected yet. Your project is saved.";
    case "running": return "A collection is already running for this project.";
    case "waiting": return "The last attempt failed. Try again in a few minutes.";
    case "moved_on": return "This project has already moved past collecting.";
    case "unavailable": return "Collection couldn't start. Your project is saved; try again.";
    default: return null;
  }
}

export function friendly(rule: string | null | undefined): string {
  const r = rule ?? "";
  if (/are locked/.test(r)) return "This selection is locked. Reopen the project to change it.";
  if (/select at least one asset/.test(r)) return "Keep at least one asset before finalizing.";
  if (/no URL/.test(r)) return "A kept asset has no link to download from. Remove it and try again.";
  if (/cannot reopen/.test(r)) return "This project can't be reopened while it is downloading or after it is done.";
  if (/not a failed download/.test(r)) return "Only a failed download can be retried.";
  if (/invalid asset job transition/.test(r)) return "This project has already moved on. Refresh to see where it is.";
  if (/idea not found/.test(r)) return "That idea is no longer in your library.";
  if (/not found/.test(r)) return "This project no longer exists.";
  return "Could not save. Nothing was changed. Try again.";
}
