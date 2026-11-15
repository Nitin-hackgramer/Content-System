export type SourceRow = { key: string; group: string; label: string; ok: boolean; count: number | null; detail: string };

const GROUP_NAMES: Record<string, string> = {
  feed: "Official feeds", hn: "Hacker News", github: "GitHub", devto: "DEV", hf: "Hugging Face", google: "Google search",
  x: "X", youtube: "YouTube", "youtube-channel": "YouTube channels", web: "Web search",
};

/** Parses the pipeline's per-source report ("ok:30", "ok:5 (cached 23m ago)", "error:Timeout"). Read only. */
export function parseSources(report: Record<string, string>): SourceRow[] {
  return Object.entries(report).map(([key, v]) => {
    const [group, ...rest] = key.split(":");
    const ok = v.startsWith("ok");
    const n = /^ok:(\d+)/.exec(v);
    return { key, group: GROUP_NAMES[group] ?? group, label: rest.join(":") || group, ok, count: n ? Number(n[1]) : null, detail: ok ? v.replace(/^ok:\d+\s*/, "") : v.replace(/^error:?/, "") };
  });
}

export const groupBy = <T,>(rows: T[], key: (r: T) => string) =>
  rows.reduce<Map<string, T[]>>((m, r) => m.set(key(r), [...(m.get(key(r)) ?? []), r]), new Map());
