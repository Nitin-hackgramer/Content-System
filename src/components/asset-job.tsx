import Link from "next/link";
import clsx from "clsx";
import { CaretRight, ImagesSquare, Laptop, CheckCircle, WarningCircle, PlugsConnected } from "@phosphor-icons/react/dist/ssr";
import { Badge, When } from "./ui";
import { STATUS, STEPS, progress, type AssetJob } from "@/lib/asset-status";

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} className="h-2 overflow-hidden rounded-full bg-linen-deep">
      <div className="h-full origin-left rounded-full bg-accent transition-transform duration-500" style={{ transform: `scaleX(${value / 100})` }} />
    </div>
  );
}

/** A project in a list: title, status, what was kept, when it last moved. */
export function JobRow({ job }: { job: AssetJob }) {
  const s = STATUS[job.status];
  return (
    <li>
      <Link href={`/assets/${job.id}`} className="press-card group flex items-center gap-3 rounded-card-lg bg-paper p-3.5 shadow-[var(--shadow-e2)]">
        <span className={clsx("grid size-11 shrink-0 place-items-center rounded-card-sm", job.status === "completed" ? "bg-ok-200/50 text-ok-700" : job.status === "failed" ? "bg-error-200/50 text-error-700" : "bg-accent-soft text-accent-deep")}>
          <ImagesSquare size={22} weight="fill" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] font-medium leading-snug">{job.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={s.tone}>{s.label}</Badge>
            <span className="t-meta tabular">{job.selected_asset_count} kept · <When iso={job.updated_at} /></span>
          </div>
          {job.status === "downloading" && <div className="mt-2.5"><ProgressBar value={progress(job)} label="Download progress" /></div>}
        </div>
        <CaretRight size={18} className="shrink-0 text-muted transition-transform duration-200 group-active:translate-x-1" aria-hidden />
      </Link>
    </li>
  );
}

/** Where the project is in its life: five steps, the current one marked; failure marks the step it stopped at. */
export function StepTrack({ job }: { job: AssetJob }) {
  const at = STATUS[job.status].step, failed = job.status === "failed";
  return (
    <ol className="flex gap-1.5" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < at || job.status === "completed", here = i === at && !done;
        return (
          <li key={label} className="min-w-0 flex-1" aria-current={here ? "step" : undefined}>
            <span className={clsx("block h-1.5 rounded-full", done ? "bg-accent-deep" : here ? (failed ? "bg-error-500" : "bg-accent") : "bg-linen-deep")} />
            <span className={clsx("mt-1.5 block truncate text-[12px]", here ? "font-medium text-ink" : "text-muted")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Times({ job }: { job: AssetJob }) {
  const rows: [string, string | null][] = [["Created", job.created_at], ["Finalized", job.finalized_at], ["Completed", job.completed_at], ["Last change", job.updated_at]];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
      {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="t-meta">{k}</dt><dd className="font-medium"><When iso={v} /></dd></div>)}
    </dl>
  );
}

/** What happens after finalizing: waiting for the laptop, downloading, done or failed. */
export function DownloadPanel({ job }: { job: AssetJob }) {
  const pct = progress(job);
  if (job.status === "completed")
    return <Panel tone="ok" icon={<CheckCircle size={22} weight="fill" />} title={job.folder_number ? `Saved to Video folder ${job.folder_number}` : "Downloaded"} body={<>Finished <When iso={job.completed_at} />.</>} />;
  if (job.status === "failed")
    return <Panel tone="error" icon={<WarningCircle size={22} weight="fill" />} title="Download failed" body={job.error_message ?? "The download stopped without a reason."} />;
  if (job.status === "downloading")
    return (
      <Panel tone="info" icon={<Laptop size={22} weight="fill" />} title={`Downloading${job.claimed_by ? ` on ${job.claimed_by}` : ""}`}
        body={<><span className="mb-2 block font-mono text-[1.5rem] font-bold tabular">{Math.round(pct)}%</span><ProgressBar value={pct} label="Download progress" /><span className="t-meta mt-2 block">Attempt {job.attempt_count} of {job.max_attempts}</span></>} />
    );
  return (
    <Panel tone="info" icon={<span className="relative grid place-items-center"><span className="absolute size-3 animate-ping rounded-full bg-info-500/40 motion-reduce:animate-none" /><span className="size-2.5 rounded-full bg-info-500" /></span>}
      title={job.status === "retry" ? "Waiting to retry" : "Waiting for your laptop"}
      body={job.status === "retry"
        ? <>Attempt {job.attempt_count} of {job.max_attempts} stopped{job.error_message ? `: ${job.error_message}` : "."} It goes again when the laptop checks in.</>
        : "Queued for download. Your laptop picks it up the next time its downloader runs."} />
  );
}

function Panel({ tone, icon, title, body }: { tone: "ok" | "error" | "info"; icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <section className={clsx("rounded-card-lg p-4 ring-1 ring-inset sm:p-5", tone === "ok" && "bg-[var(--ok-tint)] ring-[var(--ok-line)]", tone === "error" && "bg-[var(--err-tint)] ring-[var(--err-line)]", tone === "info" && "bg-info-200/20 ring-info-200/60")}>
      <h2 className={clsx("t-heading flex items-center gap-2.5", tone === "ok" && "text-ok-700", tone === "error" && "text-error-700", tone === "info" && "text-info-700")}><span aria-hidden className="grid size-6 place-items-center">{icon}</span>{title}</h2>
      <div className="t-body mt-2 text-ink/85">{body}</div>
    </section>
  );
}

/** Honest placeholder until the collector exists: nothing is invented to look like a result. */
export function CollectorNotice({ error, connected, children }: { error?: string | null; connected?: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-card-lg border border-dashed border-ink/20 px-6 py-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-paper text-muted shadow-card"><PlugsConnected size={26} aria-hidden /></span>
      <p className="t-heading mt-4">{connected ? "Nothing collected yet" : "Asset collection isn&apos;t connected yet"}</p>
      <p className="t-body mx-auto mt-1 max-w-[40ch] text-muted">{connected ? "Collect to find images and clips for this idea." : "When it is, the images and clips found for this idea appear here for you to keep or skip."}</p>
      {error && <p className="mx-auto mt-3 max-w-[40ch] text-[14px] text-error-700">Collection problem: {error}</p>}
      {children}
    </div>
  );
}
