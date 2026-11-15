export type Evidence = {
  source?: string | null; platform?: string | null; author?: string | null; url?: string | null;
  title?: string; published?: string | null; metrics?: Record<string, number>;
};
export type Brief = {
  hook?: string; beats?: { say: string; show: string }[]; on_screen_text?: string[];
  verified_facts?: string[]; claims_to_verify?: string[]; cta?: string; warnings?: string[]; error?: string;
  audit?: { status?: string; statements?: number; removed?: { where: string; text: string; reason: string }[] }; rejected?: string;
};
export type TrendClass = "new" | "rising" | "popular" | "insufficient_data";
export type Idea = {
  id: string; rank: number; run_id: string; saved_at: string; title: string; summary: string; url?: string;
  score?: number; format: string; hook: string; hook_audit?: string | null; reason: string;
  evidence_level?: string; claim_status?: string; needs_verification: boolean; independent_sources?: number;
  penalties: string[]; warnings: string[]; scored_by?: string; published?: string | null;
  trend: { class?: TrendClass; explanation?: string; topic_key?: string } | null;
  evidence: Evidence[]; brief: Brief | null; brief_at: string | null;
};
export type IdeaStatus = "saved" | "shortlisted" | "archived";
export type StateMap = Record<string, IdeaStatus>;
export type TopicObs = {
  topic_key: string; obs_date: string; run_id: string; title: string; origins: unknown[]; n_evidence: number;
  items: { u: string; m?: Record<string, number> }[]; claim_status?: string | null;
};
export type RunLog = {
  generated_at: string; sources: Record<string, string>; complete: boolean; failed_sources: Record<string, string>;
  items: number; candidates: number; after_seen_filter?: number;
  already_seen?: { same_url?: number; same_story?: number };
  trends?: { counts?: Record<string, number> }; note?: string; ideas: { id: string; title: string; score?: number }[];
};
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
