"use client";
import { useState } from "react";
import { ArrowUpRight, Check, CheckCircle, FilmSlate, ImageSquare, PaperPlaneTilt, Plus, WarningCircle, CircleNotch } from "@phosphor-icons/react";
import clsx from "clsx";
import { Badge, btn } from "./ui";
import { Sheet } from "./sheet";
import { useAssetAction } from "./asset-gate";
import { toast } from "@/lib/toast";
import { host, safeHref } from "@/lib/format";
import { canFinalize, downloadable, type AssetStatus, type Candidate, type Selection } from "@/lib/asset-status";
import { finalizeAssetJob, keepAsset } from "@/app/assets/actions";

const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

function Preview({ c }: { c: Candidate }) {
  const src = safeHref(c.preview_url);
  const video = c.asset_type.toLowerCase().includes("video");
  if (src && video && VIDEO_FILE.test(src)) return <video src={src} muted playsInline preload="metadata" className="size-full object-cover" aria-label={c.name ?? "Video preview"} />;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote preview from the asset's source, sized by its box
    return <img src={src} alt={c.name ?? ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" />;
  }
  const Icon = video ? FilmSlate : ImageSquare;
  return <div className="grid size-full place-items-center text-muted"><Icon size={36} aria-hidden /><span className="sr-only">No preview</span></div>;
}

const DL: Record<Selection["download_status"], { label: string; tone: "neutral" | "info" | "ok" | "error" }> = {
  pending: { label: "Waiting", tone: "neutral" }, downloading: { label: "Downloading", tone: "info" },
  done: { label: "Downloaded", tone: "ok" }, failed: { label: "Failed", tone: "error" },
};

/** One asset. Interactive while the selection is open; read-only (with its download state) once finalized. */
export function AssetCard({ c, kept, onToggle, busy, download }: { c: Candidate; kept: boolean; onToggle?: () => void; busy?: boolean; download?: Selection }) {
  const href = safeHref(c.source_url), title = c.name || host(c.source_url) || "Untitled asset", ok = downloadable(c);
  return (
    <li className={clsx("flex flex-col overflow-hidden rounded-card-lg bg-paper shadow-[var(--shadow-e2)] ring-2 ring-inset transition-shadow duration-200", kept && onToggle ? "ring-accent" : "ring-transparent")}>
      <div className="relative aspect-[4/3] bg-surface">
        <Preview c={c} />
        <span className="absolute left-2 top-2 capitalize"><Badge>{c.asset_type}</Badge></span>
        {kept && onToggle && <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-accent-deep text-white shadow-card" aria-hidden><Check size={16} weight="bold" /></span>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug">{title}</p>
        <p className="t-meta mt-0.5 truncate">{c.source_name || host(c.source_url) || "Unknown source"}</p>
        {!ok && <p className="mt-1 flex items-center gap-1 text-[13px] text-warn-700"><WarningCircle size={14} weight="fill" aria-hidden />No download link</p>}
        {download && (
          <div className="mt-2">
            <Badge tone={DL[download.download_status].tone}>{DL[download.download_status].label}</Badge>
            {download.last_error && download.download_status === "failed" && <p className="mt-1 text-[13px] text-error-700">{download.last_error}</p>}
          </div>
        )}
        <div className="mt-auto flex gap-2 pt-3">
          {onToggle && (
            <button type="button" aria-pressed={kept} disabled={busy || (!kept && !ok)} onClick={onToggle}
              aria-label={`${kept ? "Remove" : "Keep"} ${title}`}
              className={clsx("press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-ctl text-[15px] font-medium transition-colors disabled:opacity-50",
                kept ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-linen-deep")}>
              {kept ? <><Check size={16} weight="bold" aria-hidden />Kept</> : <><Plus size={16} weight="bold" aria-hidden />Keep</>}
            </button>
          )}
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open source on ${host(href)}`} title={`Open on ${host(href)}`}
              className={clsx("press grid h-11 place-items-center rounded-ctl bg-surface text-accent-deep hover:bg-linen-deep", onToggle ? "w-11" : "flex-1 grid-flow-col gap-1 px-3 text-[14px] font-medium")}>
              <ArrowUpRight size={18} weight="bold" aria-hidden />{!onToggle && <span>{host(href)}</span>}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/** The review gallery: keep or remove each candidate, then finalize behind a confirmation. */
export function AssetReview({ jobId, status, candidates, keptIds }: { jobId: string; status: AssetStatus; candidates: Candidate[]; keptIds: string[] }) {
  const [kept, setKept] = useState(() => new Set(keptIds));
  const [filter, setFilter] = useState<"all" | "kept">("all");
  const [confirm, setConfirm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const action = useAssetAction(), fin = useAssetAction();

  async function toggle(c: Candidate) {
    const keep = !kept.has(c.id);
    const next = new Set(kept); if (keep) next.add(c.id); else next.delete(c.id);
    const before = kept;
    setKept(next); setBusyId(c.id); // optimistic; rolled back if the database refuses
    const ok = await action.run(() => keepAsset(jobId, c.id, keep));
    setBusyId(null);
    if (!ok) setKept(before);
  }

  const chosen = candidates.filter((c) => kept.has(c.id));
  const ready = canFinalize(status, chosen);
  const shown = filter === "kept" ? chosen : candidates;
  const why = !chosen.length ? "Keep at least one asset to continue." : !ready ? "A kept asset has no download link." : null;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="inline-flex rounded-full bg-surface p-1">
          {(["all", "kept"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
              className={clsx("h-11 rounded-full px-4 text-[15px] font-medium transition-colors", filter === f ? "bg-paper text-ink shadow-card" : "text-muted")}>
              {f === "all" ? `All ${candidates.length}` : `Kept ${chosen.length}`}
            </button>
          ))}
        </div>
        <p className="t-meta tabular" aria-live="polite">{chosen.length} of {candidates.length} kept</p>
      </div>

      {shown.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((c) => <AssetCard key={c.id} c={c} kept={kept.has(c.id)} busy={busyId === c.id} onToggle={() => toggle(c)} />)}
        </ul>
      ) : (
        <p className="rounded-card-lg bg-surface/60 px-6 py-10 text-center t-body text-muted">Nothing kept yet. Tap Keep on the assets you want.</p>
      )}

      {/* Thumb-reach finalize bar */}
      <div className="dock fixed inset-x-4 bottom-[calc(var(--nav-h)+var(--safe-b)+20px)] z-30 mx-auto flex max-w-md items-center gap-3 rounded-[24px] p-2 pl-4 lg:sticky lg:bottom-6 lg:mt-6 lg:max-w-none">
        <p className="min-w-0 flex-1 text-[15px] leading-tight"><span className="font-mono font-bold tabular">{chosen.length}</span> <span className="text-muted">kept</span>
          {why && <span id="fin-why" className="block truncate text-[13px] text-muted">{why}</span>}</p>
        <button type="button" disabled={!ready} onClick={() => setConfirm(true)} className={clsx(btn.base, btn.primary)} aria-describedby={why ? "fin-why" : undefined}>
          <PaperPlaneTilt size={18} weight="fill" aria-hidden />Finalize
        </button>
      </div>
      <div aria-hidden className="h-24 lg:hidden" />

      <Sheet open={confirm} onOpenChange={setConfirm} title="Send to your laptop?">
        <div className="space-y-4 pt-2">
          <p className="t-body text-muted">{chosen.length} {chosen.length === 1 ? "asset goes" : "assets go"} to the download queue. Your laptop picks it up next time it checks.</p>
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Kept assets">
            {chosen.slice(0, 12).map((c) => <li key={c.id} className="size-16 shrink-0 overflow-hidden rounded-card-sm bg-surface"><Preview c={c} /></li>)}
          </ul>
          <p className="flex items-start gap-2 rounded-card-sm bg-surface px-3 py-2.5 text-[14px]"><CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-accent-deep" aria-hidden />The selection locks. You can reopen it until the download starts.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirm(false)} className={clsx(btn.base, btn.quiet, "flex-1")}>Cancel</button>
            <button type="button" disabled={fin.pending || !ready} className={clsx(btn.base, btn.primary, "flex-1")}
              onClick={() => fin.run(() => finalizeAssetJob(jobId), () => { setConfirm(false); toast("Sent to the download queue"); })}>
              {fin.pending ? <><CircleNotch size={18} className="animate-spin motion-reduce:animate-none" aria-hidden />Sending…</> : "Finalize"}
            </button>
          </div>
        </div>
      </Sheet>
      {action.sheet}{fin.sheet}
    </>
  );
}
