import { CheckCircle, WarningCircle, Newspaper, HashStraight, GithubLogo, Code, Brain, GoogleLogo, XLogo, YoutubeLogo, GlobeSimple, Broadcast } from "@phosphor-icons/react/dist/ssr";
import { loadCore } from "@/lib/load";
import { parseSources, groupBy } from "@/lib/sources";
import { timeAgo } from "@/lib/format";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";
import { Accordion } from "@/components/accordion";

const ICON: Record<string, typeof Broadcast> = {
  "Official feeds": Newspaper, "Hacker News": HashStraight, GitHub: GithubLogo, DEV: Code, "Hugging Face": Brain,
  "Google search": GoogleLogo, X: XLogo, YouTube: YoutubeLogo, "YouTube channels": YoutubeLogo, "Web search": GlobeSimple,
};

export default async function Sources() {
  const d = await loadCore();
  const run = d.latestRun;
  const all = run ? parseSources(run.sources) : [];
  const groups = [...groupBy(all, (r) => r.group)];
  const bad = all.filter((r) => !r.ok).length;

  return (
    <>
      <PageHeader title="Sources" back="/more" lead={run ? `As of the last run, ${timeAgo(run.generated_at)}.` : "Where discovery reads from."} />
      {!groups.length ? <Empty title="No source data" body="No run logs found yet. Run discovery first." /> : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-card-lg bg-surface p-4">
            <Stat label="Sources" value={all.length} /><Stat label="Healthy" value={all.length - bad} tone="ok" /><Stat label="Failing" value={bad} />
            <div role="img" aria-label={`${all.length - bad} of ${all.length} sources healthy`} className="col-span-3 mt-1 flex h-1.5 overflow-hidden rounded-full bg-linen-deep"><span className="bg-ok-500" style={{ width: `${((all.length - bad) / all.length) * 100}%` }} /><span className="bg-error-500" style={{ width: `${(bad / all.length) * 100}%` }} /></div>
          </div>
          <ul className="space-y-2.5">
            {groups.map(([name, rows]) => {
              const Icon = ICON[name] ?? Broadcast;
              const b = rows.filter((r) => !r.ok).length;
              const total = rows.reduce((n, r) => n + (r.count ?? 0), 0);
              return (
                <li key={name}>
                  <Accordion defaultOpen={b > 0} className={`rounded-card-lg ${b ? "bg-[var(--err-tint)] ring-1 ring-inset ring-[var(--err-line)]" : "bg-paper shadow-[var(--shadow-e2)]"}`} buttonClassName="flex min-h-16 w-full items-center gap-3 p-3.5 text-left"
                    summary={<>
                      <span className="grid size-11 shrink-0 place-items-center rounded-card bg-ink text-bg"><Icon size={22} aria-hidden /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[16px] font-medium">{name}</span><span className="t-meta font-mono">{rows.length} queries, {total} items</span></span>
                      <Badge tone={b ? "error" : "ok"} icon={b ? <WarningCircle size={14} weight="fill" aria-hidden /> : <CheckCircle size={14} weight="fill" aria-hidden />}>{b ? `${b} failed` : "Healthy"}</Badge>
                    </>}>
                    <ul className="divide-y divide-line/70 border-t border-line/70 px-3.5">
                      {rows.map((r) => (
                        <li key={r.key} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0"><p className="truncate text-[15px] font-medium">{r.label}</p><p className="t-meta">Fetched {timeAgo(run!.generated_at)}{r.detail ? `, ${r.detail}` : ""}</p></div>
                          <div className="flex shrink-0 items-center gap-2">{r.count !== null && <span className="font-mono text-[14px] text-muted">{r.count}</span>}<Badge tone={r.ok ? "ok" : "error"}>{r.ok ? "OK" : "Failed"}</Badge></div>
                        </li>
                      ))}
                    </ul>
                  </Accordion>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
