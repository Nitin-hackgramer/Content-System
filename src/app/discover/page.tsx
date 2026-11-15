import Link from "next/link";
import { CheckCircle, WarningCircle, Broadcast, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { loadCore } from "@/lib/load";
import { parseSources, groupBy } from "@/lib/sources";
import { timeAgo, TREND_LABEL } from "@/lib/format";
import { Badge, Card, Empty, ErrorNote, PageHeader, Section, Shelf, Stat, When } from "@/components/ui";
import { IdeaCard } from "@/components/idea-card";
import { Photo } from "@/components/photo";
import { RunDiscovery } from "@/components/run-discovery";

export default async function Discover() {
  const d = await loadCore();
  const run = d.latestRun;
  const states = Object.values(d.states);
  const trending = d.latestIdeas.filter((i) => i.trend?.class && i.trend.class !== "insufficient_data");
  const groups = run ? [...groupBy(parseSources(run.sources), (r) => r.group)] : [];
  const failed = run ? Object.keys(run.failed_sources ?? {}).length : 0;
  const healthy = !!d.latestRunId && !failed;

  return (
    <>
      <PageHeader title="Discovery Studio" lead="What the pipeline found, and how healthy it is." />
      {d.error && <div className="mb-4"><ErrorNote what="Could not reach the ideas database." detail={d.error} /></div>}

      <Card tone="ink" className="!p-5 sm:!p-7">
        <div className="relative flex items-center gap-2 text-[15px] font-medium text-bg/80">
          {!d.latestRunId ? <Broadcast size={20} aria-hidden /> : healthy ? <CheckCircle size={20} weight="fill" className="text-ok-200" aria-hidden /> : <WarningCircle size={20} weight="fill" className="text-warn-200" aria-hidden />}
          {!d.latestRunId ? "No runs yet" : healthy ? "All sources healthy" : `${failed} sources failed`}
        </div>
        <p className="t-title relative mt-2">{d.latestRunId ? <>Last run <When iso={d.latestIdeas[0]?.saved_at ?? d.latestRunId} /></> : "Ready for the first run"}</p>
        <div className="relative mt-5"><RunDiscovery enabled={d.canRun} variant="onDark" /></div>
      </Card>

      <section aria-label="Last run results" className="mt-4 rounded-card-lg bg-paper p-5 shadow-[var(--shadow-e2)]">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Collected" value={run?.items ?? "n/a"} />
          <Stat label="Qualified" value={d.latestIdeas.length} tone="accent" />
          <Stat label="Shortlisted" value={states.filter((s) => s === "shortlisted").length} tone="ok" />
          <Stat label="Rejected" value={states.filter((s) => s === "archived").length} />
        </div>
        <p className="t-meta mt-4 border-t border-line/70 pt-3">Shortlisted and rejected are your own choices.{!run && " Collected needs the local run logs."}</p>
      </section>

      <Section title="Recent discoveries" href="/library">
        {d.latestIdeas.length ? <Shelf label="Recent ideas">{d.latestIdeas.slice(0, 8).map((i) => <IdeaCard key={i.id} idea={i} variant="shelf" />)}</Shelf>
          : <Empty title="No ideas yet" body="They show up here after a run." />}
      </Section>

      <Section title="Trending topics" href="/trends">
        {trending.length ? (
          <Shelf label="Trending topics">
            {trending.slice(0, 6).map((i) => (
              <Link key={i.id} role="listitem" href={`/library/${i.id}`} className="press-card relative flex h-40 w-[70%] max-w-[260px] flex-col justify-end overflow-hidden rounded-card-lg p-4 text-white shadow-photo lift">
                <div className="absolute inset-0"><Photo id={i.id} /></div><div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
                <span className="relative"><Badge tone="accent" icon={<TrendUp size={14} weight="bold" aria-hidden />}>{TREND_LABEL[i.trend!.class!]}</Badge></span>
                <p className="relative mt-2 line-clamp-2 text-[16px] font-medium leading-snug">{i.title}</p>
              </Link>
            ))}
          </Shelf>
        ) : <Empty title="No trends yet" body="Trends need a few days of runs. Until then every topic reads as not enough data." />}
      </Section>

      <Section title="Source health" href="/sources">
        {groups.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {groups.map(([name, rows]) => {
              const bad = rows.filter((r) => !r.ok).length;
              return (
                <li key={name} className={`flex h-full min-h-[84px] flex-col justify-between rounded-card p-3 ring-1 ring-inset ${bad ? "bg-[var(--err-tint)] ring-[var(--err-line)]" : "bg-[var(--ok-tint)] ring-[var(--ok-line)]"}`}>
                  <p className="text-[15px] font-medium leading-tight">{name}</p>
                  <p className="mt-2"><Badge tone={bad ? "error" : "ok"} icon={bad ? <WarningCircle size={14} weight="fill" aria-hidden /> : <CheckCircle size={14} weight="fill" aria-hidden />}>{bad ? `${bad} of ${rows.length} failed` : `${rows.length} healthy`}</Badge></p>
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No source data" body={d.runsAvailable ? "No run logs found yet." : "Source health is read from the pipeline's run logs. Set DISCOVERY_DIR to enable it."} />}
      </Section>

      <Section title="Recent runs" href="/history">
        {d.runs.length ? (
          <ul className="space-y-2">
            {d.runs.slice(0, 4).map((r) => (
              <li key={r.generated_at} className="flex items-center justify-between gap-3 rounded-card bg-paper p-3.5 shadow-card">
                <div><p className="text-[15px] font-medium">{timeAgo(r.generated_at)}</p><p className="t-meta font-mono">{r.items} items, {r.ideas.length} ideas</p></div>
                <Badge tone={r.complete ? "ok" : "warn"}>{r.complete ? "Complete" : "Partial"}</Badge>
              </li>
            ))}
          </ul>
        ) : <Empty title="No runs recorded" body="Run history comes from the pipeline's local logs." />}
      </Section>
    </>
  );
}
