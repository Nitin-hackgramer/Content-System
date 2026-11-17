import Link from "next/link";
import { ArrowRight, ImagesSquare } from "@phosphor-icons/react/dist/ssr";
import { openJobForIdea } from "@/lib/assets";
import { STATUS } from "@/lib/asset-status";
import { hasBackend } from "@/lib/data";
import { Badge } from "./ui";
import { StartAssets } from "./asset-controls";

/** On an idea: open its asset project if it has one, otherwise offer to start one. Leaves the save/shortlist flow alone. */
export async function AssetEntry({ ideaId }: { ideaId: string }) {
  if (!hasBackend()) return null;
  const job = await openJobForIdea(ideaId).catch(() => undefined);
  if (job === undefined) return null; // tables missing or database unreachable: say nothing rather than offer a button that fails

  return job ? (
    <Link href={`/assets/${job.id}`} className="press-card group mt-4 flex items-center gap-3 rounded-card-lg bg-paper p-3.5 shadow-[var(--shadow-e2)] lg:max-w-md">
      <span className="grid size-11 shrink-0 place-items-center rounded-card-sm bg-accent-soft text-accent-deep"><ImagesSquare size={22} weight="fill" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium">Asset project</p>
        <div className="mt-1 flex items-center gap-2"><Badge tone={STATUS[job.status].tone}>{STATUS[job.status].label}</Badge><span className="t-meta tabular">{job.selected_asset_count} kept</span></div>
      </div>
      <ArrowRight size={18} className="shrink-0 text-muted transition-transform duration-200 group-active:translate-x-1" aria-hidden />
    </Link>
  ) : (
    <div className="mt-4 lg:max-w-md"><StartAssets ideaId={ideaId} /></div>
  );
}
