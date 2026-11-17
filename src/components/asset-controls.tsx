"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise, ArrowCounterClockwise, ImagesSquare } from "@phosphor-icons/react";
import clsx from "clsx";
import { btn } from "./ui";
import { useAssetAction } from "./asset-gate";
import { toast } from "@/lib/toast";
import { collectionNote } from "@/lib/asset-status";
import { startAssetJob, collectAssets, reopenAssetJob, retryAssetJob } from "@/app/assets/actions";

/** "Collect assets" on an idea: makes (or reuses) the idea's asset project and opens it. */
export function StartAssets({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const { run, pending, sheet } = useAssetAction();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => run(() => startAssetJob(ideaId), (r) => { const n = collectionNote(r.collection); if (n) toast(n); router.push(`/assets/${r.id}`); })}
        className={clsx(btn.base, btn.primary, "w-full")}>
        <ImagesSquare size={20} weight="fill" aria-hidden />{pending ? "Creating project…" : "Collect assets"}
      </button>
      {sheet}
    </>
  );
}

/** Collect (again) for one project. One tap, one collection; the server says whether it started, is running or has no provider. */
export function CollectButton({ jobId, label }: { jobId: string; label: string }) {
  const { run, pending, sheet } = useAssetAction();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => run(() => collectAssets(jobId), (r) => toast(collectionNote(r.collection) ?? "Done"))} className={clsx(btn.base, btn.quiet, "mt-4")}>
        <ArrowClockwise size={18} weight="bold" aria-hidden />{pending ? "Starting…" : label}
      </button>
      {sheet}
    </>
  );
}

/** Reopen (controlled revision) and retry, shown only where the database allows them. */
export function JobActions({ jobId, reopen, retry }: { jobId: string; reopen: boolean; retry: boolean }) {
  const { run, pending, sheet } = useAssetAction();
  if (!reopen && !retry) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {retry && <button type="button" disabled={pending} onClick={() => run(() => retryAssetJob(jobId), () => toast("Back in the download queue"))} className={clsx(btn.base, btn.primary)}><ArrowClockwise size={18} weight="bold" aria-hidden />Retry download</button>}
      {reopen && <button type="button" disabled={pending} onClick={() => run(() => reopenAssetJob(jobId), () => toast("Reopened. Your selection can change again."))} className={clsx(btn.base, btn.quiet)}><ArrowCounterClockwise size={18} weight="bold" aria-hidden />Reopen selection</button>}
      {sheet}
    </div>
  );
}

/** Manual refresh, plus a quiet 10-second refresh while the collector or the laptop is expected to move the job.
 *  ponytail: polling; Supabase Realtime takes over once the app has sign-in (realtime honours RLS). */
export function Refresh({ live }: { live: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") start(() => router.refresh()); }, 10_000);
    return () => clearInterval(t);
  }, [live, router]);
  return (
    <button type="button" onClick={() => start(() => router.refresh())} aria-label="Refresh" title="Refresh"
      className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink press hover:bg-linen-deep">
      <ArrowClockwise size={20} weight="bold" aria-hidden className={busy ? "animate-spin motion-reduce:animate-none" : undefined} />
    </button>
  );
}
