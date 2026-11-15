import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { loadCore } from "@/lib/load";
import { jobLog } from "@/lib/py";
import { dateLabel } from "@/lib/format";
import { Badge, Empty, PageHeader, Stat, When } from "@/components/ui";
import { Accordion } from "@/components/accordion";

export default async function History() {
  const [d, jobs] = await Promise.all([loadCore(), jobLog()]);
  const durOf = (at: string) => { const t = Date.parse(at); const j = jobs.find((x) => x.kind === "discover" && x.startedAt - 5000 <= t && t <= x.endedAt); return j ? Math.round((j.endedAt - j.startedAt) / 1000) : null; };
  const failedJobs = jobs.filter((x) => x.kind === "discover" && !x.ok).slice(0, 5);
  const inferred = [...new Set(d.ideas.map((i) => i.run_id))].map((r) => ({ at: r, ideas: d.ideas.filter((i) => i.run_id === r).length }));
  const okRuns = d.runs.filter((r) => r.complete).length;

  return (
    <>
      <PageHeader title="History" back="/more" lead="Every discovery run, with outcome and errors." />
      {d.runs.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2 rounded-card-lg bg-surface p-4">
          <Stat label="Runs logged" value={d.runs.length} /><Stat label="Complete" value={okRuns} tone="ok" /><Stat label="Partial" value={d.runs.length - okRuns} />
        </div>
      )}
      {failedJobs.length > 0 && (
        <ul className="mb-4 space-y-2">{failedJobs.map((j) => <li key={j.startedAt} className="flex items-start gap-2 rounded-card bg-[var(--err-tint)] p-3 text-[15px] text-error-700 ring-1 ring-inset ring-[var(--err-line)]"><XCircle size={20} weight="fill" className="mt-0.5 shrink-0" aria-hidden /><p><span className="font-medium">Run failed <When iso={new Date(j.startedAt).toISOString()} /></span>{j.error ? `: ${j.error}` : ""}</p></li>)}</ul>
      )}
      {d.runs.length ? (
        <ol className="relative space-y-3 border-l-2 border-line pl-5">
          {d.runs.map((r) => {
            const errs = Object.entries(r.failed_sources ?? {});
            const dur = durOf(r.generated_at);
            return (
              <li key={r.generated_at} className={`relative rounded-card-lg p-4 ${r.complete ? "bg-paper shadow-[var(--shadow-e2)]" : "bg-[var(--warn-tint)] ring-1 ring-inset ring-[var(--warn-line)]"}`}>
                <span className={`absolute -left-[33px] top-4 grid size-6 place-items-center rounded-full ${r.complete ? "bg-ok-700 text-white" : "bg-warn-700 text-white"}`}>{r.complete ? <CheckCircle size={16} weight="fill" aria-hidden /> : <WarningCircle size={16} weight="fill" aria-hidden />}</span>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="text-[16px] font-medium"><When iso={r.generated_at} /></p><p className="t-meta">{dateLabel(r.generated_at)}</p></div>
                  <Badge tone={r.complete ? "ok" : "warn"}>{r.complete ? "Complete" : `${errs.length} failed`}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2">
                  {[["Items", r.items], ["Stories", r.candidates], ["New", r.after_seen_filter ?? "n/a"], ["Ideas", r.ideas.length]].map(([k, v]) => <div key={String(k)}><dd className="font-mono text-[1.5rem] font-bold tabular tracking-[-0.03em]">{v}</dd><dt className="t-meta">{k}</dt></div>)}
                </dl>
                <p className="t-meta mt-3">Duration: {dur !== null ? `${Math.floor(dur / 60)}m ${dur % 60}s` : "not recorded"}</p>
                {errs.length > 0 && (
                  <Accordion className="mt-3 rounded-card-sm bg-[var(--err-tint)] ring-1 ring-inset ring-[var(--err-line)]" buttonClassName="flex min-h-11 w-full items-center gap-2 px-3 text-left text-[14px] font-medium text-error-700"
                    summary={`${errs.length} failed ${errs.length === 1 ? "source" : "sources"}`}>
                    <ul className="space-y-1.5 px-3 pb-3">{errs.map(([k, v]) => <li key={k} className="text-[14px] text-error-700"><span className="font-mono">{k}</span>: {v.replace(/^error:?/, "") || "failed"}</li>)}</ul>
                  </Accordion>
                )}
                {r.note && <p className="t-body mt-3 text-muted">{r.note}</p>}
              </li>
            );
          })}
        </ol>
      ) : inferred.length ? (
        <>
          <p className="t-body mb-4 text-muted">Local run logs are not available, so this list is inferred from saved ideas. Outcomes, errors and durations are unknown.</p>
          <ul className="space-y-2">{inferred.map((r) => <li key={r.at} className="flex justify-between rounded-card bg-paper p-3.5 shadow-card"><span className="min-w-0"><span className="block text-[15px] font-medium"><When iso={r.at} /></span><span className="t-meta">{dateLabel(r.at)}</span></span><span className="font-mono text-[14px] text-muted">{r.ideas} ideas</span></li>)}</ul>
        </>
      ) : <Empty title="No runs yet" body="Run discovery and it is logged here." />}
    </>
  );
}
