import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Quotes } from "@phosphor-icons/react/dist/ssr";
import { getProject, needsMigration } from "@/lib/assets";
import { STATUS, canReopen, canRetry, canSelect, isLive } from "@/lib/asset-status";
import { Badge, ErrorNote, PageHeader, Section } from "@/components/ui";
import { CollectorNotice, DownloadPanel, StepTrack, Times } from "@/components/asset-job";
import { AssetCard, AssetReview } from "@/components/asset-review";
import { JobActions, Refresh } from "@/components/asset-controls";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AssetProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let p: Awaited<ReturnType<typeof getProject>>;
  try { p = await getProject(id); } catch (e) {
    return (
      <>
        <PageHeader back="/assets" title="Asset project" action={<Refresh live={false} />} />
        <ErrorNote what={needsMigration(e) ? "The database is missing an Asset Studio migration." : "Could not load this project."} detail="Nothing was changed." />
      </>
    );
  }
  if (!p) notFound();
  const { job, candidates, selections } = p;
  const s = STATUS[job.status], open = canSelect(job.status);
  const sel = new Map(selections.map((x) => [x.candidate_id, x]));
  const kept = candidates.filter((c) => sel.has(c.id));

  return (
    <>
      <PageHeader back="/assets" title={job.title} action={<Refresh live={isLive(job.status)} />} />

      <section className="rounded-card-lg border border-line/70 bg-paper p-4 shadow-[var(--shadow-e2)] sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
          {job.revision > 0 && <Badge>Revision {job.revision + 1}</Badge>}
          <span className="t-meta tabular">{job.selected_asset_count} kept of {candidates.length}</span>
        </div>
        <StepTrack job={job} />
        <div className="mt-4 border-t border-[var(--hairline)] pt-4"><Times job={job} /></div>
      </section>

      <Link href={`/library/${job.idea_id}`} className="press-card group mt-3 flex items-center gap-3 rounded-card-lg bg-[image:var(--terracotta-tint)] p-3.5 ring-1 ring-inset ring-[var(--terracotta-line)]">
        <Quotes size={20} weight="fill" className="shrink-0 text-accent-deep" aria-hidden />
        <p className="min-w-0 flex-1 text-[15px]"><span className="t-eyebrow block text-accent-deep">From idea</span><span className="line-clamp-2">{job.idea?.hook || job.title}</span></p>
        <ArrowRight size={18} className="shrink-0 text-accent-deep transition-transform duration-200 group-active:translate-x-1" aria-hidden />
      </Link>

      {open ? (
        <Section title="Review assets">
          {candidates.length ? (
            <>
              {job.status === "collecting" && <p className="t-meta mb-3">Still collecting. More assets may appear.</p>}
              <AssetReview jobId={job.id} status={job.status} candidates={candidates} keptIds={[...sel.keys()]} />
            </>
          ) : <CollectorNotice />}
        </Section>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            <DownloadPanel job={job} />
            <JobActions jobId={job.id} reopen={canReopen(job.status)} retry={canRetry(job)} />
          </div>
          <Section title={`Kept assets · ${kept.length}`}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {kept.map((c) => <AssetCard key={c.id} c={c} kept download={sel.get(c.id)} />)}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
