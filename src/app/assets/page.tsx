import Link from "next/link";
import { listJobs, needsMigration } from "@/lib/assets";
import { groupOf, isLive, type AssetJob, type Group } from "@/lib/asset-status";
import { hasBackend } from "@/lib/data";
import { Empty, ErrorNote, PageHeader, Section, Stat, btn } from "@/components/ui";
import { JobRow } from "@/components/asset-job";
import { Refresh } from "@/components/asset-controls";

export const dynamic = "force-dynamic";

const GROUPS: { key: Group; title: string }[] = [
  { key: "progress", title: "In progress" },
  { key: "queue", title: "Download queue" },
  { key: "history", title: "History" },
];

export default async function AssetStudio() {
  let jobs: AssetJob[] = [], problem: string | null = null;
  if (!hasBackend()) problem = "Supabase is not configured on the server.";
  else try { jobs = await listJobs(); } catch (e) {
    problem = needsMigration(e) ? "The database is missing an Asset Studio migration. Run the newest files in assets collection & organization/supabase/migrations." : "Could not reach the database. Try again in a moment.";
  }
  const by = (g: Group) => jobs.filter((j) => groupOf(j.status) === g);

  return (
    <>
      <PageHeader title="Asset Studio" lead="Pick the visuals for each idea, then send them to your laptop." action={<Refresh live={jobs.some((j) => isLive(j.status))} />} />
      {problem ? <ErrorNote what={problem} /> : !jobs.length ? (
        <Empty title="No asset projects yet" body="Open an idea and tap Collect assets to start its project."
          action={<Link href="/library" className={`${btn.base} ${btn.primary}`}>Go to your ideas</Link>} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 rounded-card-lg bg-surface p-4">
            <Stat label="In progress" value={by("progress").length} tone="accent" />
            <Stat label="In queue" value={by("queue").length} />
            <Stat label="Done" value={jobs.filter((j) => j.status === "completed").length} tone="ok" />
          </div>
          {GROUPS.map(({ key, title }) => {
            const list = by(key);
            return list.length ? <Section key={key} title={title}><ul className="space-y-2.5">{list.map((j) => <JobRow key={j.id} job={j} />)}</ul></Section> : null;
          })}
        </>
      )}
    </>
  );
}
